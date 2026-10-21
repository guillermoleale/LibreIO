// SPDX-License-Identifier: GPL-3.0-or-later
// Soluciones iniciales del problema de transporte: esquina noroeste, mínimo de matriz, de fila y de columna,
// Vogel y Russell, con la traza de cada asignación.
import { Fraction } from "../rational/Fraction";
import { MValue } from "../lp/MValue";
import { internalMatrix, totalCost } from "./costs";
import type {
  Cell,
  InitialMethod,
  InitialSolution,
  InitialStep,
  TransportProblem,
} from "./types";

interface State {
  readonly m: number;
  readonly n: number;
  readonly costs: MValue[][];
  readonly supply: Fraction[];
  readonly demand: Fraction[];
  readonly crossedRows: boolean[];
  readonly crossedColumns: boolean[];
  readonly allocation: Array<Array<Fraction | null>>;
  readonly steps: InitialStep[];
}

function snapshot(
  state: State,
  cell: Cell | null,
  amount: Fraction | null,
  note: string,
  extra: Partial<InitialStep> = {},
): void {
  state.steps.push({
    cell,
    amount,
    note,
    remainingSupply: [...state.supply],
    remainingDemand: [...state.demand],
    crossedRows: [...state.crossedRows],
    crossedColumns: [...state.crossedColumns],
    ...extra,
  });
}

function allocate(
  state: State,
  cell: Cell,
  sourceName: string,
  destinationName: string,
  extra: Partial<InitialStep> = {},
): void {
  const { i, j } = cell;
  const amount = Fraction.min(state.supply[i]!, state.demand[j]!);
  state.allocation[i]![j] = (state.allocation[i]![j] ?? Fraction.ZERO).add(
    amount,
  );
  state.supply[i] = state.supply[i]!.sub(amount);
  state.demand[j] = state.demand[j]!.sub(amount);
  const parts: string[] = [
    `Se asignan ${amount.toString()} unidades a (${sourceName}, ${destinationName}).`,
  ];
  if (state.supply[i]!.isZero() && state.demand[j]!.isZero()) {
    parts.push(
      "Se agotan la oferta y la demanda a la vez: se tachan la fila y la columna (solución degenerada).",
    );
  } else if (state.supply[i]!.isZero()) {
    parts.push(`Se agota la oferta de ${sourceName}: se tacha la fila.`);
  } else {
    parts.push(
      `Se satisface la demanda de ${destinationName}: se tacha la columna.`,
    );
  }
  if (state.supply[i]!.isZero()) {
    state.crossedRows[i] = true;
  }
  if (state.demand[j]!.isZero()) {
    state.crossedColumns[j] = true;
  }
  snapshot(state, cell, amount, parts.join(" "), extra);
}

function done(state: State): boolean {
  return (
    state.crossedRows.every(Boolean) || state.crossedColumns.every(Boolean)
  );
}

function activeCells(state: State): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < state.m; i += 1) {
    if (state.crossedRows[i]) {
      continue;
    }
    for (let j = 0; j < state.n; j += 1) {
      if (!state.crossedColumns[j]) {
        cells.push({ i, j });
      }
    }
  }
  return cells;
}

function cheapest(state: State, cells: Cell[]): Cell | null {
  let best: Cell | null = null;
  for (const cell of cells) {
    if (
      best === null ||
      state.costs[cell.i]![cell.j]!.cmp(state.costs[best.i]![best.j]!) < 0
    ) {
      best = cell;
    }
  }
  return best;
}

function penalty(values: MValue[]): MValue | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a.cmp(b));
  if (sorted.length === 1) {
    return sorted[0]!;
  }
  return sorted[1]!.sub(sorted[0]!);
}

export function initialSolution(
  problem: TransportProblem,
  method: InitialMethod,
): InitialSolution {
  const m = problem.sources.length;
  const n = problem.destinations.length;
  const state: State = {
    m,
    n,
    costs: internalMatrix(problem.costs, problem.sense),
    supply: [...problem.supply],
    demand: [...problem.demand],
    crossedRows: problem.sources.map(() => false),
    crossedColumns: problem.destinations.map(() => false),
    allocation: problem.sources.map(() => problem.destinations.map(() => null)),
    steps: [],
  };
  const src = (i: number) => problem.sources[i]!;
  const dst = (j: number) => problem.destinations[j]!;
  let guard = 0;
  while (!done(state) && guard < m * n + 2) {
    guard += 1;
    const cells = activeCells(state);
    if (cells.length === 0) {
      break;
    }
    if (method === "northwest") {
      const i = state.crossedRows.findIndex((c) => !c);
      const j = state.crossedColumns.findIndex((c) => !c);
      allocate(state, { i, j }, src(i), dst(j));
    } else if (method === "matrixMinimum") {
      const cell = cheapest(state, cells)!;
      allocate(state, cell, src(cell.i), dst(cell.j));
    } else if (method === "rowMinimum") {
      const i = state.crossedRows.findIndex((c) => !c);
      const cell = cheapest(
        state,
        cells.filter((c) => c.i === i),
      )!;
      allocate(state, cell, src(cell.i), dst(cell.j));
    } else if (method === "columnMinimum") {
      const j = state.crossedColumns.findIndex((c) => !c);
      const cell = cheapest(
        state,
        cells.filter((c) => c.j === j),
      )!;
      allocate(state, cell, src(cell.i), dst(cell.j));
    } else if (method === "vogel") {
      const rowPenalties = state.crossedRows.map((crossed, i) =>
        crossed
          ? null
          : penalty(
              cells.filter((c) => c.i === i).map((c) => state.costs[i]![c.j]!),
            ),
      );
      const columnPenalties = state.crossedColumns.map((crossed, j) =>
        crossed
          ? null
          : penalty(
              cells.filter((c) => c.j === j).map((c) => state.costs[c.i]![j]!),
            ),
      );
      let bestPenalty: MValue | null = null;
      let chosen: { kind: "row" | "column"; index: number } | null = null;
      rowPenalties.forEach((p, i) => {
        if (p !== null && (bestPenalty === null || p.cmp(bestPenalty) > 0)) {
          bestPenalty = p;
          chosen = { kind: "row", index: i };
        }
      });
      columnPenalties.forEach((p, j) => {
        if (p !== null && (bestPenalty === null || p.cmp(bestPenalty) > 0)) {
          bestPenalty = p;
          chosen = { kind: "column", index: j };
        }
      });
      const pick = chosen as { kind: "row" | "column"; index: number } | null;
      const candidates =
        pick === null
          ? cells
          : cells.filter((c) =>
              pick.kind === "row" ? c.i === pick.index : c.j === pick.index,
            );
      const cell = cheapest(state, candidates)!;
      const where =
        pick === null
          ? ""
          : pick.kind === "row"
            ? `Mayor penalización en la fila ${src(pick.index)}. `
            : `Mayor penalización en la columna ${dst(pick.index)}. `;
      allocate(state, cell, src(cell.i), dst(cell.j), {
        rowPenalties,
        columnPenalties,
      });
      const last = state.steps[state.steps.length - 1]!;
      state.steps[state.steps.length - 1] = {
        ...last,
        note: `${where}${last.note}`,
      };
    } else {
      // Russell: u_i y v_j son los mayores costos de la fila y la columna; se elige el menor c_ij - u_i - v_j.
      const rowValues = state.crossedRows.map((crossed, i) => {
        if (crossed) {
          return null;
        }
        const values = cells
          .filter((c) => c.i === i)
          .map((c) => state.costs[i]![c.j]!);
        return values.reduce((a, b) => (b.cmp(a) > 0 ? b : a));
      });
      const columnValues = state.crossedColumns.map((crossed, j) => {
        if (crossed) {
          return null;
        }
        const values = cells
          .filter((c) => c.j === j)
          .map((c) => state.costs[c.i]![j]!);
        return values.reduce((a, b) => (b.cmp(a) > 0 ? b : a));
      });
      let best: Cell | null = null;
      let bestDelta: MValue | null = null;
      for (const cell of cells) {
        const delta = state.costs[cell.i]![cell.j]!.sub(rowValues[cell.i]!).sub(
          columnValues[cell.j]!,
        );
        if (bestDelta === null || delta.cmp(bestDelta) < 0) {
          bestDelta = delta;
          best = cell;
        }
      }
      allocate(state, best!, src(best!.i), dst(best!.j), {
        rowValues,
        columnValues,
      });
    }
  }
  const basicCount = state.allocation.flat().filter((v) => v !== null).length;
  return {
    method,
    allocation: state.allocation,
    cost: totalCost(state.costs, state.allocation),
    basicCount,
    degenerate: basicCount < m + n - 1,
    steps: state.steps,
  };
}

export const INITIAL_METHOD_NAMES: Record<InitialMethod, string> = {
  northwest: "esquina noroeste",
  matrixMinimum: "mínimo de matriz",
  rowMinimum: "mínimo de fila",
  columnMinimum: "mínimo de columna",
  vogel: "Vogel",
  russell: "Russell",
};
