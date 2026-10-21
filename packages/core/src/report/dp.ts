// SPDX-License-Identifier: GPL-3.0-or-later
// Reportes de programación dinámica: mochila y diligencia con la tabla de cada etapa.
import type {
  KnapsackProblem,
  KnapsackResult,
  StagecoachProblem,
  StagecoachResult,
} from "../dp/types";
import { numberFormatter, textTable, type NumberOptions } from "./format";

export function reportKnapsack(
  problem: KnapsackProblem,
  r: KnapsackResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const lines = ["LibreIO. Mochila (programación dinámica)"];
  if (problem.title) {
    lines.push(`Problema: ${problem.title}`);
  }
  lines.push(`Capacidad ${number(problem.capacity)}`, "");
  lines.push(
    textTable(
      ["Objeto", "Peso", "Valor", "Unidades máx.", "Elegidas"],
      ["l", "r", "r", "r", "r"],
      problem.items.map((item, i) => [
        item.name,
        number(item.weight),
        number(item.value),
        String(item.maxUnits ?? 1),
        String(r.units[i] ?? 0),
      ]),
    ),
  );
  lines.push(
    "",
    `Valor óptimo: ${number(r.value)}`,
    `Peso usado: ${number(r.weight)}`,
  );
  lines.push(
    `Objetos elegidos: ${r.selected.length > 0 ? r.selected.map((i) => problem.items[i]!.name).join(", ") : "ninguno"}`,
  );
  for (const stageIndex of r.order) {
    const stage = r.stages[stageIndex]!;
    const item = problem.items[stage.item]!;
    const maxUnits = Math.max(
      1,
      ...stage.rows.map((row) => row.decisions.length - 1),
    );
    lines.push(
      "",
      `Etapa ${stage.item + 1}: objeto ${item.name} (peso ${number(item.weight)}, valor ${number(item.value)})`,
    );
    lines.push(
      textTable(
        [
          "Capacidad",
          ...Array.from({ length: maxUnits + 1 }, (_, u) => `u = ${u}`),
          "f",
          "Decisión",
        ],
        [
          "r",
          ...Array.from({ length: maxUnits + 1 }, () => "r" as const),
          "r",
          "r",
        ],
        stage.rows.map((row) => [
          number(row.capacity),
          ...Array.from({ length: maxUnits + 1 }, (_, u) => {
            const d = row.decisions.find((x) => x.units === u);
            return d ? number(d.value) : "-";
          }),
          number(row.best),
          String(row.choice),
        ]),
      ),
    );
  }
  lines.push("", ...r.messages);
  return `${lines.join("\n")}\n`;
}

export function reportStagecoach(
  problem: StagecoachProblem,
  r: StagecoachResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const lines = ["LibreIO. Diligencia (programación dinámica)"];
  if (problem.title) {
    lines.push(`Problema: ${problem.title}`);
  }
  lines.push(
    `Etapas: ${r.stagesUsed.map((s, k) => `${k + 1}: {${s.join(", ")}}`).join("; ")}`,
    "",
  );
  if (r.status === "optimal" && r.cost) {
    lines.push(
      `${r.sense === "min" ? "Costo mínimo" : "Costo máximo"}: ${number(r.cost)}`,
    );
    lines.push(`Camino: ${r.path.join(" -> ")}`);
  } else {
    lines.push("No existe un camino completo por todas las etapas.");
  }
  for (const table of r.tables) {
    lines.push("", `Etapa ${table.stage} (hacia atrás)`);
    lines.push(
      textTable(
        ["Estado", "Candidatos (siguiente: costo + f)", "f", "Decisión"],
        ["l", "l", "r", "l"],
        table.rows.map((row) => [
          row.state,
          row.candidates
            .map(
              (c) =>
                `${c.next}: ${number(c.cost)} + ${number(c.total.sub(c.cost))} = ${number(c.total)}`,
            )
            .join("; ") || "sin salida",
          row.decision === null ? "-" : number(row.best),
          row.decision ?? "-",
        ]),
      ),
    );
  }
  lines.push("", ...r.messages);
  return `${lines.join("\n")}\n`;
}
