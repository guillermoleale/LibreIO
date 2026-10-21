// SPDX-License-Identifier: GPL-3.0-or-later
// Camino mínimo con Dijkstra y traza de etiquetas temporales y permanentes.
import { Fraction } from "../rational/Fraction";
import { adjacency, allNodes, requireNode } from "./graph";
import type {
  Arc,
  DijkstraStep,
  Label,
  NetworkProblem,
  ShortestPathResult,
} from "./types";

interface LabelState {
  distance: Fraction | null;
  predecessor: string | null;
  arc: Arc | null;
  permanent: boolean;
}

export function shortestPath(
  problem: NetworkProblem,
  source: string,
  target: string,
): ShortestPathResult {
  const nodes = allNodes(problem);
  requireNode(nodes, source, "El origen");
  requireNode(nodes, target, "El destino");
  if (problem.arcs.some((a) => a.weight.isNegative())) {
    throw new RangeError("Dijkstra no admite arcos con peso negativo");
  }
  const adj = adjacency(problem);
  const labels = new Map<string, LabelState>();
  for (const n of nodes) {
    labels.set(n, {
      distance: null,
      predecessor: null,
      arc: null,
      permanent: false,
    });
  }
  labels.set(source, {
    distance: Fraction.ZERO,
    predecessor: null,
    arc: null,
    permanent: false,
  });
  const steps: DijkstraStep[] = [];
  const snapshot = (): Record<string, Label> =>
    Object.fromEntries(
      nodes.map((n) => [
        n,
        {
          distance: labels.get(n)!.distance,
          predecessor: labels.get(n)!.predecessor,
          permanent: labels.get(n)!.permanent,
        },
      ]),
    );
  let status: "optimal" | "unreachable" = "unreachable";
  for (let guard = 0; guard < nodes.length; guard += 1) {
    let chosen: string | null = null;
    for (const n of nodes) {
      const l = labels.get(n)!;
      if (l.permanent || l.distance === null) {
        continue;
      }
      if (chosen === null || l.distance.lt(labels.get(chosen)!.distance!)) {
        chosen = n;
      }
    }
    if (chosen === null) {
      break;
    }
    const current = labels.get(chosen)!;
    current.permanent = true;
    const relaxed: string[] = [];
    for (const nb of adj.get(chosen) ?? []) {
      const l = labels.get(nb.node)!;
      if (l.permanent) {
        continue;
      }
      const candidate = current.distance!.add(nb.weight);
      if (l.distance === null || candidate.lt(l.distance)) {
        l.distance = candidate;
        l.predecessor = chosen;
        l.arc = nb.arc;
        relaxed.push(`${nb.node} = ${candidate.toString()}`);
      }
    }
    steps.push({
      index: steps.length,
      settled: chosen,
      distance: current.distance!,
      labels: snapshot(),
      note: `Se hace permanente ${chosen} con distancia ${current.distance!.toString()}.${relaxed.length > 0 ? ` Etiquetas temporales actualizadas: ${relaxed.join(", ")}.` : " Ninguna etiqueta mejora."}`,
    });
    if (chosen === target) {
      status = "optimal";
      break;
    }
  }
  const path: string[] = [];
  const pathArcs: Arc[] = [];
  if (status === "optimal") {
    let cursor: string | null = target;
    while (cursor !== null) {
      path.unshift(cursor);
      const l: LabelState = labels.get(cursor)!;
      if (l.arc) {
        pathArcs.unshift(l.arc);
      }
      cursor = l.predecessor;
    }
  }
  const distance = status === "optimal" ? labels.get(target)!.distance : null;
  return {
    source,
    target,
    status,
    distance,
    path,
    pathArcs,
    labels: snapshot(),
    steps,
    messages:
      status === "optimal"
        ? [
            `Distancia mínima de ${source} a ${target}: ${distance!.toString()} por ${path.join(" -> ")}.`,
          ]
        : [`No existe camino de ${source} a ${target}.`],
  };
}
