// SPDX-License-Identifier: GPL-3.0-or-later
// Utilidades comunes: lista de nodos, adyacencia y matriz de costos.
import type { Fraction } from "../rational/Fraction";
import type { Arc, NetworkProblem } from "./types";

/** Nodos declarados más los que aparecen en los arcos, en orden de aparición. */
export function allNodes(problem: NetworkProblem): string[] {
  const nodes = [...problem.nodes];
  for (const arc of problem.arcs) {
    if (!nodes.includes(arc.from)) {
      nodes.push(arc.from);
    }
    if (!nodes.includes(arc.to)) {
      nodes.push(arc.to);
    }
  }
  return nodes;
}

export interface Neighbor {
  readonly node: string;
  readonly weight: Fraction;
  readonly arc: Arc;
}

export function adjacency(problem: NetworkProblem): Map<string, Neighbor[]> {
  const map = new Map<string, Neighbor[]>();
  for (const node of allNodes(problem)) {
    map.set(node, []);
  }
  for (const arc of problem.arcs) {
    map.get(arc.from)!.push({ node: arc.to, weight: arc.weight, arc });
    if (!problem.directed) {
      map.get(arc.to)!.push({ node: arc.from, weight: arc.weight, arc });
    }
  }
  return map;
}

/** Matriz de costos entre nodos; null cuando no hay arco. Con arcos repetidos se queda el más barato. */
export function costMatrix(
  problem: NetworkProblem,
  nodes: string[],
): Array<Array<Fraction | null>> {
  const index = new Map(nodes.map((n, i) => [n, i]));
  const matrix: Array<Array<Fraction | null>> = nodes.map(() =>
    nodes.map(() => null),
  );
  const set = (a: string, b: string, w: Fraction) => {
    const i = index.get(a)!;
    const j = index.get(b)!;
    const current = matrix[i]![j] ?? null;
    if (current === null || w.lt(current)) {
      matrix[i]![j] = w;
    }
  };
  for (const arc of problem.arcs) {
    set(arc.from, arc.to, arc.weight);
    if (!problem.directed) {
      set(arc.to, arc.from, arc.weight);
    }
  }
  return matrix;
}

export function requireNode(nodes: string[], node: string, what: string): void {
  if (!nodes.includes(node)) {
    throw new RangeError(`${what} '${node}' no está en la red`);
  }
}
