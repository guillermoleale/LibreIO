// SPDX-License-Identifier: GPL-3.0-or-later
// Reportes de texto de redes: camino mínimo, flujo máximo, árbol de expansión mínima y viajante.
import type { Fraction } from "../rational/Fraction";
import type {
  MaxFlowResult,
  NetworkProblem,
  ShortestPathResult,
  SpanningTreeResult,
  TspResult,
} from "../network/types";
import { numberFormatter, textTable, type NumberOptions } from "./format";

function header(title: string, problem: NetworkProblem): string[] {
  const lines = [`LibreIO. ${title}`];
  if (problem.title) {
    lines.push(`Problema: ${problem.title}`);
  }
  lines.push(
    `Red ${problem.directed ? "dirigida" : "no dirigida"} con ${problem.arcs.length} arcos`,
  );
  return lines;
}

export function reportShortestPath(
  problem: NetworkProblem,
  r: ShortestPathResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const lines = header("Camino mínimo (Dijkstra)", problem);
  lines.push("");
  if (r.status === "optimal") {
    lines.push(
      `Distancia mínima de ${r.source} a ${r.target}: ${number(r.distance!)}`,
    );
    lines.push(`Camino: ${r.path.join(" -> ")}`);
  } else {
    lines.push(`No existe camino de ${r.source} a ${r.target}.`);
  }
  lines.push("", "Etiquetas finales");
  const nodes = Object.keys(r.labels);
  lines.push(
    textTable(
      ["Nodo", "Distancia", "Desde", "Estado"],
      ["l", "r", "l", "l"],
      nodes.map((n) => {
        const l = r.labels[n]!;
        return [
          n,
          l.distance ? number(l.distance) : "-",
          l.predecessor ?? "-",
          l.permanent ? "permanente" : l.distance ? "temporal" : "sin etiqueta",
        ];
      }),
    ),
  );
  lines.push("", "Iteraciones");
  for (const s of r.steps) {
    lines.push(`${s.index + 1}. ${s.note}`);
  }
  return `${lines.join("\n")}\n`;
}

export function reportMaxFlow(
  problem: NetworkProblem,
  r: MaxFlowResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const lines = header("Flujo máximo (Ford Fulkerson)", problem);
  lines.push(
    "",
    `Flujo máximo de ${r.source} a ${r.sink}: ${number(r.value)}`,
    "",
  );
  lines.push("Flujo por arco");
  lines.push(
    textTable(
      ["Desde", "Hasta", "Capacidad", "Flujo"],
      ["l", "l", "r", "r"],
      r.flows.map((f) => [f.from, f.to, number(f.capacity), number(f.flow)]),
    ),
  );
  lines.push("", "Caminos de aumento");
  for (const p of r.augmentingPaths) {
    lines.push(
      `${p.index + 1}. ${p.path.join(" -> ")}: ${number(p.bottleneck)} (acumulado ${number(p.totalAfter)})`,
    );
  }
  lines.push(
    "",
    `Corte mínimo: {${r.minCut.sourceSide.join(", ")}} | {${r.minCut.sinkSide.join(", ")}} con capacidad ${number(r.minCut.capacity)}`,
  );
  lines.push(
    `Arcos del corte: ${r.minCut.arcs.map((a) => `${a.from}-${a.to} (${number(a.weight)})`).join(", ")}`,
  );
  return `${lines.join("\n")}\n`;
}

export function reportSpanningTree(
  problem: NetworkProblem,
  r: SpanningTreeResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const lines = header(
    `Árbol de expansión mínima (${r.method === "kruskal" ? "Kruskal" : "Prim"})`,
    problem,
  );
  lines.push("", "Aristas del árbol");
  lines.push(
    textTable(
      ["Desde", "Hasta", "Costo"],
      ["l", "l", "r"],
      r.edges.map((e) => [e.from, e.to, number(e.weight)]),
    ),
  );
  lines.push("", `Costo total: ${number(r.cost)}`);
  if (!r.connected) {
    lines.push("La red no es conexa: el resultado es un bosque.");
  }
  lines.push("", "Pasos");
  for (const s of r.steps) {
    lines.push(`${s.index + 1}. ${s.note}`);
  }
  return `${lines.join("\n")}\n`;
}

export function reportTravelingSalesman(
  problem: NetworkProblem,
  r: TspResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const lines = header("Viajante (ramificación y acotamiento)", problem);
  lines.push("");
  if (r.status === "optimal") {
    lines.push(`Circuito óptimo: ${r.optimal.tour.join(" -> ")}`);
    lines.push(`Costo del circuito óptimo: ${number(r.optimal.cost)}`);
    lines.push(`Nodos explorados: ${r.optimal.explored}`);
  } else {
    lines.push("No existe un circuito que pase por todos los nodos.");
  }
  const heuristic = (name: string, t: { tour: string[]; cost: Fraction }) =>
    t.tour.length > 0
      ? `${name}: ${t.tour.join(" -> ")} con costo ${number(t.cost)}`
      : `${name}: sin circuito`;
  lines.push(
    "",
    heuristic("Vecino más cercano", r.nearestNeighbor),
    heuristic("Inserción más barata", r.cheapestInsertion),
  );
  lines.push("", "Pasos de vecino más cercano");
  r.nearestNeighbor.steps.forEach((s, i) => lines.push(`${i + 1}. ${s.note}`));
  lines.push("", "Pasos de inserción más barata");
  r.cheapestInsertion.steps.forEach((s, i) =>
    lines.push(`${i + 1}. ${s.note}`),
  );
  lines.push("", "Árbol de ramificación y acotamiento");
  lines.push(
    textTable(
      ["Nodo", "Camino", "Costo", "Cota", "Estado"],
      ["r", "l", "r", "r", "l"],
      r.optimal.nodes.map((n) => [
        String(n.id),
        n.path.join("-"),
        number(n.cost),
        number(n.bound),
        n.complete ? "circuito" : n.pruned ? "podado" : "ramifica",
      ]),
    ),
  );
  return `${lines.join("\n")}\n`;
}
