// SPDX-License-Identifier: GPL-3.0-or-later
// Tableau del simplex con fila objetivo en coeficientes aM + b y operaciones de pivoteo.
import { Fraction } from "../rational/Fraction";
import { MValue } from "./MValue";
import type { Column, StandardForm } from "./standardForm";

export type Phase = "phase1" | "phase2" | "bigM";
export type SimplexMethod = "twoPhase" | "bigM";
export type EnteringRule = "dantzig" | "bland";

export interface Tableau {
  readonly columns: Column[];
  /** Columna básica de cada fila. */
  readonly basis: number[];
  readonly rows: Fraction[][];
  readonly rhs: Fraction[];
  /** Costos reducidos z_j - c_j de la forma de maximización. Óptimo cuando ninguno es negativo. */
  readonly objectiveRow: MValue[];
  /** Valor actual de la función objetivo en forma de maximización. */
  readonly objectiveValue: MValue;
  readonly phase: Phase;
}

export interface PivotAnalysis {
  readonly kind: "pivot";
  readonly entering: number;
  readonly pivotRow: number;
  readonly leaving: number;
  readonly ratios: Array<Fraction | null>;
  readonly tiedRows: number[];
}

export type Analysis =
  | { readonly kind: "optimal" }
  | {
      readonly kind: "unbounded";
      readonly entering: number;
      readonly ratios: Array<Fraction | null>;
    }
  | PivotAnalysis;

/** Fila objetivo en forma canónica para los costos dados: z_j - c_j y el valor de Z. */
export function canonicalObjective(
  rows: Fraction[][],
  rhs: Fraction[],
  basis: number[],
  costs: MValue[],
): { objectiveRow: MValue[]; objectiveValue: MValue } {
  const n = costs.length;
  const objectiveRow: MValue[] = [];
  for (let j = 0; j < n; j += 1) {
    let z = MValue.ZERO;
    basis.forEach((col, i) => {
      const a = rows[i]![j]!;
      if (!a.isZero()) {
        z = z.add(costs[col]!.mulFraction(a));
      }
    });
    objectiveRow.push(z.sub(costs[j]!));
  }
  let objectiveValue = MValue.ZERO;
  basis.forEach((col, i) => {
    objectiveValue = objectiveValue.add(costs[col]!.mulFraction(rhs[i]!));
  });
  return { objectiveRow, objectiveValue };
}

/** Costos de cada columna según la fase: fase 1 minimiza la suma de artificiales, Big M las penaliza con M. */
export function phaseCosts(sf: StandardForm, phase: Phase): MValue[] {
  return sf.columns.map((col, j) => {
    if (col.kind === "artificial") {
      if (phase === "phase1") {
        return MValue.constant(Fraction.MINUS_ONE);
      }
      if (phase === "bigM") {
        return MValue.of(Fraction.MINUS_ONE, Fraction.ZERO);
      }
      return MValue.ZERO;
    }
    return phase === "phase1" ? MValue.ZERO : MValue.constant(sf.c[j]!);
  });
}

export function initialTableau(
  sf: StandardForm,
  method: SimplexMethod,
): Tableau {
  const phase: Phase =
    method === "bigM" ? "bigM" : sf.hasArtificials ? "phase1" : "phase2";
  const rows = sf.A.map((r) => [...r]);
  const rhs = [...sf.b];
  const basis = [...sf.initialBasis];
  const { objectiveRow, objectiveValue } = canonicalObjective(
    rows,
    rhs,
    basis,
    phaseCosts(sf, phase),
  );
  return {
    columns: sf.columns,
    basis,
    rows,
    rhs,
    objectiveRow,
    objectiveValue,
    phase,
  };
}

/** Recalcula la fila objetivo con otros costos (paso de la fase 1 a la fase 2). */
export function withObjective(
  t: Tableau,
  costs: MValue[],
  phase: Phase,
): Tableau {
  const { objectiveRow, objectiveValue } = canonicalObjective(
    t.rows,
    t.rhs,
    t.basis,
    costs,
  );
  return { ...t, objectiveRow, objectiveValue, phase };
}

export function isBasic(t: Tableau, col: number): boolean {
  return t.basis.includes(col);
}

/** Una columna puede entrar si no es básica ni artificial. */
export function isEligible(t: Tableau, col: number): boolean {
  return t.columns[col]!.kind !== "artificial" && !isBasic(t, col);
}

export function ratios(t: Tableau, col: number): Array<Fraction | null> {
  return t.rows.map((row, i) => {
    const a = row[col]!;
    return a.isPositive() ? t.rhs[i]!.div(a) : null;
  });
}

export function chooseEntering(t: Tableau, rule: EnteringRule): number | null {
  let best: number | null = null;
  for (let j = 0; j < t.columns.length; j += 1) {
    if (!isEligible(t, j)) {
      continue;
    }
    const d = t.objectiveRow[j]!;
    if (!d.isNegative()) {
      continue;
    }
    if (rule === "bland") {
      return j;
    }
    if (best === null || d.cmp(t.objectiveRow[best]!) < 0) {
      best = j;
    }
  }
  return best;
}

/** Fila de la razón mínima; ante empate, la de menor índice. */
export function chooseLeaving(
  r: Array<Fraction | null>,
): { pivotRow: number; tiedRows: number[] } | null {
  let min: Fraction | null = null;
  let pivotRow = -1;
  r.forEach((value, i) => {
    if (value !== null && (min === null || value.lt(min))) {
      min = value;
      pivotRow = i;
    }
  });
  if (min === null) {
    return null;
  }
  const best = min as Fraction;
  const tiedRows = r
    .map((value, i) => (value !== null && value.eq(best) ? i : -1))
    .filter((i) => i >= 0);
  return { pivotRow, tiedRows: tiedRows.length > 1 ? tiedRows : [] };
}

export function analyzeTableau(t: Tableau, rule: EnteringRule): Analysis {
  const entering = chooseEntering(t, rule);
  if (entering === null) {
    return { kind: "optimal" };
  }
  const r = ratios(t, entering);
  const leaving = chooseLeaving(r);
  if (leaving === null) {
    return { kind: "unbounded", entering, ratios: r };
  }
  return {
    kind: "pivot",
    entering,
    pivotRow: leaving.pivotRow,
    leaving: t.basis[leaving.pivotRow]!,
    ratios: r,
    tiedRows: leaving.tiedRows,
  };
}

/** Pivotea sobre (fila, columna) y devuelve un tableau nuevo. */
export function pivot(t: Tableau, pivotRow: number, col: number): Tableau {
  const pivotValue = t.rows[pivotRow]![col]!;
  if (pivotValue.isZero()) {
    throw new RangeError("El elemento pivote es cero");
  }
  const newPivotRow = t.rows[pivotRow]!.map((a) => a.div(pivotValue));
  const newPivotRhs = t.rhs[pivotRow]!.div(pivotValue);
  const rows = t.rows.map((row, i) => {
    if (i === pivotRow) {
      return newPivotRow;
    }
    const factor = row[col]!;
    if (factor.isZero()) {
      return row;
    }
    return row.map((a, j) => a.sub(factor.mul(newPivotRow[j]!)));
  });
  const rhs = t.rhs.map((value, i) => {
    if (i === pivotRow) {
      return newPivotRhs;
    }
    const factor = t.rows[i]![col]!;
    return factor.isZero() ? value : value.sub(factor.mul(newPivotRhs));
  });
  const d = t.objectiveRow[col]!;
  const objectiveRow = t.objectiveRow.map((value, j) =>
    value.sub(d.mulFraction(newPivotRow[j]!)),
  );
  const objectiveValue = t.objectiveValue.sub(d.mulFraction(newPivotRhs));
  const basis = [...t.basis];
  basis[pivotRow] = col;
  return { ...t, basis, rows, rhs, objectiveRow, objectiveValue };
}

export function columnIndexByName(t: Tableau, name: string): number {
  const target = name.trim().toUpperCase();
  return t.columns.findIndex((c) => c.name.toUpperCase() === target);
}

export function basicNames(t: Tableau): string[] {
  return t.basis.map((col) => t.columns[col]!.name);
}
