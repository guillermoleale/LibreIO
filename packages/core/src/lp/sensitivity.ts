// SPDX-License-Identifier: GPL-3.0-or-later
// Análisis de sensibilidad a partir del tableau óptimo: costos reducidos, precios sombra y duales,
// rangos de coeficientes de la función objetivo y de lado derecho en los que la base no cambia.
import { Fraction } from "../rational/Fraction";
import { INFINITY, finite, type Extended } from "../rational/Extended";
import type { LPModel, Relation } from "../parser/model";
import type { StandardForm } from "./standardForm";
import type { Tableau } from "./tableau";
import type { LPSolution } from "./solveLP";

export interface VariableSensitivity {
  readonly name: string;
  readonly value: Fraction;
  /** Coeficiente en la función objetivo original. */
  readonly cost: Fraction;
  readonly contribution: Fraction;
  /** Siempre no negativo: cuánto tiene que mejorar el coeficiente para que la variable entre. */
  readonly reducedCost: Fraction;
  readonly basic: boolean;
  readonly costIncrease: Extended;
  readonly costDecrease: Extended;
  readonly costMin: Extended;
  readonly costMax: Extended;
}

export interface ConstraintSensitivity {
  readonly row: number;
  readonly label: string | null;
  readonly lhs: Fraction;
  readonly relation: Relation;
  readonly rhs: Fraction;
  /** Holgura (<=) o exceso (>=), siempre no negativo. */
  readonly slack: Fraction;
  /** Variación de Z por unidad de lado derecho, con su signo (WinQSB). */
  readonly shadowPrice: Fraction;
  /** Tasa de mejora de Z por unidad de lado derecho (LINDO). */
  readonly dualPrice: Fraction;
  readonly rhsIncrease: Extended;
  readonly rhsDecrease: Extended;
  readonly rhsMin: Extended;
  readonly rhsMax: Extended;
}

export interface Sensitivity {
  readonly variables: VariableSensitivity[];
  readonly constraints: ConstraintSensitivity[];
}

function isRangingColumn(t: Tableau, j: number): boolean {
  const column = t.columns[j]!;
  if (column.kind === "artificial") {
    return false;
  }
  if (column.kind === "decision" && column.sign === -1) {
    return false;
  }
  return !t.basis.includes(j);
}

function minOrInfinity(values: Fraction[]): Extended {
  if (values.length === 0) {
    return INFINITY;
  }
  return finite(values.reduce((a, b) => (b.lt(a) ? b : a)));
}

function addExtended(base: Fraction, delta: Extended, sign: 1 | -1): Extended {
  if (!delta.finite) {
    return sign === 1 ? INFINITY : { finite: false, sign: -1 };
  }
  return finite(sign === 1 ? base.add(delta.value) : base.sub(delta.value));
}

/** Rango del coeficiente de la columna básica en la fila r (forma de maximización). */
function basicCostRange(
  t: Tableau,
  r: number,
): { increase: Extended; decrease: Extended } {
  const row = t.rows[r]!;
  const up: Fraction[] = [];
  const down: Fraction[] = [];
  for (let j = 0; j < t.columns.length; j += 1) {
    if (!isRangingColumn(t, j)) {
      continue;
    }
    const a = row[j]!;
    if (a.isZero()) {
      continue;
    }
    const d = t.objectiveRow[j]!.c;
    if (a.isNegative()) {
      up.push(d.div(a.neg()));
    } else {
      down.push(d.div(a));
    }
  }
  return { increase: minOrInfinity(up), decrease: minOrInfinity(down) };
}

/** Rango del lado derecho de una fila dada la columna B^-1 e_i. */
function rhsRange(
  t: Tableau,
  column: Fraction[],
): { increase: Extended; decrease: Extended } {
  const up: Fraction[] = [];
  const down: Fraction[] = [];
  column.forEach((entry, r) => {
    if (entry.isZero()) {
      return;
    }
    const x = t.rhs[r]!;
    if (entry.isNegative()) {
      up.push(x.div(entry.neg()));
    } else {
      down.push(x.div(entry));
    }
  });
  return { increase: minOrInfinity(up), decrease: minOrInfinity(down) };
}

export function computeSensitivity(
  model: LPModel,
  sf: StandardForm,
  t: Tableau,
  solution: LPSolution,
): Sensitivity {
  const isMax = model.sense === "max";
  const variables: VariableSensitivity[] = model.variables.map((v, i) => {
    const cost = model.objective[i]!;
    const value = solution.variables[i]!.value;
    const cols = t.columns
      .map((c, j) => ({ c, j }))
      .filter(({ c }) => c.kind === "decision" && c.variableIndex === i);
    const positive = cols.find(({ c }) => c.sign === 1)!;
    const basicCol = cols.find(({ j }) => t.basis.includes(j));
    const basic = basicCol !== undefined;
    let reducedCost = Fraction.ZERO;
    let increasePrime: Extended;
    let decreasePrime: Extended;
    if (basic) {
      const r = t.basis.indexOf(basicCol.j);
      const range = basicCostRange(t, r);
      increasePrime = range.increase;
      decreasePrime = range.decrease;
    } else {
      const d = t.objectiveRow[positive.j]!.c;
      reducedCost = d;
      increasePrime = finite(d);
      decreasePrime = INFINITY;
    }
    // En minimización el coeficiente interno es -c: subir uno es bajar el otro.
    const increase = isMax ? increasePrime : decreasePrime;
    const decrease = isMax ? decreasePrime : increasePrime;
    return {
      name: v.name,
      value,
      cost,
      contribution: cost.mul(value),
      reducedCost,
      basic,
      costIncrease: increase,
      costDecrease: decrease,
      costMin: addExtended(cost, decrease, -1),
      costMax: addExtended(cost, increase, 1),
    };
  });

  const constraints: ConstraintSensitivity[] = [];
  for (const row of sf.rows) {
    if (row.constraintIndex === null) {
      continue;
    }
    const constraint = model.constraints[row.constraintIndex]!;
    const lhs = Fraction.sum(
      constraint.coefficients.map((a, i) =>
        a.mul(solution.variables[i]!.value),
      ),
    );
    let slack: Fraction;
    if (constraint.relation === "<=") {
      slack = constraint.rhs.sub(lhs);
    } else if (constraint.relation === ">=") {
      slack = lhs.sub(constraint.rhs);
    } else {
      slack = Fraction.ZERO;
    }
    // Columna B^-1 e_i: la artificial de la fila si existe, si no la holgura.
    const unitColumn = row.artificialColumn ?? row.slackColumn!;
    const column = t.rows.map((r) => r[unitColumn]!);
    const yPrime = t.objectiveRow[unitColumn]!.c;
    const flip = row.flipped ? Fraction.MINUS_ONE : Fraction.ONE;
    const shadowPrice = yPrime
      .mul(flip)
      .mul(isMax ? Fraction.ONE : Fraction.MINUS_ONE);
    const dualPrice = isMax ? shadowPrice : shadowPrice.neg();
    const range = rhsRange(t, column);
    const increase = row.flipped ? range.decrease : range.increase;
    const decrease = row.flipped ? range.increase : range.decrease;
    constraints.push({
      row: constraint.row,
      label: constraint.label,
      lhs,
      relation: constraint.relation,
      rhs: constraint.rhs,
      slack,
      shadowPrice,
      dualPrice,
      rhsIncrease: increase,
      rhsDecrease: decrease,
      rhsMin: addExtended(constraint.rhs, decrease, -1),
      rhsMax: addExtended(constraint.rhs, increase, 1),
    });
  }
  return { variables, constraints };
}
