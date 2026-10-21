// SPDX-License-Identifier: GPL-3.0-or-later
// Cadenas de Markov con aritmética exacta: clasificación de estados, distribución en n pasos,
// estado estable, tiempos medios de primer paso y de recurrencia, y análisis de estados absorbentes.
import { Fraction } from "../rational/Fraction";
import {
  identity,
  inverse,
  multiply,
  solve,
  vectorTimesMatrix,
  type Matrix,
} from "./linear";
import type {
  AbsorbingAnalysis,
  CommunicationClass,
  MarkovProblem,
  MarkovResult,
} from "./types";

function validate(problem: MarkovProblem): void {
  const n = problem.states.length;
  if (n === 0) {
    throw new RangeError("La cadena necesita al menos un estado");
  }
  if (
    problem.matrix.length !== n ||
    problem.matrix.some((row) => row.length !== n)
  ) {
    throw new RangeError(
      `La matriz de transición debe ser cuadrada de ${n} por ${n}`,
    );
  }
  problem.matrix.forEach((row, i) => {
    if (row.some((p) => p.isNegative())) {
      throw new RangeError(
        `La fila ${problem.states[i]} tiene probabilidades negativas`,
      );
    }
    if (!Fraction.sum(row).eq(Fraction.ONE)) {
      throw new RangeError(`La fila ${problem.states[i]} no suma 1`);
    }
  });
  const names = new Set(problem.states);
  if (names.size !== n) {
    throw new RangeError("Hay estados con el mismo nombre");
  }
}

/** Alcanzabilidad por clausura transitiva (incluye alcanzar el propio estado en cero pasos). */
function reachability(matrix: Matrix): boolean[][] {
  const n = matrix.length;
  const reach = matrix.map((row, i) =>
    row.map((p, j) => i === j || p.isPositive()),
  );
  for (let k = 0; k < n; k += 1) {
    for (let i = 0; i < n; i += 1) {
      if (!reach[i]![k]) {
        continue;
      }
      for (let j = 0; j < n; j += 1) {
        if (reach[k]![j]) {
          reach[i]![j] = true;
        }
      }
    }
  }
  return reach;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

/** Período de una clase cerrada: mcd de (nivel(u) + 1 - nivel(v)) sobre los arcos internos, con niveles por anchura. */
function classPeriod(matrix: Matrix, members: number[]): number {
  const inClass = new Set(members);
  const start = members[0]!;
  const level = new Map<number, number>([[start, 0]]);
  const queue = [start];
  while (queue.length > 0) {
    const u = queue.shift()!;
    matrix[u]!.forEach((p, v) => {
      if (p.isPositive() && inClass.has(v) && !level.has(v)) {
        level.set(v, level.get(u)! + 1);
        queue.push(v);
      }
    });
  }
  let period = 0;
  for (const u of members) {
    matrix[u]!.forEach((p, v) => {
      if (p.isPositive() && inClass.has(v)) {
        period = gcd(period, level.get(u)! + 1 - level.get(v)!);
      }
    });
  }
  return period === 0 ? 1 : period;
}

export function markovChain(problem: MarkovProblem): MarkovResult {
  validate(problem);
  const { states, matrix } = problem;
  const n = states.length;
  const reach = reachability(matrix);

  // Clases de comunicación: i y j se comunican si cada uno alcanza al otro
  const assigned = new Map<number, number>();
  const groups: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    if (assigned.has(i)) {
      continue;
    }
    const members: number[] = [];
    for (let j = 0; j < n; j += 1) {
      if (!assigned.has(j) && reach[i]![j] && reach[j]![i]) {
        members.push(j);
        assigned.set(j, groups.length);
      }
    }
    groups.push(members);
  }
  const classes: CommunicationClass[] = groups.map((members) => {
    const inClass = new Set(members);
    const recurrent = members.every((i) =>
      matrix[i]!.every((p, j) => !p.isPositive() || inClass.has(j)),
    );
    return { states: members.map((i) => states[i]!), recurrent };
  });
  const absorbingStates = states.filter((_, i) =>
    matrix[i]![i]!.eq(Fraction.ONE),
  );
  const recurrentIndices = new Set<number>();
  groups.forEach((members, k) => {
    if (classes[k]!.recurrent) {
      members.forEach((i) => recurrentIndices.add(i));
    }
  });
  const transientStates = states.filter((_, i) => !recurrentIndices.has(i));
  const recurrentStates = states.filter((_, i) => recurrentIndices.has(i));
  const irreducible = groups.length === 1;
  const period = irreducible ? classPeriod(matrix, groups[0]!) : null;
  const periodic = irreducible && period !== null && period > 1;
  const regular = irreducible && period === 1;

  // Distribución estacionaria: π (P - I) = 0 con Σ π = 1, reemplazando la última ecuación por la suma
  let stationary: Fraction[] | null = null;
  if (irreducible) {
    const system: Matrix = Array.from({ length: n }, (_, eq) =>
      Array.from({ length: n }, (_, j) => {
        if (eq === n - 1) {
          return Fraction.ONE;
        }
        return matrix[j]![eq]!.sub(eq === j ? Fraction.ONE : Fraction.ZERO);
      }),
    );
    const rhs = Array.from({ length: n }, (_, eq) =>
      eq === n - 1 ? Fraction.ONE : Fraction.ZERO,
    );
    stationary = solve(system, rhs);
  }
  const steadyState = regular ? stationary : null;

  // Tiempos medios de primer paso: m_ij = 1 + Σ_{k≠j} p_ik m_kj, y m_jj = 1 / π_j
  let meanFirstPassage: Fraction[][] | null = null;
  let recurrenceTimes: Fraction[] | null = null;
  if (irreducible && stationary !== null) {
    const pi = stationary;
    meanFirstPassage = states.map(() => states.map(() => Fraction.ZERO));
    for (let j = 0; j < n; j += 1) {
      const others = states.map((_, i) => i).filter((i) => i !== j);
      const system: Matrix = others.map((i) =>
        others.map((k) =>
          (i === k ? Fraction.ONE : Fraction.ZERO).sub(matrix[i]![k]!),
        ),
      );
      const rhs = others.map(() => Fraction.ONE);
      const m = solve(system, rhs);
      if (m === null) {
        meanFirstPassage = null;
        break;
      }
      others.forEach((i, idx) => {
        meanFirstPassage![i]![j] = m[idx]!;
      });
      meanFirstPassage[j]![j] = Fraction.ONE.div(pi[j]!);
    }
    if (meanFirstPassage !== null) {
      recurrenceTimes = states.map((_, i) => meanFirstPassage![i]![i]!);
    }
  }

  // Estados absorbentes: Q, R, N = (I - Q)^-1, B = N R
  let absorbing: AbsorbingAnalysis | null = null;
  if (absorbingStates.length > 0 && transientStates.length > 0) {
    const transientIdx = states
      .map((_, i) => i)
      .filter((i) => !recurrentIndices.has(i));
    const absorbingIdx = states
      .map((_, i) => i)
      .filter((i) => matrix[i]![i]!.eq(Fraction.ONE));
    const Q = transientIdx.map((i) => transientIdx.map((k) => matrix[i]![k]!));
    const R = transientIdx.map((i) => absorbingIdx.map((k) => matrix[i]![k]!));
    const iMinusQ = identity(Q.length).map((row, i) =>
      row.map((x, k) => x.sub(Q[i]![k]!)),
    );
    const N = inverse(iMinusQ);
    if (N !== null) {
      const B = multiply(N, R);
      const expectedSteps = N.map((row) => Fraction.sum(row));
      absorbing = {
        transient: transientIdx.map((i) => states[i]!),
        absorbing: absorbingIdx.map((i) => states[i]!),
        Q,
        R,
        N,
        B,
        expectedSteps,
      };
    }
  }

  const powers: Matrix[] = [identity(n), matrix.map((row) => [...row])];
  const power = (k: number): Matrix => {
    if (k < 0 || !Number.isInteger(k)) {
      throw new RangeError(
        "La cantidad de pasos debe ser un entero no negativo",
      );
    }
    while (powers.length <= k) {
      powers.push(multiply(powers[powers.length - 1]!, matrix));
    }
    return powers[k]!;
  };
  const distributionAfter = (initial: Fraction[], k: number): Fraction[] => {
    if (initial.length !== n) {
      throw new RangeError(
        "La distribución inicial debe tener una probabilidad por estado",
      );
    }
    return k === 0 ? [...initial] : vectorTimesMatrix(initial, power(k));
  };

  const messages: string[] = [];
  messages.push(
    `Clases de comunicación: ${classes.map((c) => `{${c.states.join(", ")}} ${c.recurrent ? "recurrente" : "transitoria"}`).join("; ")}.`,
  );
  if (absorbingStates.length > 0) {
    messages.push(`Estados absorbentes: ${absorbingStates.join(", ")}.`);
  }
  if (regular) {
    messages.push(
      `La cadena es regular (irreducible y aperiódica): tiene estado estable (${stationary!.map((p) => p.toString()).join(", ")}).`,
    );
  } else if (periodic) {
    messages.push(
      `La cadena es irreducible pero periódica con período ${period}: no converge a un estado estable, aunque tiene distribución estacionaria (${stationary!.map((p) => p.toString()).join(", ")}).`,
    );
  } else if (!irreducible) {
    messages.push(
      "La cadena no es irreducible: no hay un único estado estable para todos los estados iniciales.",
    );
  }
  if (absorbing) {
    messages.push(
      `Pasos esperados hasta la absorción: ${absorbing.transient.map((s, i) => `desde ${s} ${absorbing!.expectedSteps[i]!.toString()}`).join(", ")}.`,
    );
  }
  return {
    problem,
    states,
    matrix,
    classes,
    absorbingStates,
    transientStates,
    recurrentStates,
    irreducible,
    period,
    periodic,
    regular,
    stationary,
    steadyState,
    meanFirstPassage,
    recurrenceTimes,
    absorbing,
    distributionAfter,
    power,
    messages,
  };
}
