// SPDX-License-Identifier: GPL-3.0-or-later
// Flujo máximo con Ford Fulkerson (caminos de aumento más cortos, Edmonds Karp) y corte mínimo.
import { Fraction } from "../rational/Fraction";
import { allNodes, requireNode } from "./graph";
import type {
  Arc,
  AugmentingPath,
  MaxFlowResult,
  NetworkProblem,
} from "./types";

export function maxFlow(
  problem: NetworkProblem,
  source: string,
  sink: string,
): MaxFlowResult {
  const nodes = allNodes(problem);
  requireNode(nodes, source, "La fuente");
  requireNode(nodes, sink, "El sumidero");
  // Capacidades agregadas por par ordenado
  const capacity = new Map<string, Fraction>();
  const key = (a: string, b: string) => `${a}\u0000${b}`;
  const add = (a: string, b: string, c: Fraction) =>
    capacity.set(key(a, b), (capacity.get(key(a, b)) ?? Fraction.ZERO).add(c));
  for (const arc of problem.arcs) {
    if (arc.weight.isNegative()) {
      throw new RangeError("Las capacidades no pueden ser negativas");
    }
    add(arc.from, arc.to, arc.weight);
    if (!problem.directed) {
      add(arc.to, arc.from, arc.weight);
    }
  }
  const flow = new Map<string, Fraction>();
  const residual = (a: string, b: string): Fraction => {
    const cap = capacity.get(key(a, b)) ?? Fraction.ZERO;
    const f = flow.get(key(a, b)) ?? Fraction.ZERO;
    const back = flow.get(key(b, a)) ?? Fraction.ZERO;
    return cap.sub(f).add(back);
  };
  const neighbors = new Map<string, string[]>();
  for (const n of nodes) {
    neighbors.set(n, []);
  }
  for (const k of capacity.keys()) {
    const [a, b] = k.split("\u0000") as [string, string];
    neighbors.get(a)!.push(b);
    if (!neighbors.get(b)!.includes(a)) {
      neighbors.get(b)!.push(a);
    }
  }
  const augmentingPaths: AugmentingPath[] = [];
  let total = Fraction.ZERO;
  for (let guard = 0; guard < 10000; guard += 1) {
    const previous = new Map<string, string>();
    const queue = [source];
    const seen = new Set([source]);
    while (queue.length > 0 && !seen.has(sink)) {
      const u = queue.shift()!;
      for (const v of neighbors.get(u) ?? []) {
        if (!seen.has(v) && residual(u, v).isPositive()) {
          seen.add(v);
          previous.set(v, u);
          queue.push(v);
        }
      }
    }
    if (!seen.has(sink)) {
      break;
    }
    const path: string[] = [sink];
    let cursor = sink;
    let bottleneck: Fraction | null = null;
    while (cursor !== source) {
      const u = previous.get(cursor)!;
      const r = residual(u, cursor);
      bottleneck = bottleneck === null || r.lt(bottleneck) ? r : bottleneck;
      path.unshift(u);
      cursor = u;
    }
    const delta = bottleneck!;
    for (let i = 0; i + 1 < path.length; i += 1) {
      const a = path[i]!;
      const b = path[i + 1]!;
      const back = flow.get(key(b, a)) ?? Fraction.ZERO;
      if (back.isPositive()) {
        // Primero se cancela flujo en sentido contrario
        const cancel = Fraction.min(back, delta);
        flow.set(key(b, a), back.sub(cancel));
        const rest = delta.sub(cancel);
        if (rest.isPositive()) {
          flow.set(key(a, b), (flow.get(key(a, b)) ?? Fraction.ZERO).add(rest));
        }
      } else {
        flow.set(key(a, b), (flow.get(key(a, b)) ?? Fraction.ZERO).add(delta));
      }
    }
    total = total.add(delta);
    augmentingPaths.push({
      index: augmentingPaths.length,
      path,
      bottleneck: delta,
      totalAfter: total,
      note: `Camino de aumento ${path.join(" -> ")} con capacidad residual mínima ${delta.toString()}. Flujo total ${total.toString()}.`,
    });
  }
  // Corte mínimo: del lado del sumidero quedan los nodos que todavía pueden llegar a él en el grafo residual;
  // el resto queda del lado de la fuente (es el corte mínimo más amplio del lado de la fuente).
  const canReachSink = new Set([sink]);
  const queue = [sink];
  while (queue.length > 0) {
    const v = queue.shift()!;
    for (const u of neighbors.get(v) ?? []) {
      if (!canReachSink.has(u) && residual(u, v).isPositive()) {
        canReachSink.add(u);
        queue.push(u);
      }
    }
  }
  const reach = new Set(nodes.filter((n) => !canReachSink.has(n)));
  const sourceSide = nodes.filter((n) => reach.has(n));
  const sinkSide = nodes.filter((n) => !reach.has(n));
  const cutArcs: Arc[] = [];
  let cutCapacity = Fraction.ZERO;
  for (const [k, cap] of capacity) {
    const [a, b] = k.split("\u0000") as [string, string];
    if (reach.has(a) && !reach.has(b) && cap.isPositive()) {
      cutArcs.push({ from: a, to: b, weight: cap });
      cutCapacity = cutCapacity.add(cap);
    }
  }
  const flows = problem.arcs.map((arc) => {
    if (problem.directed) {
      return {
        from: arc.from,
        to: arc.to,
        capacity: arc.weight,
        flow: flowOnArc(flow, key, arc.from, arc.to, arc.weight, capacity),
      };
    }
    const forward = flow.get(key(arc.from, arc.to)) ?? Fraction.ZERO;
    const backward = flow.get(key(arc.to, arc.from)) ?? Fraction.ZERO;
    return forward.ge(backward)
      ? {
          from: arc.from,
          to: arc.to,
          capacity: arc.weight,
          flow: Fraction.min(forward.sub(backward), arc.weight),
        }
      : {
          from: arc.to,
          to: arc.from,
          capacity: arc.weight,
          flow: Fraction.min(backward.sub(forward), arc.weight),
        };
  });
  return {
    source,
    sink,
    value: total,
    flows,
    augmentingPaths,
    minCut: { sourceSide, sinkSide, arcs: cutArcs, capacity: cutCapacity },
    messages: [
      `Flujo máximo de ${source} a ${sink}: ${total.toString()} en ${augmentingPaths.length} caminos de aumento.`,
      `Corte mínimo: {${sourceSide.join(", ")}} | {${sinkSide.join(", ")}} con capacidad ${cutCapacity.toString()}.`,
    ],
  };
}

/** Reparte el flujo agregado del par (a, b) entre arcos paralelos en el orden de entrada. */
function flowOnArc(
  flow: Map<string, Fraction>,
  key: (a: string, b: string) => string,
  a: string,
  b: string,
  cap: Fraction,
  capacity: Map<string, Fraction>,
): Fraction {
  const total = flow.get(key(a, b)) ?? Fraction.ZERO;
  const aggregated = capacity.get(key(a, b)) ?? Fraction.ZERO;
  if (aggregated.eq(cap)) {
    return total;
  }
  // Arcos paralelos: se asigna proporcionalmente a la capacidad.
  return aggregated.isZero() ? Fraction.ZERO : total.mul(cap).div(aggregated);
}
