// SPDX-License-Identifier: GPL-3.0-or-later
// Reporte de cadenas de Markov: matriz, clasificación, estado estable, tiempos de primer paso y absorción.
import type { Fraction } from "../rational/Fraction";
import type { MarkovProblem, MarkovResult } from "../markov/types";
import { numberFormatter, textTable, type NumberOptions } from "./format";

export interface MarkovReportOptions extends NumberOptions {
  readonly steps?: number;
  readonly initial?: Fraction[];
}

function matrixTable(
  states: string[],
  rows: Fraction[][],
  number: (f: Fraction) => string,
  columns: string[] = states,
): string {
  return textTable(
    ["", ...columns],
    ["l", ...columns.map(() => "r" as const)],
    rows.map((row, i) => [states[i]!, ...row.map(number)]),
  );
}

export function reportMarkov(
  problem: MarkovProblem,
  r: MarkovResult,
  options: MarkovReportOptions = {},
): string {
  const number = numberFormatter(options);
  const lines = ["LibreIO. Cadenas de Markov"];
  if (problem.title) {
    lines.push(`Problema: ${problem.title}`);
  }
  lines.push(
    "",
    "Matriz de transición",
    matrixTable(r.states, r.matrix, number),
    "",
  );
  lines.push("Clasificación de estados");
  lines.push(
    textTable(
      ["Clase", "Estados", "Tipo"],
      ["r", "l", "l"],
      r.classes.map((c, k) => [
        String(k + 1),
        c.states.join(", "),
        c.recurrent
          ? c.states.length === 1 && r.absorbingStates.includes(c.states[0]!)
            ? "absorbente"
            : "recurrente"
          : "transitoria",
      ]),
    ),
  );
  lines.push(
    `La cadena ${r.irreducible ? "es irreducible" : "no es irreducible"}${r.period !== null ? `, período ${r.period}` : ""}${r.regular ? ", regular" : r.periodic ? ", periódica" : ""}.`,
  );
  if (options.initial && options.steps !== undefined) {
    lines.push(
      "",
      `Distribución en n pasos desde (${options.initial.map(number).join(", ")})`,
    );
    const rows: string[][] = [];
    for (let k = 0; k <= options.steps; k += 1) {
      rows.push([
        String(k),
        ...r.distributionAfter(options.initial, k).map(number),
      ]);
    }
    lines.push(
      textTable(
        ["n", ...r.states],
        ["r", ...r.states.map(() => "r" as const)],
        rows,
      ),
    );
  }
  if (r.stationary) {
    lines.push(
      "",
      r.regular
        ? "Estado estable"
        : "Distribución estacionaria (la cadena es periódica y no converge)",
    );
    lines.push(
      textTable(
        r.states,
        r.states.map(() => "r" as const),
        [r.stationary.map(number)],
      ),
    );
  }
  if (r.meanFirstPassage && r.recurrenceTimes) {
    lines.push(
      "",
      "Tiempos medios de primer paso (fila: desde, columna: hasta; en la diagonal el tiempo de recurrencia)",
    );
    lines.push(matrixTable(r.states, r.meanFirstPassage, number));
    lines.push(
      "",
      `Tiempos de recurrencia: ${r.states.map((s, i) => `${s} = ${number(r.recurrenceTimes![i]!)}`).join(", ")}`,
    );
  }
  if (r.absorbing) {
    const a = r.absorbing;
    lines.push("", "Análisis de absorción");
    lines.push(
      "Matriz fundamental N = (I - Q)^-1",
      matrixTable(a.transient, a.N, number, a.transient),
    );
    lines.push(
      "",
      "Probabilidades de absorción B = N R",
      matrixTable(a.transient, a.B, number, a.absorbing),
    );
    lines.push(
      "",
      `Pasos esperados hasta la absorción: ${a.transient.map((s, i) => `desde ${s} ${number(a.expectedSteps[i]!)}`).join(", ")}`,
    );
  }
  lines.push("", ...r.messages);
  return `${lines.join("\n")}\n`;
}
