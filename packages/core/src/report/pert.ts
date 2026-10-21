// SPDX-License-Identifier: GPL-3.0-or-later
// Reportes de texto de PERT/CPM y compresión.
import type {
  CpmResult,
  CrashingResult,
  PertResult,
  ProjectProblem,
} from "../pert/types";
import { numberFormatter, textTable, type NumberOptions } from "./format";

export function reportCpm(
  problem: ProjectProblem,
  r: CpmResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const lines = ["LibreIO. CPM"];
  if (problem.title) {
    lines.push(`Problema: ${problem.title}`);
  }
  lines.push("");
  if (r.status !== "ok") {
    lines.push(...r.messages);
    return `${lines.join("\n")}\n`;
  }
  lines.push(`Duración del proyecto: ${number(r.duration)}`);
  for (const p of r.criticalPaths) {
    lines.push(`Camino crítico: ${p.join(" -> ")}`);
  }
  lines.push("");
  lines.push(
    textTable(
      [
        "Actividad",
        "Duración",
        "ES",
        "EF",
        "LS",
        "LF",
        "Holgura total",
        "Holgura libre",
        "Crítica",
      ],
      ["l", "r", "r", "r", "r", "r", "r", "r", "l"],
      r.activities.map((a) => [
        a.id,
        number(a.duration),
        number(a.es),
        number(a.ef),
        number(a.ls),
        number(a.lf),
        number(a.totalSlack),
        number(a.freeSlack),
        a.critical ? "sí" : "no",
      ]),
    ),
  );
  return `${lines.join("\n")}\n`;
}

export function reportPert(
  problem: ProjectProblem,
  r: PertResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const lines = ["LibreIO. PERT"];
  if (problem.title) {
    lines.push(`Problema: ${problem.title}`);
  }
  lines.push("");
  lines.push(`Duración esperada: ${number(r.expectedDuration)}`);
  lines.push(`Camino crítico: ${r.criticalPath.join(" -> ")}`);
  lines.push(
    `Varianza del camino crítico: ${number(r.variance)} (desvío ${r.standardDeviation.toFixed(4)})`,
  );
  lines.push("");
  lines.push(
    textTable(
      [
        "Actividad",
        "Optimista",
        "Más probable",
        "Pesimista",
        "Esperada",
        "Varianza",
      ],
      ["l", "r", "r", "r", "r", "r"],
      r.activities.map((a) => [
        a.id,
        number(a.optimistic),
        number(a.mostLikely),
        number(a.pessimistic),
        number(a.expected),
        number(a.variance),
      ]),
    ),
  );
  lines.push("", "Probabilidad de terminar antes de cada fecha");
  const mu = r.expectedDuration.toNumber();
  const dates = [
    mu - 2 * r.standardDeviation,
    mu - r.standardDeviation,
    mu,
    mu + r.standardDeviation,
    mu + 2 * r.standardDeviation,
  ];
  lines.push(
    textTable(
      ["Fecha", "Probabilidad"],
      ["r", "r"],
      dates.map((d) => [d.toFixed(2), r.probabilityByDate(d).toFixed(4)]),
    ),
  );
  return `${lines.join("\n")}\n`;
}

export function reportCrashing(
  problem: ProjectProblem,
  r: CrashingResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const lines = ["LibreIO. Compresión (crashing)"];
  if (problem.title) {
    lines.push(`Problema: ${problem.title}`);
  }
  lines.push("");
  lines.push(
    `Duración normal: ${number(r.normalDuration)}. Duración mínima: ${number(r.minimumDuration)}.`,
  );
  if (r.target) {
    if (r.target.feasible) {
      lines.push(
        `Objetivo ${number(r.target.requested)}: costo ${number(r.target.cost)} acortando ${
          r.target.crashed
            .filter((c) => !c.amount.isZero())
            .map((c) => `${c.id} en ${number(c.amount)}`)
            .join(", ") || "ninguna actividad"
        }.`,
      );
    } else {
      lines.push(
        `No se puede acortar el proyecto por debajo de ${number(r.minimumDuration)}: el objetivo ${number(r.target.requested)} no es alcanzable.`,
      );
    }
  }
  lines.push("", "Actividades que se pueden acortar");
  lines.push(
    textTable(
      ["Actividad", "Reducción máxima", "Costo por unidad"],
      ["l", "r", "r"],
      r.crashable.map((c) => [
        c.id,
        number(c.maxReduction),
        number(c.costPerUnit),
      ]),
    ),
  );
  lines.push("", "Curva de costo contra duración");
  lines.push(
    textTable(
      ["Duración", "Costo", "Actividades acortadas", "Caminos críticos"],
      ["r", "r", "l", "l"],
      r.curve.map((p) => [
        number(p.duration),
        number(p.cost),
        p.crashed
          .filter((c) => !c.amount.isZero())
          .map((c) => `${c.id} ${number(c.amount)}`)
          .join(", ") || "-",
        p.criticalPaths.map((path) => path.join("-")).join("; "),
      ]),
    ),
  );
  return `${lines.join("\n")}\n`;
}
