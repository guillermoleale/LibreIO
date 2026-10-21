// SPDX-License-Identifier: GPL-3.0-or-later
// Reportes de colas: medidas, tabla de Pn, costos y análisis de capacidad.
import type {
  CapacityAnalysis,
  QueueModel,
  QueueResult,
} from "../queueing/types";
import { numberFormatter, textTable, type NumberOptions } from "./format";

export const QUEUE_KIND_NAMES: Record<QueueModel["kind"], string> = {
  MM1: "M/M/1",
  MMs: "M/M/s",
  MM1K: "M/M/1/K",
  MMsK: "M/M/s/K",
  MMsN: "M/M/s con población finita",
  MG1: "M/G/1",
  MD1: "M/D/1",
  MEk1: "M/Ek/1",
};

export function describeQueue(model: QueueModel): string {
  const parts = [
    `${QUEUE_KIND_NAMES[model.kind]}: λ = ${model.lambda.toString()}, μ = ${model.mu.toString()}`,
  ];
  if (model.servers !== undefined && model.servers > 1) {
    parts.push(`s = ${model.servers}`);
  }
  if (model.capacity !== undefined) {
    parts.push(`K = ${model.capacity}`);
  }
  if (model.population !== undefined) {
    parts.push(`N = ${model.population}`);
  }
  if (model.serviceVariance !== undefined) {
    parts.push(`σ² = ${model.serviceVariance.toString()}`);
  }
  if (model.phases !== undefined) {
    parts.push(`k = ${model.phases}`);
  }
  return parts.join(", ");
}

export function reportQueue(
  model: QueueModel,
  r: QueueResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const lines = ["LibreIO. Colas", describeQueue(model), ""];
  if (!r.stable) {
    lines.push(...r.messages);
    return `${lines.join("\n")}\n`;
  }
  lines.push(
    textTable(
      ["Medida", "Valor"],
      ["l", "r"],
      [
        ["λ efectiva", number(r.lambdaEff)],
        ["ρ", number(r.rho)],
        ["L", number(r.L)],
        ["Lq", number(r.Lq)],
        ["W", number(r.W)],
        ["Wq", number(r.Wq)],
        ["P0", number(r.P0)],
        ["Probabilidad de esperar", number(r.probabilityOfWaiting)],
      ],
    ),
  );
  lines.push(
    "",
    `L = ${number(r.L)}, Lq = ${number(r.Lq)}, W = ${number(r.W)}, Wq = ${number(r.Wq)}`,
  );
  if (r.pnTable.length > 0) {
    lines.push("", "Distribución del número de clientes en el sistema");
    lines.push(
      textTable(
        ["n", "Pn", "Acumulada"],
        ["r", "r", "r"],
        r.pnTable.map((p) => [
          String(p.n),
          number(p.probability),
          number(p.cumulative),
        ]),
      ),
    );
  }
  lines.push("", ...r.messages);
  return `${lines.join("\n")}\n`;
}

export function reportCapacity(
  analysis: CapacityAnalysis,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const label = { servers: "s", lambda: "λ", mu: "μ", capacity: "K" }[
    analysis.vary
  ];
  const lines = ["LibreIO. Análisis de capacidad", `Se varía ${label}`, ""];
  lines.push(
    textTable(
      [
        label,
        "ρ",
        "L",
        "Lq",
        "W",
        "Wq",
        "Costo servicio",
        "Costo espera",
        "Costo total",
      ],
      ["r", "r", "r", "r", "r", "r", "r", "r", "r"],
      analysis.rows.map((row) => [
        number(row.value),
        row.result.stable ? number(row.result.rho) : "inestable",
        row.result.stable ? number(row.result.L) : "-",
        row.result.stable ? number(row.result.Lq) : "-",
        row.result.stable ? number(row.result.W) : "-",
        row.result.stable ? number(row.result.Wq) : "-",
        row.cost ? number(row.cost.serviceCost) : "-",
        row.cost ? number(row.cost.waitingCostTotal) : "-",
        row.cost ? number(row.cost.total) : "-",
      ]),
    ),
  );
  lines.push("", ...analysis.messages);
  return `${lines.join("\n")}\n`;
}
