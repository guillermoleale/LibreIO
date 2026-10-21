// SPDX-License-Identifier: GPL-3.0-or-later
// Árbol de expansión mínima por Kruskal y por Prim con la traza de cada decisión.
import { Fraction } from "../rational/Fraction";
import { allNodes, requireNode } from "./graph";
import type {
  Arc,
  NetworkProblem,
  SpanningTreeResult,
  SpanningTreeStep,
} from "./types";

export function minimumSpanningTree(
  problem: NetworkProblem,
  method: "kruskal" | "prim",
  start?: string,
): SpanningTreeResult {
  const nodes = allNodes(problem);
  const edges = problem.arcs;
  const steps: SpanningTreeStep[] = [];
  const chosen: Arc[] = [];
  if (method === "kruskal") {
    const parent = new Map(nodes.map((n) => [n, n]));
    const find = (x: string): string => {
      let r = x;
      while (parent.get(r) !== r) {
        r = parent.get(r)!;
      }
      return r;
    };
    const sorted = edges
      .map((e, i) => ({ e, i }))
      .sort((a, b) => a.e.weight.cmp(b.e.weight) || a.i - b.i);
    for (const { e } of sorted) {
      const a = find(e.from);
      const b = find(e.to);
      const accepted = a !== b;
      if (accepted) {
        parent.set(a, b);
        chosen.push(e);
      }
      const connected = nodes.filter((n) => find(n) === find(e.from));
      steps.push({
        index: steps.length,
        edge: e,
        accepted,
        note: accepted
          ? `Se acepta ${e.from}${e.to} (${e.weight.toString()}): une dos componentes distintas.`
          : `Se rechaza ${e.from}${e.to} (${e.weight.toString()}): cierra un ciclo porque ${e.from} y ${e.to} ya están conectados.`,
        treeNodes: connected,
      });
    }
  } else {
    const first = start ?? nodes[0]!;
    requireNode(nodes, first, "El nodo inicial");
    const inTree = new Set([first]);
    steps.push({
      index: 0,
      edge: { from: first, to: first, weight: Fraction.ZERO },
      accepted: false,
      note: `Se parte del nodo ${first}.`,
      treeNodes: [first],
    });
    while (inTree.size < nodes.length) {
      let best: Arc | null = null;
      let bestOutside: string | null = null;
      for (const e of edges) {
        const candidates: Array<[string, string]> = problem.directed
          ? [[e.from, e.to]]
          : [
              [e.from, e.to],
              [e.to, e.from],
            ];
        for (const [a, b] of candidates) {
          if (
            inTree.has(a) &&
            !inTree.has(b) &&
            (best === null || e.weight.lt(best.weight))
          ) {
            best = e;
            bestOutside = b;
          }
        }
      }
      if (best === null || bestOutside === null) {
        break;
      }
      inTree.add(bestOutside);
      chosen.push(best);
      steps.push({
        index: steps.length,
        edge: best,
        accepted: true,
        note: `Se agrega la arista más barata que sale del árbol {${[...inTree].filter((n) => n !== bestOutside).join(", ")}}: ${best.from}${best.to} (${best.weight.toString()}), que incorpora ${bestOutside}.`,
        treeNodes: [...inTree],
      });
    }
  }
  const cost = Fraction.sum(chosen.map((e) => e.weight));
  const connected = chosen.length === nodes.length - 1;
  return {
    method,
    edges: chosen,
    cost,
    connected,
    steps,
    messages: [
      `Árbol de expansión mínima por ${method === "kruskal" ? "Kruskal" : "Prim"} con costo ${cost.toString()}: ${chosen.map((e) => `${e.from}${e.to}`).join(", ")}.`,
      ...(connected
        ? []
        : [
            "La red no es conexa: el resultado es un bosque de expansión mínima.",
          ]),
    ],
  };
}
