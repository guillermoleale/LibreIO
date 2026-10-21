// SPDX-License-Identifier: GPL-3.0-or-later
// Lectura y escritura de cadenas de Markov en JSON (.io.json).
import { Fraction } from "../rational/Fraction";
import { fail, jsonNumber, jsonObject, jsonTitle } from "../queueing/parse";
import type { MarkovProblem } from "./types";

export interface MarkovFile {
  readonly problem: MarkovProblem;
  readonly initial: Fraction[] | null;
  readonly steps: number | null;
}

export function parseMarkovFile(text: string): MarkovFile {
  const root = jsonObject(text, "markov");
  const matrixRaw = root["matrix"];
  if (
    !Array.isArray(matrixRaw) ||
    matrixRaw.length === 0 ||
    matrixRaw.some((row) => !Array.isArray(row))
  ) {
    fail(`"matrix" debe ser una matriz de probabilidades`);
  }
  const matrix = (matrixRaw as unknown[][]).map((row, i) =>
    row.map((v, j) => jsonNumber(v, `matrix[${i + 1}][${j + 1}]`)),
  );
  let states: string[];
  const statesRaw = root["states"];
  if (statesRaw === undefined) {
    states = matrix.map((_, i) => `E${i + 1}`);
  } else {
    if (
      !Array.isArray(statesRaw) ||
      statesRaw.some((s) => typeof s !== "string" || s === "")
    ) {
      fail(`"states" debe ser una lista de nombres`);
    }
    states = statesRaw as string[];
  }
  if (states.length !== matrix.length) {
    fail("La cantidad de estados no coincide con la matriz");
  }
  let initial: Fraction[] | null = null;
  if (root["initial"] !== undefined && root["initial"] !== null) {
    if (!Array.isArray(root["initial"])) {
      fail(`"initial" debe ser una lista de probabilidades`);
    }
    initial = (root["initial"] as unknown[]).map((v, i) =>
      jsonNumber(v, `initial[${i + 1}]`),
    );
    if (initial.length !== states.length) {
      fail(`"initial" debe tener una probabilidad por estado`);
    }
  }
  let steps: number | null = null;
  if (root["steps"] !== undefined && root["steps"] !== null) {
    const s = jsonNumber(root["steps"], "steps");
    if (!s.isInteger() || s.isNegative()) {
      fail(`"steps" debe ser un entero no negativo`);
    }
    steps = Number(s.num);
  }
  return {
    problem: { title: jsonTitle(root), states, matrix },
    initial,
    steps,
  };
}

export function serializeMarkovFile(file: MarkovFile): string {
  const out = (f: Fraction) => (f.isInteger() ? Number(f.num) : f.toString());
  return `${JSON.stringify(
    {
      type: "markov",
      title: file.problem.title ?? undefined,
      states: file.problem.states,
      matrix: file.problem.matrix.map((row) => row.map(out)),
      initial: file.initial ? file.initial.map(out) : undefined,
      steps: file.steps ?? undefined,
    },
    null,
    2,
  )}\n`;
}
