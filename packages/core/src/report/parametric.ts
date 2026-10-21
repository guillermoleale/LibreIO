// SPDX-License-Identifier: GPL-3.0-or-later
// Reporte del análisis paramétrico en formato clásico (LINDO PARA) y en español.
import type { LPModel } from "../parser/model";
import type { ParametricResult } from "../lp/parametric";
import {
  fixed,
  numberFormatter,
  padLeft,
  padRight,
  textTable,
  type NumberOptions,
} from "./format";

export function reportClassicParametric(
  model: LPModel,
  p: ParametricResult,
): string {
  const lines: string[] = [];
  if (p.kind === "rhs") {
    lines.push(` RIGHTHANDSIDE PARAMETRICS REPORT FOR ROW ${p.target}`);
  } else {
    lines.push(
      ` OBJECTIVE COEFFICIENT PARAMETRICS REPORT FOR VARIABLE ${p.target}`,
    );
  }
  lines.push("");
  if (p.status !== "ok") {
    lines.push(...p.messages.map((m) => ` ${m}`));
    return `${lines.join("\n")}\n`;
  }
  const valueHeader = p.kind === "rhs" ? "RHS" : "COEF";
  const rateHeader = p.kind === "rhs" ? "DUAL PRICE" : "VAR VALUE";
  lines.push(
    `    VAR       VAR     PIVOT ${padLeft(valueHeader, 16)} ${padLeft(rateHeader, 14)} ${padLeft("OBJ", 14)}`,
  );
  lines.push(
    `    OUT        IN       ROW ${padLeft("VAL", 16)} ${padLeft("BEFORE PIVOT", 14)} ${padLeft("VAL", 14)}`,
  );
  const isMin = model.sense === "min";
  const first = p.segments[0];
  if (first) {
    const rate = p.kind === "rhs" && isMin ? first.slope.neg() : first.slope;
    lines.push(
      `${padRight("", 25)}${fixed(first.from, 17, 6)}${fixed(rate, 15, 6)}${fixed(first.zFrom, 15, 6)}`,
    );
  }
  for (const b of p.breakpoints) {
    const rate = p.kind === "rhs" && isMin ? b.rateBefore.neg() : b.rateBefore;
    lines.push(
      `${padLeft(b.leaving ?? "", 7)}${padLeft(b.entering ?? "", 10)}${padLeft(b.pivotRow === null ? "" : String(b.pivotRow), 8)}${fixed(b.value, 17, 6)}${fixed(rate, 15, 6)}${fixed(b.z, 15, 6)}`,
    );
  }
  const last = p.segments[p.segments.length - 1];
  if (last) {
    const rate = p.kind === "rhs" && isMin ? last.slope.neg() : last.slope;
    lines.push(
      `${padRight("", 25)}${fixed(last.to, 17, 6)}${fixed(rate, 15, 6)}${fixed(last.zTo, 15, 6)}`,
    );
  }
  for (const m of p.messages) {
    lines.push("", ` ${m}`);
  }
  return `${lines.join("\n")}\n`;
}

export function reportParametric(
  model: LPModel,
  p: ParametricResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const lines: string[] = [
    `LibreIO. Análisis paramétrico ${p.kind === "rhs" ? "del lado derecho de la fila" : "del coeficiente de"} ${p.target}`,
    `Valor actual: ${number(p.current)}. Intervalo: [${number(p.from)}, ${number(p.to)}]`,
    "",
  ];
  if (p.status !== "ok") {
    lines.push(...p.messages);
    return `${lines.join("\n")}\n`;
  }
  lines.push("Tramos");
  lines.push(
    textTable(
      [
        "Desde",
        "Hasta",
        "Z",
        "Pendiente",
        "Base",
        "Solución en el inicio",
        "Solución en el fin",
      ],
      ["r", "r", "l", "r", "l", "l", "l"],
      p.segments.map((s) => [
        number(s.from),
        number(s.to),
        `${number(s.slope)} p + ${number(s.intercept)}`.replace("+ -", "- "),
        number(s.slope),
        s.basis.join(", "),
        s.solutionFrom.map((v) => `${v.name} = ${number(v.value)}`).join(", "),
        s.solutionTo.map((v) => `${v.name} = ${number(v.value)}`).join(", "),
      ]),
    ),
  );
  lines.push("", "Quiebres");
  const rateLabel =
    p.kind === "rhs" ? "Precio sombra antes" : "Valor de la variable antes";
  lines.push(
    textTable(
      ["Valor", "Z", "Sale", "Entra", "Fila pivote", rateLabel],
      ["r", "r", "l", "l", "r", "r"],
      p.breakpoints.map((b) => [
        number(b.value),
        number(b.z),
        b.leaving ?? "-",
        b.entering ?? "-",
        b.pivotRow === null ? "-" : String(b.pivotRow),
        number(b.rateBefore),
      ]),
    ),
  );
  if (p.messages.length > 0) {
    lines.push("", ...p.messages);
  }
  return `${lines.join("\n")}\n`;
}
