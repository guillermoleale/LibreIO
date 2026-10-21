// SPDX-License-Identifier: GPL-3.0-or-later
// Método húngaro con traza: reducción por filas y columnas, cobertura mínima de ceros y ajuste.
import { Fraction } from "../rational/Fraction";
import { MValue } from "../lp/MValue";
import { internalMatrix } from "./costs";
import type {
  AssignmentProblem,
  AssignmentResult,
  Cell,
  HungarianStep,
} from "./types";

export const DUMMY_AGENT = "Ficticio";

function cloneMatrix(matrix: MValue[][]): MValue[][] {
  return matrix.map((row) => [...row]);
}

/** Emparejamiento máximo de ceros por caminos de aumento. Devuelve la columna asignada a cada fila. */
function maximumMatching(zero: boolean[][]): number[] {
  const n = zero.length;
  const matchRow: number[] = Array.from({ length: n }, () => -1);
  const matchCol: number[] = Array.from({ length: n }, () => -1);
  const tryRow = (i: number, visited: boolean[]): boolean => {
    for (let j = 0; j < n; j += 1) {
      if (!zero[i]![j] || visited[j]) {
        continue;
      }
      visited[j] = true;
      if (matchCol[j] === -1 || tryRow(matchCol[j]!, visited)) {
        matchRow[i] = j;
        matchCol[j] = i;
        return true;
      }
    }
    return false;
  };
  for (let i = 0; i < n; i += 1) {
    tryRow(
      i,
      Array.from({ length: n }, () => false),
    );
  }
  return matchRow;
}

/** Cobertura mínima de ceros a partir del emparejamiento máximo (teorema de König). */
function minimumCover(
  zero: boolean[][],
  matchRow: number[],
): { rows: number[]; columns: number[] } {
  const n = zero.length;
  const matchCol: number[] = Array.from({ length: n }, () => -1);
  matchRow.forEach((j, i) => {
    if (j >= 0) {
      matchCol[j] = i;
    }
  });
  const visitedRows = Array.from({ length: n }, () => false);
  const visitedCols = Array.from({ length: n }, () => false);
  const queue: number[] = [];
  for (let i = 0; i < n; i += 1) {
    if (matchRow[i] === -1) {
      visitedRows[i] = true;
      queue.push(i);
    }
  }
  while (queue.length > 0) {
    const i = queue.shift()!;
    for (let j = 0; j < n; j += 1) {
      if (!zero[i]![j] || visitedCols[j] || matchRow[i] === j) {
        continue;
      }
      visitedCols[j] = true;
      const k = matchCol[j]!;
      if (k >= 0 && !visitedRows[k]) {
        visitedRows[k] = true;
        queue.push(k);
      }
    }
  }
  const rows: number[] = [];
  const columns: number[] = [];
  for (let i = 0; i < n; i += 1) {
    if (!visitedRows[i]) {
      rows.push(i);
    }
    if (visitedCols[i]) {
      columns.push(i);
    }
  }
  return { rows, columns };
}

export function solveAssignment(original: AssignmentProblem): AssignmentResult {
  const messages: string[] = [];
  let problem = original;
  let balanced: AssignmentResult["balanced"] = null;
  const m = original.agents.length;
  const n0 = original.tasks.length;
  if (m < n0) {
    const amount = n0 - m;
    problem = {
      ...original,
      agents: [
        ...original.agents,
        ...Array.from({ length: amount }, (_, k) =>
          amount === 1 ? DUMMY_AGENT : `${DUMMY_AGENT} ${k + 1}`,
        ),
      ],
      costs: [
        ...original.costs,
        ...Array.from({ length: amount }, () =>
          original.tasks.map(() => Fraction.ZERO),
        ),
      ],
    };
    balanced = { kind: "agent", amount };
    messages.push(
      `Hay más tareas que agentes: se agregan ${amount} agente${amount === 1 ? "" : "s"} ficticio${amount === 1 ? "" : "s"} con costo 0.`,
    );
  } else if (n0 < m) {
    const amount = m - n0;
    problem = {
      ...original,
      tasks: [
        ...original.tasks,
        ...Array.from({ length: amount }, (_, k) =>
          amount === 1 ? DUMMY_AGENT : `${DUMMY_AGENT} ${k + 1}`,
        ),
      ],
      costs: original.costs.map((row) => [
        ...row,
        ...Array.from({ length: amount }, () => Fraction.ZERO),
      ]),
    };
    balanced = { kind: "task", amount };
    messages.push(
      `Hay más agentes que tareas: se agregan ${amount} tarea${amount === 1 ? "" : "s"} ficticia${amount === 1 ? "" : "s"} con costo 0.`,
    );
  }
  const n = problem.agents.length;
  const internal = internalMatrix(problem.costs, problem.sense);
  const steps: HungarianStep[] = [];
  let matrix = cloneMatrix(internal);
  steps.push({
    kind: "start",
    matrix: cloneMatrix(matrix),
    note:
      problem.sense === "max"
        ? "Maximización: se cambia el signo de los costos para minimizar."
        : "Matriz de costos.",
  });
  // Reducción por filas
  matrix = matrix.map((row) => {
    const min = row.reduce((a, b) => (b.cmp(a) < 0 ? b : a));
    return row.map((v) => v.sub(min));
  });
  steps.push({
    kind: "rowReduction",
    matrix: cloneMatrix(matrix),
    note: "Se resta el mínimo de cada fila.",
  });
  // Reducción por columnas
  for (let j = 0; j < n; j += 1) {
    let min = matrix[0]![j]!;
    for (let i = 1; i < n; i += 1) {
      if (matrix[i]![j]!.cmp(min) < 0) {
        min = matrix[i]![j]!;
      }
    }
    for (let i = 0; i < n; i += 1) {
      matrix[i]![j] = matrix[i]![j]!.sub(min);
    }
  }
  steps.push({
    kind: "columnReduction",
    matrix: cloneMatrix(matrix),
    note: "Se resta el mínimo de cada columna.",
  });

  let assignment: Cell[] = [];
  for (let guard = 0; guard < 100; guard += 1) {
    const zero = matrix.map((row) => row.map((v) => v.isZero()));
    const matchRow = maximumMatching(zero);
    const cover = minimumCover(zero, matchRow);
    const lines = cover.rows.length + cover.columns.length;
    steps.push({
      kind: "cover",
      matrix: cloneMatrix(matrix),
      coveredRows: cover.rows,
      coveredColumns: cover.columns,
      note: `Se cubren los ceros con ${lines} línea${lines === 1 ? "" : "s"} (${cover.rows.length} fila${cover.rows.length === 1 ? "" : "s"} y ${cover.columns.length} columna${cover.columns.length === 1 ? "" : "s"}).${lines >= n ? " Hay tantas líneas como filas: existe una asignación óptima entre los ceros." : ""}`,
    });
    if (lines >= n) {
      assignment = matchRow.map((j, i) => ({ i, j }));
      break;
    }
    // Ajuste: restar el mínimo no cubierto a los no cubiertos y sumarlo a los doblemente cubiertos.
    let minimum: MValue | null = null;
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (cover.rows.includes(i) || cover.columns.includes(j)) {
          continue;
        }
        if (minimum === null || matrix[i]![j]!.cmp(minimum) < 0) {
          minimum = matrix[i]![j]!;
        }
      }
    }
    const delta = minimum as MValue | null;
    if (delta === null) {
      break;
    }
    matrix = matrix.map((row, i) =>
      row.map((v, j) => {
        const coveredRow = cover.rows.includes(i);
        const coveredCol = cover.columns.includes(j);
        if (!coveredRow && !coveredCol) {
          return v.sub(delta);
        }
        if (coveredRow && coveredCol) {
          return v.add(delta);
        }
        return v;
      }),
    );
    steps.push({
      kind: "adjust",
      matrix: cloneMatrix(matrix),
      minimum: delta,
      note: `Faltan líneas. Se resta el mínimo no cubierto (${delta.toString()}) a las celdas sin cubrir y se suma a las cubiertas dos veces.`,
    });
  }
  steps.push({
    kind: "assignment",
    matrix: cloneMatrix(matrix),
    assignment,
    note: "Asignación sobre los ceros independientes.",
  });

  let total = MValue.ZERO;
  for (const cell of assignment) {
    total = total.add(internal[cell.i]![cell.j]!);
  }
  const status =
    total.m.isZero() && assignment.length === n ? "optimal" : "infeasible";
  const objective = problem.sense === "max" ? total.c.neg() : total.c;
  const realAssignment = assignment
    .filter((c) => c.i < original.agents.length && c.j < original.tasks.length)
    .map((c) => ({ agent: c.i, task: c.j }))
    .sort((a, b) => a.agent - b.agent);
  if (status === "infeasible") {
    messages.push(
      "No existe una asignación completa sin usar celdas prohibidas.",
    );
  } else {
    messages.push(`Asignación óptima con costo ${objective.toString()}.`);
  }
  return {
    original,
    problem,
    balanced,
    status,
    assignment: realAssignment,
    objective,
    steps,
    messages,
  };
}
