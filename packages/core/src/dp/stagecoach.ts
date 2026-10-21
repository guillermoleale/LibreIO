// SPDX-License-Identifier: GPL-3.0-or-later
// Diligencia (camino en etapas) por programación dinámica hacia atrás con la tabla de cada etapa.
import { Fraction } from "../rational/Fraction";
import type {
  StagecoachArc,
  StagecoachProblem,
  StagecoachResult,
  StagecoachRow,
  StagecoachTable,
} from "./types";

/** Deduce las etapas por distancia en arcos desde los estados sin arcos entrantes. */
export function deduceStages(arcs: StagecoachArc[]): string[][] {
  const nodes: string[] = [];
  for (const a of arcs) {
    if (!nodes.includes(a.from)) {
      nodes.push(a.from);
    }
    if (!nodes.includes(a.to)) {
      nodes.push(a.to);
    }
  }
  const hasIncoming = new Set(arcs.map((a) => a.to));
  const level = new Map<string, number>();
  const queue: string[] = [];
  for (const n of nodes) {
    if (!hasIncoming.has(n)) {
      level.set(n, 0);
      queue.push(n);
    }
  }
  while (queue.length > 0) {
    const u = queue.shift()!;
    for (const a of arcs) {
      if (a.from === u && !level.has(a.to)) {
        level.set(a.to, level.get(u)! + 1);
        queue.push(a.to);
      }
    }
  }
  const stages: string[][] = [];
  for (const n of nodes) {
    const l = level.get(n);
    if (l === undefined) {
      continue;
    }
    while (stages.length <= l) {
      stages.push([]);
    }
    stages[l]!.push(n);
  }
  return stages;
}

export function stagecoach(problem: StagecoachProblem): StagecoachResult {
  const sense = problem.sense ?? "min";
  const stages = problem.stages ?? deduceStages(problem.arcs);
  const better = (a: Fraction, b: Fraction): boolean =>
    sense === "min" ? a.lt(b) : a.gt(b);
  const f: Record<string, Fraction> = {};
  const decisions: Record<string, string> = {};
  const tables: StagecoachTable[] = [];
  const messages: string[] = [];
  let infeasible = stages.length === 0;
  for (const s of stages[stages.length - 1] ?? []) {
    f[s] = Fraction.ZERO;
  }
  for (let k = stages.length - 2; k >= 0; k -= 1) {
    const nextStates = stages[k + 1]!;
    const rows: StagecoachRow[] = stages[k]!.map((state) => {
      const candidates = problem.arcs
        .filter(
          (a) =>
            a.from === state &&
            nextStates.includes(a.to) &&
            f[a.to] !== undefined,
        )
        .map((a) => ({
          next: a.to,
          cost: a.cost,
          total: a.cost.add(f[a.to]!),
        }));
      let best: Fraction | null = null;
      let decision: string | null = null;
      for (const c of candidates) {
        if (best === null || better(c.total, best)) {
          best = c.total;
          decision = c.next;
        }
      }
      if (best === null || decision === null) {
        infeasible = true;
        messages.push(
          `El estado ${state} de la etapa ${k + 1} no tiene salida hacia la etapa ${k + 2}.`,
        );
        return { state, candidates, best: Fraction.ZERO, decision: null };
      }
      f[state] = best;
      decisions[state] = decision;
      return { state, candidates, best, decision };
    });
    tables.push({ stage: k + 1, rows });
  }
  const starts = stages[0] ?? [];
  let start: string | null = null;
  for (const s of starts) {
    if (f[s] !== undefined && (start === null || better(f[s]!, f[start]!))) {
      start = s;
    }
  }
  const path: string[] = [];
  if (start !== null && !infeasible) {
    let cursor: string | undefined = start;
    while (cursor !== undefined) {
      path.push(cursor);
      cursor = decisions[cursor];
    }
  }
  const status = infeasible || start === null ? "infeasible" : "optimal";
  const cost = status === "optimal" ? f[start!]! : null;
  if (status === "optimal") {
    messages.unshift(
      `${sense === "min" ? "Costo mínimo" : "Costo máximo"} ${cost!.toString()} por ${path.join(" -> ")}.`,
    );
  } else {
    messages.unshift("No existe un camino completo por todas las etapas.");
  }
  return {
    status,
    sense,
    stagesUsed: stages,
    tables,
    f,
    decisions,
    path,
    cost,
    messages,
  };
}
