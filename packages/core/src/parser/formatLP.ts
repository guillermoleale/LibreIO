// SPDX-License-Identifier: GPL-3.0-or-later
// Escribe un modelo en el formato de la sección 4 de SPEC.md. El resultado se puede volver a parsear.
import { Fraction } from "../rational/Fraction";
import type { LPModel } from "./model";

export interface FormatOptions {
  /** Formatea cada número. Por defecto, fracción exacta. */
  readonly number?: (f: Fraction) => string;
}

/** Suma de términos como "3 X + 2 Y - Z". Devuelve "0" si todos los coeficientes son cero. */
export function formatLinearExpression(
  coefficients: readonly Fraction[],
  names: readonly string[],
  number: (f: Fraction) => string = (f) => f.toString(),
): string {
  const parts: string[] = [];
  coefficients.forEach((coef, i) => {
    if (coef.isZero()) {
      return;
    }
    const name = names[i]!;
    const magnitude = coef.abs();
    const term = magnitude.eq(Fraction.ONE)
      ? name
      : `${number(magnitude)} ${name}`;
    if (parts.length === 0) {
      parts.push(coef.isNegative() ? `- ${term}` : term);
    } else {
      parts.push(coef.isNegative() ? `- ${term}` : `+ ${term}`);
    }
  });
  return parts.length === 0 ? "0" : parts.join(" ");
}

export function formatLP(model: LPModel, options: FormatOptions = {}): string {
  const number = options.number ?? ((f: Fraction) => f.toString());
  const names = model.variables.map((v) => v.name);
  const lines: string[] = [];
  if (model.title !== null && model.title !== "") {
    lines.push(`TITLE ${model.title}`);
  }
  lines.push(
    `${model.sense === "max" ? "MAX" : "MIN"} ${formatLinearExpression(model.objective, names, number)}`,
  );
  lines.push("SUBJECT TO");
  for (const c of model.constraints) {
    const label = c.label ? `${c.label}) ` : "";
    lines.push(
      `  ${label}${formatLinearExpression(c.coefficients, names, number)} ${c.relation} ${number(c.rhs)}`,
    );
  }
  lines.push("END");
  for (const v of model.variables) {
    if (!v.lower.finite) {
      lines.push(`FREE ${v.name}`);
    } else if (!v.lower.value.isZero()) {
      lines.push(`SLB ${v.name} ${number(v.lower.value)}`);
    }
    if (v.kind === "binary") {
      lines.push(`INT ${v.name}`);
      continue;
    }
    if (v.upper.finite) {
      lines.push(`SUB ${v.name} ${number(v.upper.value)}`);
    }
    if (v.kind === "integer") {
      lines.push(`GIN ${v.name}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
