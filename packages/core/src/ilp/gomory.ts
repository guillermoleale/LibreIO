// SPDX-License-Identifier: GPL-3.0-or-later
// Cortes de Gomory: planos de corte fraccionarios generados desde el tableau óptimo de la relajación,
// reescritos en el espacio de las variables originales y agregados como restricciones.
import { Fraction } from "../rational/Fraction";
import type { Constraint, LPModel, Relation } from "../parser/model";
import {
  solveLP,
  type LPResult,
  type LPSolution,
  type SolveOptions,
  type VariableValue,
} from "../lp/solveLP";

export interface GomoryCut {
  /** Número de corte, desde 1. */
  readonly index: number;
  /** Variable básica entera de la fila fuente. */
  readonly sourceVariable: string;
  /** Fila del tableau fuente, numerada desde 1 como la muestra la interfaz. */
  readonly sourceRow: number;
  /** Coeficientes sobre las variables de decisión originales. */
  readonly coefficients: Fraction[];
  readonly relation: Relation;
  readonly rhs: Fraction;
  /** Partes fraccionarias de la fila fuente sobre las columnas no básicas, para seguir el cálculo a mano. */
  readonly tableauRow: {
    readonly names: string[];
    readonly coefficients: Fraction[];
    readonly rhs: Fraction;
  };
}

export interface GomoryIteration {
  readonly index: number;
  /** Relajación lineal con los cortes acumulados hasta esta iteración. */
  readonly lp: LPResult;
  readonly solution: VariableValue[];
  readonly integer: boolean;
  /** Corte generado a partir de este tableau, o null si la solución ya es entera o no se pudo generar. */
  readonly cut: GomoryCut | null;
}

export interface GomoryOptions extends SolveOptions {
  readonly maxCuts?: number;
}

export interface GomoryResult {
  readonly status: "optimal" | "infeasible" | "unbounded" | "limit";
  readonly model: LPModel;
  readonly solution: LPSolution | null;
  readonly relaxation: LPResult;
  readonly iterations: GomoryIteration[];
  readonly cuts: GomoryCut[];
  readonly messages: string[];
}

function integerIndices(model: LPModel): Set<number> {
  const set = new Set<number>();
  model.variables.forEach((v, i) => {
    if (v.kind !== "continuous") {
      set.add(i);
    }
  });
  return set;
}

function isIntegerSolution(
  values: VariableValue[],
  integers: Set<number>,
): boolean {
  return values.every((v, i) => !integers.has(i) || v.value.isInteger());
}

interface SourceRow {
  readonly row: number;
  readonly variableIndex: number;
  readonly fraction: Fraction;
}

/** Fila del tableau cuya variable básica entera tiene la mayor parte fraccionaria. */
function chooseSourceRow(
  lp: LPResult,
  integers: Set<number>,
): SourceRow | null {
  const t = lp.trace[lp.trace.length - 1]!.tableau;
  let best: SourceRow | null = null;
  t.basis.forEach((col, row) => {
    const column = t.columns[col]!;
    if (
      column.kind !== "decision" ||
      column.sign !== 1 ||
      column.variableIndex === null ||
      !integers.has(column.variableIndex)
    ) {
      return;
    }
    const fraction = t.rhs[row]!.fractionalPart();
    if (fraction.isZero()) {
      return;
    }
    if (
      best === null ||
      fraction.gt(best.fraction) ||
      (fraction.eq(best.fraction) && column.variableIndex < best.variableIndex)
    ) {
      best = { row, variableIndex: column.variableIndex, fraction };
    }
  });
  return best;
}

type CutBuild =
  | { readonly kind: "cut"; readonly cut: GomoryCut }
  | { readonly kind: "infeasible" }
  | { readonly kind: "unsupported"; readonly reason: string };

/**
 * Corte fraccionario Σ f_j x_j ≥ f_0 sobre las no básicas de la fila, reescrito sobre las variables
 * originales sustituyendo holguras y excesos por su definición. Las artificiales valen cero en toda
 * solución factible, así que sus términos se omiten.
 */
function buildCut(
  lp: LPResult,
  source: SourceRow,
  index: number,
  n: number,
): CutBuild {
  const sf = lp.standardForm;
  const t = lp.trace[lp.trace.length - 1]!.tableau;
  const row = t.rows[source.row]!;
  const f0 = source.fraction;
  const names: string[] = [];
  const fractions: Fraction[] = [];
  const coefficients: Fraction[] = Array.from(
    { length: n },
    () => Fraction.ZERO,
  );
  let rhs = f0;
  for (let j = 0; j < t.columns.length; j += 1) {
    if (t.basis.includes(j)) {
      continue;
    }
    const f = row[j]!.fractionalPart();
    if (f.isZero()) {
      continue;
    }
    const column = t.columns[j]!;
    if (column.kind === "artificial") {
      continue;
    }
    names.push(column.name);
    fractions.push(f);
    if (column.kind === "decision") {
      if (column.sign !== 1 || column.variableIndex === null) {
        return {
          kind: "unsupported",
          reason: `la columna ${column.name} corresponde a una variable libre y el corte no se puede expresar sobre las variables originales`,
        };
      }
      coefficients[column.variableIndex] =
        coefficients[column.variableIndex]!.add(f);
      continue;
    }
    // Holgura: s = b - Σ a x. Exceso: e = Σ a x - b (coeficientes de la forma estándar, ya normalizados).
    const r = column.rowIndex!;
    const direction =
      column.kind === "slack" ? Fraction.MINUS_ONE : Fraction.ONE;
    for (let k = 0; k < t.columns.length; k += 1) {
      const decision = t.columns[k]!;
      if (decision.kind !== "decision") {
        continue;
      }
      if (decision.sign !== 1 || decision.variableIndex === null) {
        return {
          kind: "unsupported",
          reason: `la fila ${sf.rows[r]!.row} contiene la variable libre ${decision.name}`,
        };
      }
      const a = sf.A[r]![k]!;
      if (!a.isZero()) {
        coefficients[decision.variableIndex] = coefficients[
          decision.variableIndex
        ]!.add(f.mul(a).mul(direction));
      }
    }
    // El término constante de la sustitución pasa al lado derecho: f·b (holgura) o -f·b (exceso).
    rhs = rhs.sub(f.mul(sf.b[r]!).mul(direction.neg()));
  }
  if (coefficients.every((c) => c.isZero())) {
    return rhs.isPositive()
      ? { kind: "infeasible" }
      : { kind: "unsupported", reason: "el corte generado es trivial" };
  }
  // Presentación: si todos los coeficientes son no positivos se escribe como "<=" con signos cambiados.
  let relation: Relation = ">=";
  let finalCoefficients = coefficients;
  let finalRhs = rhs;
  if (coefficients.every((c) => !c.isPositive())) {
    relation = "<=";
    finalCoefficients = coefficients.map((c) => c.neg());
    finalRhs = rhs.neg();
  }
  return {
    kind: "cut",
    cut: {
      index,
      sourceVariable: t.columns[t.basis[source.row]!]!.name,
      sourceRow: source.row + 1,
      coefficients: finalCoefficients,
      relation,
      rhs: finalRhs,
      tableauRow: { names, coefficients: fractions, rhs: f0 },
    },
  };
}

export function gomoryCuts(
  model: LPModel,
  options: GomoryOptions = {},
): GomoryResult {
  const maxCuts = options.maxCuts ?? 50;
  const solveOptions: SolveOptions = {
    ...(options.method ? { method: options.method } : {}),
    ...(options.rule ? { rule: options.rule } : {}),
  };
  const integers = integerIndices(model);
  const n = model.variables.length;
  const messages: string[] = [];
  const iterations: GomoryIteration[] = [];
  const cuts: GomoryCut[] = [];
  let current: LPModel = model;
  const relaxation = solveLP(current, solveOptions);
  let lp = relaxation;
  const finish = (
    status: GomoryResult["status"],
    solution: LPSolution | null,
  ): GomoryResult => ({
    status,
    model: current,
    solution,
    relaxation,
    iterations,
    cuts,
    messages,
  });
  for (let k = 0; ; k += 1) {
    if (lp.status === "infeasible") {
      messages.push(
        k === 0
          ? "La relajación lineal es infactible."
          : `Con ${cuts.length} cortes la relajación es infactible: el problema entero no tiene solución.`,
      );
      return finish("infeasible", null);
    }
    if (lp.status === "unbounded") {
      messages.push("La relajación lineal es ilimitada.");
      return finish("unbounded", null);
    }
    const solution = lp.solution!.variables;
    const integer = isIntegerSolution(solution, integers);
    if (integer) {
      iterations.push({ index: k, lp, solution, integer: true, cut: null });
      messages.push(
        cuts.length === 0
          ? `La relajación lineal ya es entera: Z = ${lp.solution!.objective.toString()}.`
          : `Óptimo entero Z = ${lp.solution!.objective.toString()} después de ${cuts.length} corte${cuts.length === 1 ? "" : "s"}.`,
      );
      return finish("optimal", lp.solution);
    }
    if (cuts.length >= maxCuts) {
      iterations.push({ index: k, lp, solution, integer: false, cut: null });
      messages.push(
        `Se alcanzó el límite de ${maxCuts} cortes sin llegar a una solución entera.`,
      );
      return finish("limit", null);
    }
    const source = chooseSourceRow(lp, integers);
    if (source === null) {
      iterations.push({ index: k, lp, solution, integer: false, cut: null });
      messages.push(
        "No hay una fila del tableau con variable básica entera fraccionaria para generar el corte.",
      );
      return finish("limit", null);
    }
    const built = buildCut(lp, source, cuts.length + 1, n);
    if (built.kind === "infeasible") {
      iterations.push({ index: k, lp, solution, integer: false, cut: null });
      messages.push(
        `El corte generado desde la fila de ${model.variables[source.variableIndex]!.name} no tiene variables (0 ≥ ${source.fraction.toString()}): el problema entero es infactible.`,
      );
      return finish("infeasible", null);
    }
    if (built.kind === "unsupported") {
      iterations.push({ index: k, lp, solution, integer: false, cut: null });
      messages.push(`No se puede generar el corte porque ${built.reason}.`);
      return finish("limit", null);
    }
    const cut = built.cut;
    cuts.push(cut);
    iterations.push({ index: k, lp, solution, integer: false, cut });
    messages.push(
      `Corte ${cut.index} desde la fila de ${cut.sourceVariable} (valor ${lp.trace[lp.trace.length - 1]!.tableau.rhs[source.row]!.toString()}): ${cutText(model, cut)}.`,
    );
    const constraint: Constraint = {
      label: `CORTE_${cut.index}`,
      row: current.constraints.length + 2,
      coefficients: cut.coefficients,
      relation: cut.relation,
      rhs: cut.rhs,
    };
    current = { ...current, constraints: [...current.constraints, constraint] };
    lp = solveLP(current, solveOptions);
  }
}

/** Texto del corte sobre las variables originales, por ejemplo "6 X + 5 Y <= 25". */
export function cutText(
  model: LPModel,
  cut: GomoryCut,
  number: (f: Fraction) => string = (f) => f.toString(),
): string {
  const parts: string[] = [];
  cut.coefficients.forEach((c, i) => {
    if (c.isZero()) {
      return;
    }
    const name = model.variables[i]!.name;
    const magnitude = c.abs();
    const term = magnitude.eq(Fraction.ONE)
      ? name
      : `${number(magnitude)} ${name}`;
    if (parts.length === 0) {
      parts.push(c.isNegative() ? `- ${term}` : term);
    } else {
      parts.push(c.isNegative() ? `- ${term}` : `+ ${term}`);
    }
  });
  return `${parts.length === 0 ? "0" : parts.join(" ")} ${cut.relation} ${number(cut.rhs)}`;
}
