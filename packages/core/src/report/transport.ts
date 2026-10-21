// SPDX-License-Identifier: GPL-3.0-or-later
// Reportes de texto de transporte, transbordo y asignación.
import { Fraction } from "../rational/Fraction";
import type { MValue } from "../lp/MValue";
import { INITIAL_METHOD_NAMES } from "../transport/initialSolution";
import type {
  AssignmentResult,
  TransportProblem,
  TransportResult,
  TransshipmentResult,
} from "../transport/types";
import { numberFormatter, textTable, type NumberOptions } from "./format";

function mvalue(v: MValue, number: (f: Fraction) => string): string {
  return v.format(number);
}

export function allocationTable(
  problem: TransportProblem,
  allocation: Array<Array<Fraction | null>>,
  number: (f: Fraction) => string,
): string {
  const headers = ["", ...problem.destinations, "Oferta"];
  const aligns = [
    "l",
    ...problem.destinations.map(() => "r" as const),
    "r",
  ] as Array<"l" | "r">;
  const rows = problem.sources.map((s, i) => [
    s,
    ...allocation[i]!.map((v) => (v === null ? "-" : number(v))),
    number(problem.supply[i]!),
  ]);
  rows.push(["Demanda", ...problem.demand.map(number), ""]);
  return textTable(headers, aligns, rows);
}

export function costTable(
  problem: TransportProblem,
  number: (f: Fraction) => string,
): string {
  const headers = ["", ...problem.destinations, "Oferta"];
  const aligns = [
    "l",
    ...problem.destinations.map(() => "r" as const),
    "r",
  ] as Array<"l" | "r">;
  const rows = problem.sources.map((s, i) => [
    s,
    ...problem.costs[i]!.map((c) => (c === null ? "M" : number(c))),
    number(problem.supply[i]!),
  ]);
  rows.push(["Demanda", ...problem.demand.map(number), ""]);
  return textTable(headers, aligns, rows);
}

export function reportTransport(
  r: TransportResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const p = r.problem;
  const lines: string[] = ["LibreIO. Transporte"];
  if (p.title) {
    lines.push(`Problema: ${p.title}`);
  }
  lines.push(`Objetivo: ${p.sense === "max" ? "maximizar" : "minimizar"}`);
  lines.push(
    `Solución inicial: ${INITIAL_METHOD_NAMES[r.initial.method]} (costo ${mvalue(r.initial.cost, number)})`,
  );
  lines.push(`Iteraciones de MODI: ${r.iterations.length - 1}`);
  lines.push("");
  if (r.balanced) {
    lines.push(...r.messages.filter((m) => /ficticio/i.test(m)), "");
  }
  lines.push("Costos", costTable(p, number), "");
  lines.push(
    r.status === "optimal"
      ? "Asignación óptima"
      : "Asignación (usa rutas prohibidas)",
    allocationTable(p, r.allocation, number),
    "",
  );
  lines.push(`Costo total: ${mvalue(r.objective, number)}`);
  for (const m of r.messages.filter((m) => /degenerad/i.test(m))) {
    lines.push(m);
  }
  lines.push("", "Iteraciones");
  for (const it of r.iterations) {
    lines.push(
      `${it.index}. Costo ${mvalue(it.cost, number)}. u = (${it.u.map((v) => mvalue(v, number)).join(", ")}), v = (${it.v.map((v) => mvalue(v, number)).join(", ")}). ${it.note}`,
    );
  }
  lines.push("", "Rangos de costos en los que la solución no cambia");
  const ranges = p.sources.flatMap((s, i) =>
    p.destinations.map((d, j) => {
      const cell = r.sensitivity[i]![j]!;
      const cost = p.costs[i]![j] ?? null;
      const fmt = (x: typeof cell.min) =>
        x.finite ? number(x.value) : x.sign > 0 ? "infinito" : "-infinito";
      return [
        `${s}, ${d}`,
        cost === null ? "M" : number(cost),
        cell.basic ? "básica" : "no básica",
        fmt(cell.min),
        fmt(cell.max),
      ];
    }),
  );
  lines.push(
    textTable(
      ["Celda", "Costo", "Estado", "Mínimo", "Máximo"],
      ["l", "r", "l", "r", "r"],
      ranges,
    ),
  );
  return `${lines.join("\n")}\n`;
}

export function reportTransshipment(
  r: TransshipmentResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const lines: string[] = ["LibreIO. Transbordo"];
  if (r.problem.title) {
    lines.push(`Problema: ${r.problem.title}`);
  }
  lines.push(`Buffer: ${number(r.buffer)}`, "");
  lines.push(
    "Matriz ampliada de transporte",
    costTable(r.transport.problem, number),
    "",
  );
  lines.push("Flujos óptimos");
  lines.push(
    textTable(
      ["Desde", "", "Hasta", "Unidades"],
      ["l", "l", "l", "r"],
      r.flows.map((f) => [f.from, "->", f.to, number(f.value)]),
    ),
  );
  lines.push("");
  for (const t of r.through) {
    lines.push(`Pasan ${number(t.amount)} unidades por ${t.node}.`);
  }
  lines.push(`Costo total: ${number(r.objective)}`);
  if (r.status !== "optimal") {
    lines.push("No existe una solución factible con los arcos dados.");
  }
  lines.push(
    "",
    "Asignación en la matriz ampliada",
    allocationTable(r.transport.problem, r.transport.allocation, number),
  );
  return `${lines.join("\n")}\n`;
}

export function reportAssignment(
  r: AssignmentResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const p = r.problem;
  const lines: string[] = ["LibreIO. Asignación"];
  if (p.title) {
    lines.push(`Problema: ${p.title}`);
  }
  lines.push(`Objetivo: ${p.sense === "max" ? "maximizar" : "minimizar"}`, "");
  if (r.balanced) {
    lines.push(...r.messages.filter((m) => /ficticio/i.test(m)), "");
  }
  lines.push("Asignación óptima");
  lines.push(
    textTable(
      ["Agente", "", "Tarea", "Costo"],
      ["l", "l", "l", "r"],
      r.assignment.map((a) => {
        const cost = r.original.costs[a.agent]![a.task] ?? null;
        return [
          r.original.agents[a.agent]!,
          "->",
          r.original.tasks[a.task]!,
          cost === null ? "M" : number(cost),
        ];
      }),
    ),
  );
  lines.push("", `Costo total: ${number(r.objective)}`);
  if (r.status !== "optimal") {
    lines.push("No existe una asignación completa sin celdas prohibidas.");
  }
  lines.push("", "Pasos del método húngaro");
  r.steps.forEach((step, k) => {
    lines.push(`${k + 1}. ${step.note}`);
    const headers = ["", ...p.tasks];
    const aligns = ["l", ...p.tasks.map(() => "r" as const)] as Array<
      "l" | "r"
    >;
    lines.push(
      textTable(
        headers,
        aligns,
        step.matrix.map((row, i) => [
          `${step.coveredRows?.includes(i) ? "* " : ""}${p.agents[i]!}`,
          ...row.map(
            (v, j) =>
              `${step.coveredColumns?.includes(j) ? "*" : ""}${mvalue(v, number)}`,
          ),
        ]),
      ),
    );
    lines.push("");
  });
  return `${lines.join("\n")}\n`;
}
