// SPDX-License-Identifier: GPL-3.0-or-later
// Costos internos en forma de minimización: las rutas prohibidas valen M y en maximización se cambia el signo.
import { Fraction } from "../rational/Fraction";
import { MValue } from "../lp/MValue";
import type { Sense } from "./types";

export function internalCost(cost: Fraction | null, sense: Sense): MValue {
  if (cost === null) {
    return MValue.M;
  }
  return MValue.constant(sense === "max" ? cost.neg() : cost);
}

export function internalMatrix(
  costs: Array<Array<Fraction | null>>,
  sense: Sense,
): MValue[][] {
  return costs.map((row) => row.map((c) => internalCost(c, sense)));
}

/** Valor objetivo en el sentido original a partir del total en forma de minimización. */
export function originalObjective(total: MValue, sense: Sense): MValue {
  return sense === "max" ? total.neg() : total;
}

export function totalCost(
  matrix: MValue[][],
  allocation: Array<Array<Fraction | null>>,
): MValue {
  let total = MValue.ZERO;
  allocation.forEach((row, i) =>
    row.forEach((value, j) => {
      if (value !== null && !value.isZero()) {
        total = total.add(matrix[i]![j]!.mulFraction(value));
      }
    }),
  );
  return total;
}

export function minMValue(values: Array<MValue | null>): MValue | null {
  let best: MValue | null = null;
  for (const v of values) {
    if (v !== null && (best === null || v.cmp(best) < 0)) {
      best = v;
    }
  }
  return best;
}
