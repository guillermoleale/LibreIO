// SPDX-License-Identifier: GPL-3.0-or-later
// Reporte combinado en español con las columnas de WinQSB, y reporte del modelo con forma estándar y dual.
import { Fraction } from "../rational/Fraction";
import type { LPModel } from "../parser/model";
import { formatLP, formatLinearExpression } from "../parser/formatLP";
import type { LPResult } from "../lp/solveLP";
import type { StandardForm } from "../lp/standardForm";
import {
  extendedFormatter,
  numberFormatter,
  textTable,
  type NumberOptions,
} from "./format";

export type CombinedOptions = NumberOptions;

function methodName(result: LPResult): string {
  const method = result.method === "bigM" ? "Big M" : "dos fases";
  const rule = result.rule === "bland" ? "Bland" : "Dantzig";
  return `${method} con regla de ${rule}`;
}

function header(
  model: LPModel,
  result: LPResult,
  title: string,
  number: (f: Fraction) => string,
): string[] {
  const names = model.variables.map((v) => v.name);
  const lines = [`LibreIO. ${title}`];
  if (model.title !== null && model.title !== "") {
    lines.push(`Problema: ${model.title}`);
  }
  lines.push(
    `Objetivo: ${model.sense === "max" ? "MAX" : "MIN"} ${formatLinearExpression(model.objective, names, number)}`,
  );
  lines.push(`Método: ${methodName(result)}`);
  return lines;
}

export function reportCombined(
  model: LPModel,
  result: LPResult,
  options: CombinedOptions = {},
): string {
  const number = numberFormatter(options);
  const extended = extendedFormatter(number);
  const lines = header(model, result, "Reporte combinado", number);
  lines.push("");
  if (result.status === "unbounded") {
    lines.push(
      `Problema ilimitado después de ${result.iterations} iteraciones.`,
    );
    lines.push(...result.messages.filter((m) => /ilimitad/i.test(m)));
    return `${lines.join("\n")}\n`;
  }
  if (result.status === "infeasible") {
    lines.push(
      `Problema infactible después de ${result.iterations} iteraciones.`,
    );
    lines.push(...result.messages.filter((m) => /infactible/i.test(m)));
    return `${lines.join("\n")}\n`;
  }
  const solution = result.solution!;
  const sensitivity = result.sensitivity!;
  lines.push(`Óptimo encontrado en ${result.iterations} iteraciones`);
  lines.push(`Valor de la función objetivo: Z = ${number(solution.objective)}`);
  if (result.flags.degenerate) {
    lines.push(...result.messages.filter((m) => /degenerad/i.test(m)));
  }
  if (result.flags.alternativeOptima) {
    lines.push(...result.messages.filter((m) => /alternativ/i.test(m)));
  }
  lines.push("");
  lines.push(
    textTable(
      [
        "Variable",
        "Valor",
        "Coeficiente",
        "Contribución",
        "Costo reducido",
        "Estado",
        "Mín. coef.",
        "Máx. coef.",
      ],
      ["l", "r", "r", "r", "r", "l", "r", "r"],
      sensitivity.variables.map((v) => [
        v.name,
        number(v.value),
        number(v.cost),
        number(v.contribution),
        number(v.reducedCost),
        v.basic ? "básica" : "no básica",
        extended(v.costMin),
        extended(v.costMax),
      ]),
    ),
  );
  lines.push("");
  lines.push(
    textTable(
      [
        "Restricción",
        "Lado izq.",
        "Dir.",
        "Lado der.",
        "Holgura/Exceso",
        "Precio sombra",
        "Mín. LD",
        "Máx. LD",
      ],
      ["l", "r", "l", "r", "r", "r", "r", "r"],
      sensitivity.constraints.map((c) => [
        c.label ?? String(c.row),
        number(c.lhs),
        c.relation,
        number(c.rhs),
        number(c.slack),
        number(c.shadowPrice),
        extended(c.rhsMin),
        extended(c.rhsMax),
      ]),
    ),
  );
  return `${lines.join("\n")}\n`;
}

/** Filas de la forma estándar escritas como ecuaciones con holguras, excesos y artificiales. */
export function formatStandardForm(
  sf: StandardForm,
  number: (f: Fraction) => string = (f) => f.toString(),
): string {
  const names = sf.columns.map((c) => c.name);
  const lines = [
    `MAX ${formatLinearExpression(sf.c, names, number)}`,
    "SUBJECT TO",
  ];
  sf.rows.forEach((row, i) => {
    const label = row.label ?? String(row.row);
    lines.push(
      `  ${label}) ${formatLinearExpression(sf.A[i]!, names, number)} = ${number(sf.b[i]!)}`,
    );
  });
  const nonNegative = names.join(", ");
  lines.push(`  ${nonNegative} >= 0`);
  return lines.join("\n");
}

/** Pestaña Modelo: formulación normalizada, forma estándar y dual. */
export function reportModel(
  model: LPModel,
  result: LPResult,
  options: CombinedOptions = {},
): string {
  const number = numberFormatter(options);
  const lines: string[] = [
    "Formulación",
    "",
    formatLP(model, { number }).trimEnd(),
    "",
  ];
  if (model.sense === "min") {
    lines.push(
      "Forma estándar (se maximiza -Z; la fila objetivo del tableau corresponde a esta forma)",
    );
  } else {
    lines.push("Forma estándar");
  }
  lines.push("", formatStandardForm(result.standardForm, number), "");
  if (result.standardForm.messages.length > 0) {
    lines.push(...result.standardForm.messages, "");
  }
  const dual = result.dual;
  if (dual) {
    lines.push("Dual", "", formatLP(dual.model, { number }).trimEnd());
    lines.push(
      "",
      `Solución del dual: ${dual.values.map((v) => `${v.name} = ${number(v.value)}`).join(", ")}; W = ${number(dual.objective)}`,
    );
  } else {
    lines.push(
      "Dual",
      "",
      formatLP(formulateDualForReport(model), { number }).trimEnd(),
    );
  }
  return `${lines.join("\n")}\n`;
}

import { formulateDual } from "../lp/dual";

function formulateDualForReport(model: LPModel): LPModel {
  return formulateDual(model);
}
