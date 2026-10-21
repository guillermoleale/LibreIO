// SPDX-License-Identifier: GPL-3.0-or-later
// CPM: pasada hacia adelante y hacia atrás, holguras total y libre y caminos críticos.
import { Fraction } from "../rational/Fraction";
import type { ActivityTimes, CpmResult, ProjectProblem } from "./types";

export function validateProject(problem: ProjectProblem): void {
  const ids = new Set<string>();
  for (const a of problem.activities) {
    if (a.id.trim() === "") {
      throw new RangeError("Hay una actividad sin identificador");
    }
    if (ids.has(a.id)) {
      throw new RangeError(`La actividad ${a.id} está repetida`);
    }
    ids.add(a.id);
  }
  for (const a of problem.activities) {
    for (const p of a.predecessors) {
      if (!ids.has(p)) {
        throw new RangeError(
          `La actividad ${a.id} tiene una predecesora desconocida: ${p}`,
        );
      }
    }
    if (a.duration.isNegative()) {
      throw new RangeError(`La actividad ${a.id} tiene duración negativa`);
    }
  }
}

/** Orden topológico (Kahn). Devuelve null si hay un ciclo. */
export function topologicalOrder(problem: ProjectProblem): string[] | null {
  const indegree = new Map(
    problem.activities.map((a) => [a.id, a.predecessors.length]),
  );
  const successors = new Map<string, string[]>(
    problem.activities.map((a) => [a.id, []]),
  );
  for (const a of problem.activities) {
    for (const p of a.predecessors) {
      successors.get(p)!.push(a.id);
    }
  }
  const queue = problem.activities
    .filter((a) => a.predecessors.length === 0)
    .map((a) => a.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of successors.get(id) ?? []) {
      indegree.set(s, indegree.get(s)! - 1);
      if (indegree.get(s) === 0) {
        queue.push(s);
      }
    }
  }
  return order.length === problem.activities.length ? order : null;
}

export function cpm(
  problem: ProjectProblem,
  durations?: Map<string, Fraction>,
): CpmResult {
  validateProject(problem);
  const order = topologicalOrder(problem);
  if (order === null) {
    return {
      status: "cycle",
      duration: Fraction.ZERO,
      activities: [],
      criticalPaths: [],
      order: [],
      messages: [
        "Las precedencias forman un ciclo: no se puede calcular el proyecto.",
      ],
    };
  }
  const byId = new Map(problem.activities.map((a) => [a.id, a]));
  const d = (id: string): Fraction =>
    durations?.get(id) ?? byId.get(id)!.duration;
  const successors = new Map<string, string[]>(
    problem.activities.map((a) => [a.id, []]),
  );
  for (const a of problem.activities) {
    for (const p of a.predecessors) {
      successors.get(p)!.push(a.id);
    }
  }
  const es = new Map<string, Fraction>();
  const ef = new Map<string, Fraction>();
  for (const id of order) {
    const a = byId.get(id)!;
    const start = a.predecessors.reduce(
      (max, p) => Fraction.max(max, ef.get(p)!),
      Fraction.ZERO,
    );
    es.set(id, start);
    ef.set(id, start.add(d(id)));
  }
  const duration = problem.activities.reduce(
    (max, a) => Fraction.max(max, ef.get(a.id)!),
    Fraction.ZERO,
  );
  const lf = new Map<string, Fraction>();
  const ls = new Map<string, Fraction>();
  for (const id of [...order].reverse()) {
    const succ = successors.get(id)!;
    const finish =
      succ.length === 0
        ? duration
        : succ.reduce(
            (min, s) => Fraction.min(min, ls.get(s)!),
            ls.get(succ[0]!)!,
          );
    lf.set(id, finish);
    ls.set(id, finish.sub(d(id)));
  }
  const activities: ActivityTimes[] = problem.activities.map((a) => {
    const succ = successors.get(a.id)!;
    const nextStart =
      succ.length === 0
        ? duration
        : succ.reduce(
            (min, s) => Fraction.min(min, es.get(s)!),
            es.get(succ[0]!)!,
          );
    const totalSlack = ls.get(a.id)!.sub(es.get(a.id)!);
    return {
      id: a.id,
      name: a.name,
      duration: d(a.id),
      es: es.get(a.id)!,
      ef: ef.get(a.id)!,
      ls: ls.get(a.id)!,
      lf: lf.get(a.id)!,
      totalSlack,
      freeSlack: nextStart.sub(ef.get(a.id)!),
      critical: totalSlack.isZero(),
      predecessors: [...a.predecessors],
      successors: succ,
    };
  });
  // Caminos críticos: desde las actividades críticas iniciales siguiendo sucesoras críticas sin holgura entre ellas.
  const critical = new Set(
    activities.filter((a) => a.critical).map((a) => a.id),
  );
  const criticalPaths: string[][] = [];
  const walk = (path: string[]): void => {
    const last = path[path.length - 1]!;
    const next = (successors.get(last) ?? []).filter(
      (s) => critical.has(s) && es.get(s)!.eq(ef.get(last)!),
    );
    if (next.length === 0) {
      if (ef.get(last)!.eq(duration)) {
        criticalPaths.push(path);
      }
      return;
    }
    for (const s of next) {
      walk([...path, s]);
    }
  };
  for (const a of problem.activities) {
    if (
      critical.has(a.id) &&
      a.predecessors.every(
        (p) => !critical.has(p) || !ef.get(p)!.eq(es.get(a.id)!),
      )
    ) {
      walk([a.id]);
    }
  }
  return {
    status: "ok",
    duration,
    activities,
    criticalPaths,
    order,
    messages: [
      `Duración del proyecto: ${duration.toString()}.`,
      ...criticalPaths.map((p) => `Camino crítico: ${p.join(" -> ")}.`),
    ],
  };
}
