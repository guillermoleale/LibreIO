// SPDX-License-Identifier: GPL-3.0-or-later
// Viajante: ramificación y acotamiento exacto sobre caminos parciales, con vecino más cercano
// e inserción más barata como comparación.
import { Fraction } from "../rational/Fraction";
import { allNodes, costMatrix, requireNode } from "./graph";
import type {
  HeuristicStep,
  NetworkProblem,
  TourResult,
  TspNode,
  TspResult,
} from "./types";

export const TSP_MAX_NODES = 10;
const MAX_TRACE = 4000;

type Matrix = Array<Array<Fraction | null>>;

function at(matrix: Matrix, i: number, j: number): Fraction | null {
  return matrix[i]?.[j] ?? null;
}

function tourCost(matrix: Matrix, tour: number[]): Fraction | null {
  let total = Fraction.ZERO;
  for (let k = 0; k + 1 < tour.length; k += 1) {
    const c = at(matrix, tour[k]!, tour[k + 1]!);
    if (c === null) {
      return null;
    }
    total = total.add(c);
  }
  return total;
}

function nearestNeighbor(
  matrix: Matrix,
  names: string[],
  start: number,
): TourResult | null {
  const n = names.length;
  const visited = new Set([start]);
  const tour = [start];
  const steps: HeuristicStep[] = [];
  let cost = Fraction.ZERO;
  let current = start;
  while (tour.length < n) {
    let best: number | null = null;
    for (let j = 0; j < n; j += 1) {
      const c = at(matrix, current, j);
      if (visited.has(j) || c === null) {
        continue;
      }
      if (best === null || c.lt(at(matrix, current, best)!)) {
        best = j;
      }
    }
    if (best === null) {
      return null;
    }
    cost = cost.add(at(matrix, current, best)!);
    visited.add(best);
    tour.push(best);
    steps.push({
      note: `Desde ${names[current]} el no visitado más cercano es ${names[best]} (${at(matrix, current, best)!.toString()}).`,
      tour: tour.map((i) => names[i]!),
      cost,
    });
    current = best;
  }
  const back = at(matrix, current, start);
  if (back === null) {
    return null;
  }
  cost = cost.add(back);
  tour.push(start);
  return { tour: tour.map((i) => names[i]!), cost, steps };
}

function cheapestInsertion(
  matrix: Matrix,
  names: string[],
  start: number,
): TourResult | null {
  const n = names.length;
  // Circuito inicial: el nodo de partida y su vecino más cercano
  let nearest: number | null = null;
  for (let j = 0; j < n; j += 1) {
    const c = at(matrix, start, j);
    if (
      j !== start &&
      c !== null &&
      at(matrix, j, start) !== null &&
      (nearest === null || c.lt(at(matrix, start, nearest)!))
    ) {
      nearest = j;
    }
  }
  if (nearest === null) {
    return n === 1
      ? { tour: [names[start]!, names[start]!], cost: Fraction.ZERO, steps: [] }
      : null;
  }
  const tour = [start, nearest, start];
  const steps: HeuristicStep[] = [];
  const costOf = () => tourCost(matrix, tour)!;
  steps.push({
    note: `Circuito inicial ${names[start]} -> ${names[nearest]} -> ${names[start]}.`,
    tour: tour.map((i) => names[i]!),
    cost: costOf(),
  });
  const remaining = new Set<number>();
  for (let j = 0; j < n; j += 1) {
    if (j !== start && j !== nearest) {
      remaining.add(j);
    }
  }
  while (remaining.size > 0) {
    let best: { node: number; position: number; delta: Fraction } | null = null;
    for (const k of remaining) {
      for (let p = 0; p + 1 < tour.length; p += 1) {
        const i = tour[p]!;
        const j = tour[p + 1]!;
        const cik = at(matrix, i, k);
        const ckj = at(matrix, k, j);
        const cij = at(matrix, i, j);
        if (cik === null || ckj === null || cij === null) {
          continue;
        }
        const delta = cik.add(ckj).sub(cij);
        if (best === null || delta.lt(best.delta)) {
          best = { node: k, position: p + 1, delta };
        }
      }
    }
    if (best === null) {
      return null;
    }
    tour.splice(best.position, 0, best.node);
    remaining.delete(best.node);
    steps.push({
      note: `Se inserta ${names[best.node]} entre ${names[tour[best.position - 1]!]} y ${names[tour[best.position + 1]!]} con costo adicional ${best.delta.toString()}.`,
      tour: tour.map((i) => names[i]!),
      cost: costOf(),
    });
  }
  return { tour: tour.map((i) => names[i]!), cost: costOf(), steps };
}

export function travelingSalesman(
  problem: NetworkProblem,
  start?: string,
): TspResult {
  const names = allNodes(problem);
  if (names.length > TSP_MAX_NODES) {
    throw new RangeError(
      `El viajante admite hasta ${TSP_MAX_NODES} nodos y la red tiene ${names.length}`,
    );
  }
  const first = start ?? names[0]!;
  requireNode(names, first, "El nodo de partida");
  const n = names.length;
  const matrix = costMatrix(problem, names);
  const startIndex = names.indexOf(first);
  const nn = nearestNeighbor(matrix, names, startIndex);
  const ci = cheapestInsertion(matrix, names, startIndex);
  const empty: TourResult = { tour: [], cost: Fraction.ZERO, steps: [] };

  // Cota inferior: costo parcial más el arco más barato que sale de cada nodo pendiente y del actual.
  const minOut = (
    i: number,
    allowed: (j: number) => boolean,
  ): Fraction | null => {
    let best: Fraction | null = null;
    for (let j = 0; j < n; j += 1) {
      const c = at(matrix, i, j);
      if (j === i || c === null || !allowed(j)) {
        continue;
      }
      if (best === null || c.lt(best)) {
        best = c;
      }
    }
    return best;
  };
  const nodes: TspNode[] = [];
  let explored = 0;
  let bestCost: Fraction | null = nn ? nn.cost : null;
  let bestTour: number[] | null = nn
    ? nn.tour.map((name) => names.indexOf(name))
    : null;
  let bestFromSearch = false;

  const search = (
    path: number[],
    cost: Fraction,
    parent: number | null,
  ): void => {
    explored += 1;
    const current = path[path.length - 1]!;
    const visited = new Set(path);
    const unvisited = names.map((_, j) => j).filter((j) => !visited.has(j));
    if (unvisited.length === 0) {
      const back = at(matrix, current, startIndex);
      if (back === null) {
        return;
      }
      const total = cost.add(back);
      const complete = [...path, startIndex];
      const better =
        bestCost === null ||
        total.lt(bestCost) ||
        (!bestFromSearch && total.eq(bestCost));
      if (nodes.length < MAX_TRACE) {
        nodes.push({
          id: nodes.length,
          parent,
          path: complete.map((i) => names[i]!),
          cost: total,
          bound: total,
          pruned: false,
          complete: true,
          note: better
            ? `Circuito completo con costo ${total.toString()}: nueva mejor solución.`
            : `Circuito completo con costo ${total.toString()}, no mejora.`,
        });
      }
      if (better) {
        bestCost = total;
        bestTour = complete;
        bestFromSearch = true;
      }
      return;
    }
    // cota
    let bound = cost;
    const allowedFromCurrent = (j: number) => unvisited.includes(j);
    const outCurrent = minOut(current, allowedFromCurrent);
    if (outCurrent === null) {
      return;
    }
    bound = bound.add(outCurrent);
    for (const u of unvisited) {
      const out = minOut(
        u,
        (j) =>
          (j === startIndex && unvisited.length > 0) ||
          (unvisited.includes(j) && j !== u),
      );
      if (out === null) {
        return;
      }
      bound = bound.add(out);
    }
    const id = nodes.length;
    const pruned = bestCost !== null && bound.ge(bestCost) && path.length > 1;
    if (nodes.length < MAX_TRACE) {
      nodes.push({
        id,
        parent,
        path: path.map((i) => names[i]!),
        cost,
        bound,
        pruned,
        complete: false,
        note: pruned
          ? `Cota ${bound.toString()} no mejora el mejor circuito conocido (${bestCost!.toString()}): se poda.`
          : `Camino parcial con costo ${cost.toString()} y cota ${bound.toString()}.`,
      });
    }
    if (pruned) {
      return;
    }
    const children = unvisited
      .filter((j) => at(matrix, current, j) !== null)
      .sort(
        (a, b) => at(matrix, current, a)!.cmp(at(matrix, current, b)!) || a - b,
      );
    for (const j of children) {
      search([...path, j], cost.add(at(matrix, current, j)!), id);
    }
  };
  search([startIndex], Fraction.ZERO, null);

  if (bestTour === null || bestCost === null) {
    return {
      start: first,
      status: "infeasible",
      optimal: { tour: [], cost: Fraction.ZERO, nodes, explored },
      nearestNeighbor: nn ?? empty,
      cheapestInsertion: ci ?? empty,
      messages: [
        "No existe un circuito que pase por todos los nodos con los arcos dados.",
      ],
    };
  }
  // En redes simétricas se elige la orientación cuyo segundo nodo aparece antes en la lista.
  let tour = bestTour as number[];
  if (
    !problem.directed &&
    tour.length > 3 &&
    tour[1]! > tour[tour.length - 2]!
  ) {
    tour = [...tour].reverse();
  }
  const tourNames = tour.map((i) => names[i]!);
  const finalCost = bestCost as Fraction;
  return {
    start: first,
    status: "optimal",
    optimal: { tour: tourNames, cost: finalCost, nodes, explored },
    nearestNeighbor: nn ?? empty,
    cheapestInsertion: ci ?? empty,
    messages: [
      `Circuito óptimo ${tourNames.join(" -> ")} con costo ${finalCost.toString()} (${explored} nodos explorados).`,
      nn
        ? `Vecino más cercano: ${nn.tour.join(" -> ")} con costo ${nn.cost.toString()}.`
        : "Vecino más cercano no encuentra circuito.",
      ci
        ? `Inserción más barata: ${ci.tour.join(" -> ")} con costo ${ci.cost.toString()}.`
        : "Inserción más barata no encuentra circuito.",
    ],
  };
}
