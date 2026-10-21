// SPDX-License-Identifier: GPL-3.0-or-later
// Análisis paramétrico del lado derecho de una fila o del coeficiente de una variable:
// tramos lineales de Z con sus quiebres, la base de cada tramo y el pivote de cada quiebre.
import { Fraction } from "../rational/Fraction";
import type { LPModel } from "../parser/model";
import { MValue } from "./MValue";
import type { StandardForm, StandardRow } from "./standardForm";
import {
  chooseLeaving,
  isEligible,
  pivot,
  ratios,
  type Tableau,
} from "./tableau";
import { solveLP, type SolveOptions, type VariableValue } from "./solveLP";

export interface ParametricSegment {
  readonly from: Fraction;
  readonly to: Fraction;
  /** Z = slope * p + intercept en el sentido original del problema. */
  readonly slope: Fraction;
  readonly intercept: Fraction;
  readonly zFrom: Fraction;
  readonly zTo: Fraction;
  readonly basis: string[];
  readonly solutionFrom: VariableValue[];
  readonly solutionTo: VariableValue[];
}

export interface ParametricBreakpoint {
  readonly value: Fraction;
  readonly z: Fraction;
  readonly leaving: string | null;
  readonly entering: string | null;
  /** Fila del tableau al estilo LINDO (la fila 1 es la función objetivo). */
  readonly pivotRow: number | null;
  /** Pendiente de Z antes del pivote: precio sombra (lado derecho) o valor de la variable (coeficiente). */
  readonly rateBefore: Fraction;
}

export interface ParametricResult {
  readonly kind: "rhs" | "cost";
  /** Nombre de la fila o de la variable. */
  readonly target: string;
  readonly current: Fraction;
  readonly from: Fraction;
  readonly to: Fraction;
  readonly segments: ParametricSegment[];
  readonly breakpoints: ParametricBreakpoint[];
  readonly infeasibleBelow: Fraction | null;
  readonly infeasibleAbove: Fraction | null;
  readonly unboundedBelow: Fraction | null;
  readonly unboundedAbove: Fraction | null;
  readonly status: "ok" | "notOptimal";
  readonly messages: string[];
}

interface Exploration {
  segments: ParametricSegment[];
  breakpoints: ParametricBreakpoint[];
  stoppedAt: Fraction | null;
}

function decisionValues(
  model: LPModel,
  t: Tableau,
  rhs: Fraction[],
): VariableValue[] {
  const values = model.variables.map(() => Fraction.ZERO);
  t.basis.forEach((col, i) => {
    const column = t.columns[col]!;
    if (column.kind === "decision") {
      const v = column.variableIndex!;
      values[v] = values[v]!.add(column.sign === 1 ? rhs[i]! : rhs[i]!.neg());
    }
  });
  return model.variables.map((v, i) => ({ name: v.name, value: values[i]! }));
}

function objectiveAt(sf: StandardForm, t: Tableau, rhs: Fraction[]): Fraction {
  let z = Fraction.ZERO;
  t.basis.forEach((col, i) => {
    z = z.add(sf.c[col]!.mul(rhs[i]!));
  });
  return sf.sense === "max" ? z : z.neg();
}

function basisNames(t: Tableau): string[] {
  return t.basis.map((col) => t.columns[col]!.name);
}

function makeSegment(
  pA: Fraction,
  pB: Fraction,
  zA: Fraction,
  zB: Fraction,
  solA: VariableValue[],
  solB: VariableValue[],
  basis: string[],
  slopeHint: Fraction,
): ParametricSegment {
  const ascending = pA.le(pB);
  const from = ascending ? pA : pB;
  const to = ascending ? pB : pA;
  const zFrom = ascending ? zA : zB;
  const zTo = ascending ? zB : zA;
  const slope = to.eq(from) ? slopeHint : zTo.sub(zFrom).div(to.sub(from));
  return {
    from,
    to,
    slope,
    intercept: zFrom.sub(slope.mul(from)),
    zFrom,
    zTo,
    basis,
    solutionFrom: ascending ? solA : solB,
    solutionTo: ascending ? solB : solA,
  };
}

function exploreRhs(
  model: LPModel,
  sf: StandardForm,
  start: Tableau,
  row: StandardRow,
  p0: Fraction,
  dir: 1 | -1,
  limit: Fraction,
): Exploration {
  const segments: ParametricSegment[] = [];
  const breakpoints: ParametricBreakpoint[] = [];
  const unitCol = row.artificialColumn ?? row.slackColumn!;
  const flip = row.flipped ? Fraction.MINUS_ONE : Fraction.ONE;
  const s = sf.sense === "max" ? Fraction.ONE : Fraction.MINUS_ONE;
  const d = Fraction.of(dir);
  let t = start;
  let p = p0;
  for (let guard = 0; guard < 500; guard += 1) {
    const u = t.rows.map((r) => r[unitCol]!.mul(flip));
    const slope = s.mul(flip).mul(t.objectiveRow[unitCol]!.c);
    let stepMax: Fraction | null = null;
    let leavingRow = -1;
    u.forEach((entry, r) => {
      const coef = entry.mul(d);
      if (coef.isNegative()) {
        const bound = t.rhs[r]!.div(coef.neg());
        if (stepMax === null || bound.lt(stepMax)) {
          stepMax = bound;
          leavingRow = r;
        }
      }
    });
    const remaining = limit.sub(p).mul(d);
    const stepLimit = stepMax as Fraction | null;
    if (remaining.isNegative()) {
      return { segments, breakpoints, stoppedAt: null };
    }
    if (stepLimit === null || stepLimit.ge(remaining)) {
      const rhsEnd = t.rhs.map((value, r) =>
        value.add(u[r]!.mul(d).mul(remaining)),
      );
      segments.push(
        makeSegment(
          p,
          limit,
          objectiveAt(sf, t, t.rhs),
          objectiveAt(sf, t, rhsEnd),
          decisionValues(model, t, t.rhs),
          decisionValues(model, t, rhsEnd),
          basisNames(t),
          slope,
        ),
      );
      return { segments, breakpoints, stoppedAt: null };
    }
    const p1 = p.add(d.mul(stepLimit));
    const rhsAt = t.rhs.map((value, r) =>
      value.add(u[r]!.mul(d).mul(stepLimit)),
    );
    if (stepLimit.isPositive()) {
      segments.push(
        makeSegment(
          p,
          p1,
          objectiveAt(sf, t, t.rhs),
          objectiveAt(sf, t, rhsAt),
          decisionValues(model, t, t.rhs),
          decisionValues(model, t, rhsAt),
          basisNames(t),
          slope,
        ),
      );
    }
    const atBreak: Tableau = { ...t, rhs: rhsAt };
    // Pivote del simplex dual: entra la columna con menor |d_j / a_rj| entre las negativas de la fila.
    const pivotRowValues = atBreak.rows[leavingRow]!;
    let entering = -1;
    let best: Fraction | null = null;
    pivotRowValues.forEach((a, j) => {
      if (!a.isNegative() || !isEligible(atBreak, j)) {
        return;
      }
      const ratio = atBreak.objectiveRow[j]!.c.div(a.neg());
      if (best === null || ratio.lt(best)) {
        best = ratio;
        entering = j;
      }
    });
    const z1 = objectiveAt(sf, atBreak, rhsAt);
    if (entering < 0) {
      breakpoints.push({
        value: p1,
        z: z1,
        leaving: atBreak.columns[atBreak.basis[leavingRow]!]!.name,
        entering: null,
        pivotRow: leavingRow + 2,
        rateBefore: slope,
      });
      return { segments, breakpoints, stoppedAt: p1 };
    }
    breakpoints.push({
      value: p1,
      z: z1,
      leaving: atBreak.columns[atBreak.basis[leavingRow]!]!.name,
      entering: atBreak.columns[entering]!.name,
      pivotRow: leavingRow + 2,
      rateBefore: slope,
    });
    t = pivot(atBreak, leavingRow, entering);
    p = p1;
  }
  return { segments, breakpoints, stoppedAt: null };
}

/** Aplica un cambio theta al coeficiente (forma de maximización) de la columna j sobre la fila objetivo. */
function shiftCost(t: Tableau, j: number, theta: Fraction): Tableau {
  const basicRow = t.basis.indexOf(j);
  if (basicRow < 0) {
    const objectiveRow = t.objectiveRow.map((v, k) =>
      k === j ? v.sub(MValue.constant(theta)) : v,
    );
    return { ...t, objectiveRow };
  }
  const row = t.rows[basicRow]!;
  const objectiveRow = t.objectiveRow.map((v, k) =>
    k === j ? v : v.add(MValue.constant(theta.mul(row[k]!))),
  );
  const objectiveValue = t.objectiveValue.add(
    MValue.constant(theta.mul(t.rhs[basicRow]!)),
  );
  return { ...t, objectiveRow, objectiveValue };
}

function exploreCost(
  model: LPModel,
  sf: StandardForm,
  start: Tableau,
  column: number,
  p0: Fraction,
  dir: 1 | -1,
  limit: Fraction,
): Exploration {
  const segments: ParametricSegment[] = [];
  const breakpoints: ParametricBreakpoint[] = [];
  const s = sf.sense === "max" ? Fraction.ONE : Fraction.MINUS_ONE;
  const d = Fraction.of(dir);
  const sd = s.mul(d);
  let t = start;
  let p = p0;
  for (let guard = 0; guard < 500; guard += 1) {
    const basicRow = t.basis.indexOf(column);
    const slope = basicRow >= 0 ? t.rhs[basicRow]! : Fraction.ZERO;
    let stepMax: Fraction | null = null;
    let entering = -1;
    if (basicRow >= 0) {
      const row = t.rows[basicRow]!;
      row.forEach((a, k) => {
        if (k === column || !isEligible(t, k)) {
          return;
        }
        const coef = sd.mul(a);
        if (coef.isNegative()) {
          const bound = t.objectiveRow[k]!.c.div(coef.neg());
          if (stepMax === null || bound.lt(stepMax)) {
            stepMax = bound;
            entering = k;
          }
        }
      });
    } else if (sd.isPositive()) {
      stepMax = t.objectiveRow[column]!.c;
      entering = column;
    }
    const remaining = limit.sub(p).mul(d);
    const stepLimit = stepMax as Fraction | null;
    if (remaining.isNegative()) {
      return { segments, breakpoints, stoppedAt: null };
    }
    const zAt = (tableau: Tableau): Fraction => s.mul(tableau.objectiveValue.c);
    const solution = decisionValues(model, t, t.rhs);
    if (stepLimit === null || stepLimit.ge(remaining)) {
      const tEnd = shiftCost(t, column, sd.mul(remaining));
      segments.push(
        makeSegment(
          p,
          limit,
          zAt(t),
          zAt(tEnd),
          solution,
          solution,
          basisNames(t),
          slope,
        ),
      );
      return { segments, breakpoints, stoppedAt: null };
    }
    const p1 = p.add(d.mul(stepLimit));
    const atBreak = shiftCost(t, column, sd.mul(stepLimit));
    if (stepLimit.isPositive()) {
      segments.push(
        makeSegment(
          p,
          p1,
          zAt(t),
          zAt(atBreak),
          solution,
          solution,
          basisNames(t),
          slope,
        ),
      );
    }
    const r = ratios(atBreak, entering);
    const leaving = chooseLeaving(r);
    if (leaving === null) {
      breakpoints.push({
        value: p1,
        z: zAt(atBreak),
        leaving: null,
        entering: atBreak.columns[entering]!.name,
        pivotRow: null,
        rateBefore: slope,
      });
      return { segments, breakpoints, stoppedAt: p1 };
    }
    breakpoints.push({
      value: p1,
      z: zAt(atBreak),
      leaving: atBreak.columns[atBreak.basis[leaving.pivotRow]!]!.name,
      entering: atBreak.columns[entering]!.name,
      pivotRow: leaving.pivotRow + 2,
      rateBefore: slope,
    });
    t = pivot(atBreak, leaving.pivotRow, entering);
    p = p1;
  }
  return { segments, breakpoints, stoppedAt: null };
}

function interpolate(seg: ParametricSegment, p: Fraction): VariableValue[] {
  if (seg.to.eq(seg.from)) {
    return seg.solutionFrom;
  }
  const f = p.sub(seg.from).div(seg.to.sub(seg.from));
  return seg.solutionFrom.map((v, i) => ({
    name: v.name,
    value: v.value.add(seg.solutionTo[i]!.value.sub(v.value).mul(f)),
  }));
}

function trim(
  seg: ParametricSegment,
  from: Fraction,
  to: Fraction,
): ParametricSegment | null {
  const a = Fraction.max(seg.from, from);
  const b = Fraction.min(seg.to, to);
  if (a.gt(b)) {
    return null;
  }
  if (a.eq(seg.from) && b.eq(seg.to)) {
    return seg;
  }
  return {
    ...seg,
    from: a,
    to: b,
    zFrom: seg.slope.mul(a).add(seg.intercept),
    zTo: seg.slope.mul(b).add(seg.intercept),
    solutionFrom: interpolate(seg, a),
    solutionTo: interpolate(seg, b),
  };
}

function assemble(
  kind: "rhs" | "cost",
  target: string,
  current: Fraction,
  from: Fraction,
  to: Fraction,
  down: Exploration,
  up: Exploration,
  messages: string[],
): ParametricResult {
  const all = [...down.segments, ...up.segments];
  const trimmed = all
    .map((s) => trim(s, from, to))
    .filter((s): s is ParametricSegment => s !== null && s.to.gt(s.from))
    .sort((a, b) => a.from.cmp(b.from));
  // Las exploraciones hacia abajo y hacia arriba parten de la misma base: se unen los tramos contiguos iguales.
  const segments: ParametricSegment[] = [];
  for (const seg of trimmed) {
    const previous = segments[segments.length - 1];
    if (
      previous &&
      previous.to.eq(seg.from) &&
      previous.basis.join("|") === seg.basis.join("|") &&
      previous.slope.eq(seg.slope) &&
      previous.intercept.eq(seg.intercept)
    ) {
      segments[segments.length - 1] = {
        ...previous,
        to: seg.to,
        zTo: seg.zTo,
        solutionTo: seg.solutionTo,
      };
    } else {
      segments.push(seg);
    }
  }
  const breakpoints = [...down.breakpoints, ...up.breakpoints]
    .filter((b) => b.value.gt(from) && b.value.lt(to))
    .sort((a, b) => a.value.cmp(b.value));
  return {
    kind,
    target,
    current,
    from,
    to,
    segments,
    breakpoints,
    infeasibleBelow: kind === "rhs" ? down.stoppedAt : null,
    infeasibleAbove: kind === "rhs" ? up.stoppedAt : null,
    unboundedBelow: kind === "cost" ? down.stoppedAt : null,
    unboundedAbove: kind === "cost" ? up.stoppedAt : null,
    status: "ok",
    messages,
  };
}

function notOptimal(
  kind: "rhs" | "cost",
  target: string,
  current: Fraction,
  from: Fraction,
  to: Fraction,
  status: string,
): ParametricResult {
  return {
    kind,
    target,
    current,
    from,
    to,
    segments: [],
    breakpoints: [],
    infeasibleBelow: null,
    infeasibleAbove: null,
    unboundedBelow: null,
    unboundedAbove: null,
    status: "notOptimal",
    messages: [
      `El análisis paramétrico requiere un óptimo de partida y el problema es ${status === "unbounded" ? "ilimitado" : "infactible"}.`,
    ],
  };
}

/** Varía el lado derecho de la restricción `constraintIndex` (índice desde 0) entre `from` y `to`. */
export function parametricRhs(
  model: LPModel,
  constraintIndex: number,
  from: Fraction,
  to: Fraction,
  options: SolveOptions = {},
): ParametricResult {
  const constraint = model.constraints[constraintIndex];
  if (!constraint) {
    throw new RangeError(`No existe la restricción ${constraintIndex}`);
  }
  const target = constraint.label ?? String(constraint.row);
  const current = constraint.rhs;
  const result = solveLP(model, options);
  if (result.status !== "optimal") {
    return notOptimal("rhs", target, current, from, to, result.status);
  }
  const sf = result.standardForm;
  const row = sf.rows.find((r) => r.constraintIndex === constraintIndex)!;
  const final = result.trace[result.trace.length - 1]!.tableau;
  const lower = Fraction.min(from, current);
  const upper = Fraction.max(to, current);
  const down = exploreRhs(model, sf, final, row, current, -1, lower);
  const up = exploreRhs(model, sf, final, row, current, 1, upper);
  const messages: string[] = [];
  if (down.stoppedAt) {
    messages.push(
      `Por debajo de ${down.stoppedAt.toString()} el problema es infactible.`,
    );
  }
  if (up.stoppedAt) {
    messages.push(
      `Por encima de ${up.stoppedAt.toString()} el problema es infactible.`,
    );
  }
  return assemble("rhs", target, current, from, to, down, up, messages);
}

/** Varía el coeficiente de la variable `variableIndex` en la función objetivo entre `from` y `to`. */
export function parametricCost(
  model: LPModel,
  variableIndex: number,
  from: Fraction,
  to: Fraction,
  options: SolveOptions = {},
): ParametricResult {
  const variable = model.variables[variableIndex];
  if (!variable) {
    throw new RangeError(`No existe la variable ${variableIndex}`);
  }
  const current = model.objective[variableIndex]!;
  const result = solveLP(model, options);
  if (result.status !== "optimal") {
    return notOptimal("cost", variable.name, current, from, to, result.status);
  }
  const sf = result.standardForm;
  const columns = sf.columns
    .map((c, j) => ({ c, j }))
    .filter(
      ({ c }) => c.kind === "decision" && c.variableIndex === variableIndex,
    );
  if (columns.length !== 1) {
    return {
      ...notOptimal("cost", variable.name, current, from, to, "optimal"),
      messages: [
        `El análisis paramétrico del coeficiente no está disponible para la variable libre ${variable.name}.`,
      ],
    };
  }
  const column = columns[0]!.j;
  const final = result.trace[result.trace.length - 1]!.tableau;
  const lower = Fraction.min(from, current);
  const upper = Fraction.max(to, current);
  const down = exploreCost(model, sf, final, column, current, -1, lower);
  const up = exploreCost(model, sf, final, column, current, 1, upper);
  const messages: string[] = [];
  if (down.stoppedAt) {
    messages.push(
      `Por debajo de ${down.stoppedAt.toString()} el problema es ilimitado.`,
    );
  }
  if (up.stoppedAt) {
    messages.push(
      `Por encima de ${up.stoppedAt.toString()} el problema es ilimitado.`,
    );
  }
  return assemble("cost", variable.name, current, from, to, down, up, messages);
}
