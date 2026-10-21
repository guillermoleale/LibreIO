// SPDX-License-Identifier: GPL-3.0-or-later
// Reporte en formato clásico de LINDO, en inglés y con el mismo layout del programa original.
import { Fraction } from "../rational/Fraction";
import type { Extended } from "../rational/Extended";
import type { LPModel } from "../parser/model";
import type { LPResult } from "../lp/solveLP";
import type { Tableau } from "../lp/tableau";
import { fixed, padLeft } from "./format";

/** Valor de la función objetivo con siete cifras significativas, como LINDO. */
export function formatObjectiveValue(z: Fraction): string {
  if (z.isZero()) {
    return "0.0000000";
  }
  const magnitude = z.abs();
  const integerDigits = magnitude.ge(Fraction.ONE)
    ? magnitude.floor().toString().length
    : 0;
  if (integerDigits > 7) {
    return z
      .toNumber()
      .toExponential(6)
      .replace("e+", "E+")
      .replace("e-", "E-")
      .toUpperCase();
  }
  return z.toDecimal(7 - integerDigits);
}

function extendedFixed(x: Extended, width: number, decimals: number): string {
  if (x.finite) {
    return fixed(x.value, width, decimals);
  }
  return padLeft(x.sign > 0 ? "INFINITY" : "-INFINITY", width);
}

function rowName(label: string | null, row: number): string {
  return `${label ?? row})`;
}

export function reportClassic(model: LPModel, result: LPResult): string {
  const lines: string[] = [];
  const step = padLeft(String(result.iterations), 7);
  if (result.status === "unbounded") {
    lines.push(` UNBOUNDED SOLUTION AT STEP${step}`);
    lines.push("");
    lines.push(` UNBOUNDED VARIABLE IS: ${result.unboundedVariable ?? ""}`);
    return `${lines.join("\n")}\n`;
  }
  if (result.status === "infeasible") {
    lines.push(` NO FEASIBLE SOLUTION AT STEP${step}`);
    lines.push("");
    const sum = Fraction.sum((result.infeasibility ?? []).map((i) => i.value));
    lines.push(` SUM OF INFEASIBILITIES=${fixed(sum, 17, 6)}`);
    lines.push("");
    lines.push(
      " VIOLATED ROWS HAVE NEGATIVE SLACK, OR (EQUALITY ROWS) NONZERO SLACKS.",
    );
    lines.push(" INFEASIBLE ARTIFICIAL VARIABLES:");
    for (const item of result.infeasibility ?? []) {
      lines.push(`${padLeft(item.artificial, 10)}${fixed(item.value, 17, 6)}`);
    }
    return `${lines.join("\n")}\n`;
  }
  const solution = result.solution!;
  const sensitivity = result.sensitivity!;
  lines.push(` LP OPTIMUM FOUND AT STEP${step}`);
  lines.push("");
  lines.push("        OBJECTIVE FUNCTION VALUE");
  lines.push("");
  lines.push(
    `        1)${padLeft(formatObjectiveValue(solution.objective), 14)}`,
  );
  lines.push("");
  lines.push("  VARIABLE        VALUE          REDUCED COST");
  for (const v of sensitivity.variables) {
    lines.push(
      `${padLeft(v.name, 10)}${fixed(v.value, 17, 6)}${fixed(v.reducedCost, 18, 6)}`,
    );
  }
  lines.push("");
  lines.push("       ROW   SLACK OR SURPLUS     DUAL PRICES");
  for (const c of sensitivity.constraints) {
    lines.push(
      `${padLeft(rowName(c.label, c.row), 10)}${fixed(c.slack, 17, 6)}${fixed(c.dualPrice, 18, 6)}`,
    );
  }
  lines.push("");
  lines.push(` NO. ITERATIONS=${padLeft(String(result.iterations), 8)}`);
  lines.push("");
  lines.push(" RANGES IN WHICH THE BASIS IS UNCHANGED:");
  lines.push("");
  lines.push("                           OBJ COEFFICIENT RANGES");
  lines.push(" VARIABLE         CURRENT        ALLOWABLE        ALLOWABLE");
  lines.push("                   COEF          INCREASE         DECREASE");
  for (const v of sensitivity.variables) {
    lines.push(
      `${padLeft(v.name, 9)}${fixed(v.cost, 16, 6)}${extendedFixed(v.costIncrease, 17, 6)}${extendedFixed(v.costDecrease, 17, 6)}`,
    );
  }
  lines.push("");
  lines.push("                           RIGHTHAND SIDE RANGES");
  lines.push("      ROW         CURRENT        ALLOWABLE        ALLOWABLE");
  lines.push("                    RHS          INCREASE         DECREASE");
  for (const c of sensitivity.constraints) {
    lines.push(
      `${padLeft(c.label ?? String(c.row), 9)}${fixed(c.rhs, 16, 6)}${extendedFixed(c.rhsIncrease, 17, 6)}${extendedFixed(c.rhsDecrease, 17, 6)}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

/** Tableau en el formato de LINDO TABL: fila 1 con base ART y los costos reducidos, después una fila por restricción. */
export function reportClassicTableau(t: Tableau, decimals = 3): string {
  const number = (f: Fraction): string => f.toDecimal(decimals);
  const cells: string[][] = [];
  const objective = t.objectiveRow.map((v) => v.format(number));
  cells.push(["1", "ART", ...objective, t.objectiveValue.format(number)]);
  t.rows.forEach((row, i) => {
    const basic = t.columns[t.basis[i]!]!;
    const rowNumber = i + 2;
    cells.push([
      String(rowNumber),
      basic.name,
      ...row.map(number),
      number(t.rhs[i]!),
    ]);
  });
  const headers = ["ROW", "(BASIS)", ...t.columns.map((c) => c.name), "RHS"];
  const widths = headers.map((h, j) =>
    Math.max(j === 0 ? 10 : 9, h.length, ...cells.map((r) => r[j]!.length)),
  );
  const line = (r: string[]): string =>
    r.map((cell, j) => padLeft(cell, widths[j]!)).join("");
  return (
    [" THE TABLEAU", "", line(headers), ...cells.map(line)].join("\n") + "\n"
  );
}
