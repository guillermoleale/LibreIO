// SPDX-License-Identifier: GPL-3.0-or-later
// Transbordo: reducción al problema de transporte con nodos intermedios como origen y destino y un buffer.
import { Fraction } from "../rational/Fraction";
import { solveTransport, type TransportOptions } from "./modi";
import type {
  TransportProblem,
  TransshipmentProblem,
  TransshipmentResult,
} from "./types";

export interface TransshipmentReduction {
  readonly transport: TransportProblem;
  readonly buffer: Fraction;
  readonly transshipmentNodes: string[];
}

export function transshipmentToTransport(
  problem: TransshipmentProblem,
): TransshipmentReduction {
  const hasOut = new Set(problem.arcs.map((a) => a.from));
  const hasIn = new Set(problem.arcs.map((a) => a.to));
  const isPureSource = (n: TransshipmentProblem["nodes"][number]) =>
    n.supply.isPositive() && !hasIn.has(n.name);
  const isPureSink = (n: TransshipmentProblem["nodes"][number]) =>
    n.demand.isPositive() && !hasOut.has(n.name);
  const transshipmentNodes = problem.nodes
    .filter((n) => !isPureSource(n) && !isPureSink(n))
    .map((n) => n.name);
  const buffer = Fraction.max(
    Fraction.sum(problem.nodes.map((n) => n.supply)),
    Fraction.sum(problem.nodes.map((n) => n.demand)),
  );
  const sources = problem.nodes.filter(
    (n) => isPureSource(n) || transshipmentNodes.includes(n.name),
  );
  const destinations = problem.nodes.filter(
    (n) => isPureSink(n) || transshipmentNodes.includes(n.name),
  );
  const costOf = new Map(
    problem.arcs.map((a) => [`${a.from}->${a.to}`, a.cost]),
  );
  const costs = sources.map((s) =>
    destinations.map((d) => {
      if (s.name === d.name) {
        return Fraction.ZERO;
      }
      return costOf.get(`${s.name}->${d.name}`) ?? null;
    }),
  );
  const transport: TransportProblem = {
    title: problem.title,
    sense: problem.sense,
    sources: sources.map((n) => n.name),
    destinations: destinations.map((n) => n.name),
    supply: sources.map((n) =>
      transshipmentNodes.includes(n.name) ? n.supply.add(buffer) : n.supply,
    ),
    demand: destinations.map((n) =>
      transshipmentNodes.includes(n.name) ? n.demand.add(buffer) : n.demand,
    ),
    costs,
  };
  return { transport, buffer, transshipmentNodes };
}

export function solveTransshipment(
  problem: TransshipmentProblem,
  options: TransportOptions = {},
): TransshipmentResult {
  const { transport, buffer, transshipmentNodes } =
    transshipmentToTransport(problem);
  const result = solveTransport(transport, options);
  const flows: TransshipmentResult["flows"] = [];
  result.allocation.forEach((row, i) =>
    row.forEach((value, j) => {
      const from = result.problem.sources[i]!;
      const to = result.problem.destinations[j]!;
      if (value === null || value.isZero() || from === to) {
        return;
      }
      flows.push({ from, to, value });
    }),
  );
  const through = transshipmentNodes.map((name) => {
    const i = result.problem.sources.indexOf(name);
    const j = result.problem.destinations.indexOf(name);
    const idle = result.allocation[i]?.[j] ?? Fraction.ZERO;
    return { node: name, amount: buffer.sub(idle) };
  });
  const messages = [
    `Reducción a transporte: ${transshipmentNodes.length === 0 ? "sin nodos intermedios" : `nodos intermedios ${transshipmentNodes.join(", ")} como origen y destino con buffer ${buffer.toString()}`}. Los arcos inexistentes tienen costo M.`,
    ...result.messages,
  ];
  return {
    problem,
    transport: result,
    buffer,
    status: result.status,
    objective: result.objective.c,
    flows,
    through,
    messages,
  };
}
