// SPDX-License-Identifier: GPL-3.0-or-later
// Álgebra lineal exacta sobre fracciones: producto, eliminación gaussiana e inversa.
import { Fraction } from "../rational/Fraction";

export type Matrix = Fraction[][];

export function identity(n: number): Matrix {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j ? Fraction.ONE : Fraction.ZERO,
    ),
  );
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  const n = a.length;
  const m = b[0]?.length ?? 0;
  const k = b.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: m }, (_, j) => {
      let sum = Fraction.ZERO;
      for (let l = 0; l < k; l += 1) {
        const x = a[i]![l]!;
        if (!x.isZero()) {
          sum = sum.add(x.mul(b[l]![j]!));
        }
      }
      return sum;
    }),
  );
}

export function vectorTimesMatrix(v: Fraction[], a: Matrix): Fraction[] {
  const m = a[0]?.length ?? 0;
  return Array.from({ length: m }, (_, j) => {
    let sum = Fraction.ZERO;
    v.forEach((x, i) => {
      if (!x.isZero()) {
        sum = sum.add(x.mul(a[i]![j]!));
      }
    });
    return sum;
  });
}

/** Resuelve A x = b por eliminación gaussiana con pivoteo. Devuelve null si el sistema es singular. */
export function solve(a: Matrix, b: Fraction[]): Fraction[] | null {
  const n = a.length;
  const rows: Fraction[][] = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col += 1) {
    let pivot = -1;
    for (let r = col; r < n; r += 1) {
      if (!rows[r]![col]!.isZero()) {
        pivot = r;
        break;
      }
    }
    if (pivot < 0) {
      return null;
    }
    if (pivot !== col) {
      const tmp = rows[col]!;
      rows[col] = rows[pivot]!;
      rows[pivot] = tmp;
    }
    const p = rows[col]![col]!;
    rows[col] = rows[col]!.map((x) => x.div(p));
    for (let r = 0; r < n; r += 1) {
      if (r === col) {
        continue;
      }
      const factor = rows[r]![col]!;
      if (factor.isZero()) {
        continue;
      }
      rows[r] = rows[r]!.map((x, j) => x.sub(factor.mul(rows[col]![j]!)));
    }
  }
  return rows.map((row) => row[n]!);
}

/** Inversa de una matriz cuadrada, o null si es singular. */
export function inverse(a: Matrix): Matrix | null {
  const n = a.length;
  const columns: Fraction[][] = [];
  for (let j = 0; j < n; j += 1) {
    const e = Array.from({ length: n }, (_, i) =>
      i === j ? Fraction.ONE : Fraction.ZERO,
    );
    const x = solve(a, e);
    if (x === null) {
      return null;
    }
    columns.push(x);
  }
  return Array.from({ length: n }, (_, i) => columns.map((c) => c[i]!));
}
