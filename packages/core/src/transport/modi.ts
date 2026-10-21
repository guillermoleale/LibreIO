// SPDX-License-Identifier: GPL-3.0-or-later
// Resolución del problema de transporte: balanceo, solución inicial, MODI con traza del ciclo
// de cada iteración, manejo de degeneración con celdas básicas en cero y sensibilidad de los costos.
import { Fraction } from "../rational/Fraction";
import { INFINITY, finite, type Extended } from "../rational/Extended";
import { MValue } from "../lp/MValue";
import {
  internalMatrix,
  minMValue,
  originalObjective,
  totalCost,
} from "./costs";
import { INITIAL_METHOD_NAMES, initialSolution } from "./initialSolution";
import type {
  Cell,
  CostRange,
  CycleCell,
  InitialMethod,
  TransportIteration,
  TransportProblem,
  TransportResult,
} from "./types";

export interface TransportOptions {
  readonly initial?: InitialMethod;
}

export const DUMMY_NAME = "Ficticio";

/** Agrega un origen o destino ficticio con costo cero cuando oferta y demanda no coinciden. */
export function balance(problem: TransportProblem): {
  problem: TransportProblem;
  balanced: TransportResult["balanced"];
  message: string | null;
} {
  const totalSupply = Fraction.sum(problem.supply);
  const totalDemand = Fraction.sum(problem.demand);
  if (totalSupply.eq(totalDemand)) {
    return { problem, balanced: null, message: null };
  }
  if (totalSupply.gt(totalDemand)) {
    const amount = totalSupply.sub(totalDemand);
    return {
      problem: {
        ...problem,
        destinations: [...problem.destinations, DUMMY_NAME],
        demand: [...problem.demand, amount],
        costs: problem.costs.map((row) => [...row, Fraction.ZERO]),
      },
      balanced: { kind: "destination", amount },
      message: `La oferta total (${totalSupply.toString()}) supera la demanda total (${totalDemand.toString()}): se agrega un destino ficticio con demanda ${amount.toString()} y costo 0.`,
    };
  }
  const amount = totalDemand.sub(totalSupply);
  return {
    problem: {
      ...problem,
      sources: [...problem.sources, DUMMY_NAME],
      supply: [...problem.supply, amount],
      costs: [...problem.costs, problem.destinations.map(() => Fraction.ZERO)],
    },
    balanced: { kind: "source", amount },
    message: `La demanda total (${totalDemand.toString()}) supera la oferta total (${totalSupply.toString()}): se agrega un origen ficticio con oferta ${amount.toString()} y costo 0.`,
  };
}

type Allocation = Array<Array<Fraction | null>>;

function basicCells(allocation: Allocation): Cell[] {
  const cells: Cell[] = [];
  allocation.forEach((row, i) =>
    row.forEach((v, j) => v !== null && cells.push({ i, j })),
  );
  return cells;
}

/** Componentes conexas del grafo bipartito filas-columnas definido por las celdas básicas. */
function components(m: number, n: number, cells: Cell[]): number[] {
  const parent = Array.from({ length: m + n }, (_, k) => k);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  };
  for (const c of cells) {
    const a = find(c.i);
    const b = find(m + c.j);
    if (a !== b) {
      parent[a] = b;
    }
  }
  return Array.from({ length: m + n }, (_, k) => find(k));
}

/** Completa la base con celdas en cero que no formen ciclo, eligiendo las de menor costo. */
function completeBasis(allocation: Allocation, costs: MValue[][]): Cell[] {
  const m = allocation.length;
  const n = allocation[0]!.length;
  const added: Cell[] = [];
  while (basicCells(allocation).length < m + n - 1) {
    const comp = components(m, n, basicCells(allocation));
    let best: Cell | null = null;
    for (let i = 0; i < m; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (allocation[i]![j] !== null || comp[i] === comp[m + j]) {
          continue;
        }
        if (best === null || costs[i]![j]!.cmp(costs[best.i]![best.j]!) < 0) {
          best = { i, j };
        }
      }
    }
    if (best === null) {
      break;
    }
    allocation[best.i]![best.j] = Fraction.ZERO;
    added.push(best);
  }
  return added;
}

/** Potenciales u_i y v_j con u_0 = 0 recorriendo el árbol de celdas básicas. */
function potentials(
  allocation: Allocation,
  costs: MValue[][],
): { u: MValue[]; v: MValue[] } {
  const m = allocation.length;
  const n = allocation[0]!.length;
  const u: Array<MValue | null> = Array.from({ length: m }, () => null);
  const v: Array<MValue | null> = Array.from({ length: n }, () => null);
  u[0] = MValue.ZERO;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < m; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (allocation[i]![j] === null) {
          continue;
        }
        if (u[i] !== null && v[j] === null) {
          v[j] = costs[i]![j]!.sub(u[i]!);
          changed = true;
        } else if (u[i] === null && v[j] !== null) {
          u[i] = costs[i]![j]!.sub(v[j]!);
          changed = true;
        }
      }
    }
  }
  return {
    u: u.map((x) => x ?? MValue.ZERO),
    v: v.map((x) => x ?? MValue.ZERO),
  };
}

/** Ciclo cerrado que empieza en la celda que entra y pasa solo por celdas básicas, con signos alternados. */
export function findCycle(
  allocation: Allocation,
  entering: Cell,
): CycleCell[] | null {
  const m = allocation.length;
  const n = allocation[0]!.length;
  const basics = basicCells(allocation);
  // Camino en el árbol de básicas desde la fila de la celda que entra hasta su columna.
  const adjacency = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    adjacency.set(a, [...(adjacency.get(a) ?? []), b]);
    adjacency.set(b, [...(adjacency.get(b) ?? []), a]);
  };
  for (const c of basics) {
    link(c.i, m + c.j);
  }
  const start = entering.i;
  const target = m + entering.j;
  const previous = new Map<number, number>();
  const queue = [start];
  const seen = new Set<number>([start]);
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node === target) {
      break;
    }
    for (const next of adjacency.get(node) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        previous.set(next, node);
        queue.push(next);
      }
    }
  }
  if (!seen.has(target)) {
    return null;
  }
  const nodes: number[] = [];
  let cursor = target;
  while (cursor !== start) {
    nodes.push(cursor);
    cursor = previous.get(cursor)!;
  }
  nodes.push(start);
  nodes.reverse();
  // nodes alterna fila, columna, fila, ... desde la fila de entrada hasta la columna de entrada.
  const cycle: CycleCell[] = [{ i: entering.i, j: entering.j, sign: 1 }];
  let sign: 1 | -1 = -1;
  for (let k = 0; k + 1 < nodes.length; k += 1) {
    const a = nodes[k]!;
    const b = nodes[k + 1]!;
    const cell = a < m ? { i: a, j: b - m } : { i: b, j: a - m };
    cycle.push({ ...cell, sign });
    sign = sign === 1 ? -1 : 1;
  }
  void n;
  return cycle;
}

function reducedCosts(
  allocation: Allocation,
  costs: MValue[][],
  u: MValue[],
  v: MValue[],
): Array<Array<MValue | null>> {
  return allocation.map((row, i) =>
    row.map((value, j) =>
      value !== null ? null : costs[i]![j]!.sub(u[i]!).sub(v[j]!),
    ),
  );
}

function cloneAllocation(allocation: Allocation): Allocation {
  return allocation.map((row) => [...row]);
}

function costSensitivity(
  allocation: Allocation,
  costs: MValue[][],
  reduced: Array<Array<MValue | null>>,
  problem: TransportProblem,
): CostRange[][] {
  const m = allocation.length;
  const n = allocation[0]!.length;
  const increase: Array<Array<MValue | null>> = allocation.map((row) =>
    row.map(() => null),
  );
  const decrease: Array<Array<MValue | null>> = allocation.map((row) =>
    row.map(() => null),
  );
  for (let k = 0; k < m; k += 1) {
    for (let l = 0; l < n; l += 1) {
      const d = reduced[k]![l];
      if (d === null || d === undefined) {
        continue;
      }
      const cycle = findCycle(allocation, { i: k, j: l });
      if (!cycle) {
        continue;
      }
      for (const cell of cycle.slice(1)) {
        const target = cell.sign === -1 ? increase : decrease;
        const current = target[cell.i]![cell.j];
        if (current === null || current === undefined || d.cmp(current) < 0) {
          target[cell.i]![cell.j] = d;
        }
      }
    }
  }
  const toExtended = (value: MValue | null | undefined): Extended => {
    if (value === null || value === undefined || !value.m.isZero()) {
      return INFINITY;
    }
    return finite(value.c);
  };
  return allocation.map((row, i) =>
    row.map((value, j) => {
      const cost = problem.costs[i]![j] ?? null;
      if (cost === null) {
        return {
          basic: value !== null,
          reducedCost: reduced[i]![j] ?? null,
          min: INFINITY,
          max: INFINITY,
        };
      }
      const basic = value !== null;
      let up: Extended;
      let down: Extended;
      if (basic) {
        up = toExtended(increase[i]![j]);
        down = toExtended(decrease[i]![j]);
      } else {
        up = INFINITY;
        down = toExtended(reduced[i]![j]);
      }
      // En maximización el costo interno es el opuesto: aumentar uno es disminuir el otro.
      if (problem.sense === "max") {
        [up, down] = [down, up];
      }
      return {
        basic,
        reducedCost: reduced[i]![j] ?? null,
        min: down.finite
          ? finite(cost.sub(down.value))
          : { finite: false, sign: -1 },
        max: up.finite ? finite(cost.add(up.value)) : INFINITY,
      };
    }),
  );
}

export function solveTransport(
  original: TransportProblem,
  options: TransportOptions = {},
): TransportResult {
  const method = options.initial ?? "vogel";
  const messages: string[] = [];
  const { problem, balanced, message } = balance(original);
  if (message) {
    messages.push(message);
  }
  const costs = internalMatrix(problem.costs, problem.sense);
  const initial = initialSolution(problem, method);
  messages.push(
    `Solución inicial por ${INITIAL_METHOD_NAMES[method]} con costo ${originalObjective(initial.cost, problem.sense).toString()}.`,
  );
  const m = problem.sources.length;
  const n = problem.destinations.length;
  let allocation = cloneAllocation(initial.allocation);
  let degenerate = initial.degenerate;
  const iterations: TransportIteration[] = [];
  const addedInitially = completeBasis(allocation, costs);
  if (addedInitially.length > 0) {
    degenerate = true;
    messages.push(
      `La solución inicial es degenerada: tiene ${initial.basicCount} celdas básicas de ${m + n - 1}. Se agregan con asignación cero ${addedInitially
        .map((c) => `(${problem.sources[c.i]}, ${problem.destinations[c.j]})`)
        .join(", ")}.`,
    );
  }
  let pendingZeros = addedInitially;
  for (let iteration = 0; iteration < 500; iteration += 1) {
    const { u, v } = potentials(allocation, costs);
    const reduced = reducedCosts(allocation, costs, u, v);
    const cost = totalCost(costs, allocation);
    let entering: Cell | null = null;
    for (let i = 0; i < m; i += 1) {
      for (let j = 0; j < n; j += 1) {
        const d = reduced[i]![j];
        if (
          d !== null &&
          d !== undefined &&
          d.isNegative() &&
          (entering === null || d.cmp(reduced[entering.i]![entering.j]!) < 0)
        ) {
          entering = { i, j };
        }
      }
    }
    if (entering === null) {
      iterations.push({
        index: iteration,
        allocation: cloneAllocation(allocation),
        u,
        v,
        reducedCosts: reduced,
        cost: originalObjective(cost, problem.sense),
        entering: null,
        cycle: null,
        theta: null,
        leaving: null,
        addedZeros: pendingZeros,
        note: "Ningún costo reducido es negativo: la solución es óptima.",
      });
      break;
    }
    const cycle = findCycle(allocation, entering)!;
    const minus = cycle.filter((c) => c.sign === -1);
    let leaving = minus[0]!;
    for (const c of minus) {
      if (allocation[c.i]![c.j]!.lt(allocation[leaving.i]![leaving.j]!)) {
        leaving = c;
      }
    }
    const theta = allocation[leaving.i]![leaving.j]!;
    const enteringName = `(${problem.sources[entering.i]}, ${problem.destinations[entering.j]})`;
    const leavingName = `(${problem.sources[leaving.i]}, ${problem.destinations[leaving.j]})`;
    iterations.push({
      index: iteration,
      allocation: cloneAllocation(allocation),
      u,
      v,
      reducedCosts: reduced,
      cost: originalObjective(cost, problem.sense),
      entering,
      cycle,
      theta,
      leaving,
      addedZeros: pendingZeros,
      note: `Entra ${enteringName} con costo reducido ${reduced[entering.i]![entering.j]!.toString()}. El ciclo tiene ${cycle.length} celdas; θ = ${theta.toString()} y sale ${leavingName}.${theta.isZero() ? " Pivote degenerado: el costo no cambia." : ""}`,
    });
    pendingZeros = [];
    const next = cloneAllocation(allocation);
    for (const c of cycle) {
      const current = next[c.i]![c.j] ?? Fraction.ZERO;
      next[c.i]![c.j] = c.sign === 1 ? current.add(theta) : current.sub(theta);
    }
    next[leaving.i]![leaving.j] = null;
    if (theta.isZero()) {
      degenerate = true;
    }
    allocation = next;
  }
  const last = iterations[iterations.length - 1]!;
  const finalCost = totalCost(costs, allocation);
  const objective = originalObjective(finalCost, problem.sense);
  const status = finalCost.m.isZero() ? "optimal" : "infeasible";
  if (status === "infeasible") {
    messages.push(
      "La solución usa rutas prohibidas: no existe una asignación factible sin ellas.",
    );
  }
  const zeroBasics = basicCells(allocation).filter((c) =>
    allocation[c.i]![c.j]!.isZero(),
  );
  if (zeroBasics.length > 0) {
    degenerate = true;
    messages.push(
      `La solución óptima es degenerada: ${zeroBasics.map((c) => `(${problem.sources[c.i]}, ${problem.destinations[c.j]})`).join(", ")} ${zeroBasics.length === 1 ? "es básica" : "son básicas"} con valor cero.`,
    );
  }
  messages.push(
    `Óptimo con MODI en ${iterations.length - 1} iteraciones. Costo total ${objective.toString()}.`,
  );
  return {
    original,
    problem,
    balanced,
    initial,
    iterations,
    status,
    allocation,
    objective,
    sensitivity: costSensitivity(allocation, costs, last.reducedCosts, problem),
    degenerate,
    messages,
  };
}

export { minMValue };
