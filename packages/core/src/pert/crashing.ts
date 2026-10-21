// SPDX-License-Identifier: GPL-3.0-or-later
// Compresión (crashing): mínimo costo para acortar el proyecto a cada duración, resuelto como
// programa lineal con el simplex del núcleo, y curva de costo contra duración.
import { Fraction } from "../rational/Fraction";
import { INFINITY, finite } from "../rational/Extended";
import type { Constraint, LPModel, Variable } from "../parser/model";
import { solveLP } from "../lp/solveLP";
import { cpm, validateProject } from "./cpm";
import type { CrashPoint, CrashingResult, ProjectProblem } from "./types";

interface Crashable {
  readonly id: string;
  readonly maxReduction: Fraction;
  readonly costPerUnit: Fraction;
}

function crashableActivities(problem: ProjectProblem): Crashable[] {
  const list: Crashable[] = [];
  for (const a of problem.activities) {
    if (a.crashDuration === undefined || a.crashDuration.ge(a.duration)) {
      continue;
    }
    const maxReduction = a.duration.sub(a.crashDuration);
    let costPerUnit = a.crashCostPerUnit ?? null;
    if (
      costPerUnit === null &&
      a.crashCost !== undefined &&
      a.normalCost !== undefined
    ) {
      costPerUnit = a.crashCost.sub(a.normalCost).div(maxReduction);
    }
    if (costPerUnit === null) {
      continue;
    }
    list.push({ id: a.id, maxReduction, costPerUnit });
  }
  return list;
}

/** Programa lineal: mínimo costo de compresión para terminar en `target` o antes. */
function crashLP(
  problem: ProjectProblem,
  crashable: Crashable[],
  target: Fraction,
): LPModel {
  const ids = problem.activities.map((a) => a.id);
  const names: string[] = [
    ...ids.map((id) => `T_${id}`),
    ...crashable.map((c) => `Y_${c.id}`),
    "FIN",
  ];
  const index = new Map(names.map((n, i) => [n, i]));
  const n = names.length;
  const zero = () => names.map(() => Fraction.ZERO);
  const variables: Variable[] = names.map((name) => {
    const c = crashable.find((x) => `Y_${x.id}` === name);
    return {
      name,
      lower: finite(Fraction.ZERO),
      upper: c ? finite(c.maxReduction) : INFINITY,
      kind: "continuous",
    };
  });
  const objective = zero();
  for (const c of crashable) {
    objective[index.get(`Y_${c.id}`)!] = c.costPerUnit;
  }
  const constraints: Constraint[] = [];
  const crashIndex = (id: string): number | undefined => index.get(`Y_${id}`);
  for (const a of problem.activities) {
    for (const p of a.predecessors) {
      const row = zero();
      row[index.get(`T_${a.id}`)!] = Fraction.ONE;
      row[index.get(`T_${p}`)!] = Fraction.MINUS_ONE;
      const y = crashIndex(p);
      if (y !== undefined) {
        row[y] = Fraction.ONE;
      }
      constraints.push({
        label: `${p}_${a.id}`,
        row: constraints.length + 2,
        coefficients: row,
        relation: ">=",
        rhs: problem.activities.find((x) => x.id === p)!.duration,
      });
    }
  }
  for (const a of problem.activities) {
    const row = zero();
    row[index.get("FIN")!] = Fraction.ONE;
    row[index.get(`T_${a.id}`)!] = Fraction.MINUS_ONE;
    const y = crashIndex(a.id);
    if (y !== undefined) {
      row[y] = Fraction.ONE;
    }
    constraints.push({
      label: `${a.id}_FIN`,
      row: constraints.length + 2,
      coefficients: row,
      relation: ">=",
      rhs: a.duration,
    });
  }
  const limit = zero();
  limit[index.get("FIN")!] = Fraction.ONE;
  constraints.push({
    label: "PLAZO",
    row: constraints.length + 2,
    coefficients: limit,
    relation: "<=",
    rhs: target,
  });
  void n;
  return { title: null, sense: "min", variables, objective, constraints };
}

function pointFor(
  problem: ProjectProblem,
  crashable: Crashable[],
  target: Fraction,
): CrashPoint | null {
  const result = solveLP(crashLP(problem, crashable, target));
  if (result.status !== "optimal") {
    return null;
  }
  const values = new Map(
    result.solution!.variables.map((v) => [v.name, v.value]),
  );
  const durations = new Map(problem.activities.map((a) => [a.id, a.duration]));
  const crashed = crashable.map((c) => {
    const amount = values.get(`Y_${c.id}`) ?? Fraction.ZERO;
    const duration = durations.get(c.id)!.sub(amount);
    durations.set(c.id, duration);
    return { id: c.id, amount, duration };
  });
  const schedule = cpm(problem, durations);
  return {
    duration: schedule.duration,
    cost: result.solution!.objective,
    crashed,
    criticalPaths: schedule.criticalPaths,
  };
}

export function crashing(
  problem: ProjectProblem,
  target?: Fraction,
): CrashingResult {
  validateProject(problem);
  const crashable = crashableActivities(problem);
  const normal = cpm(problem);
  if (normal.status !== "ok") {
    throw new RangeError("Las precedencias forman un ciclo");
  }
  const normalDuration = normal.duration;
  const minimum = cpm(
    problem,
    new Map(
      crashable.map((c) => [
        c.id,
        problem.activities
          .find((a) => a.id === c.id)!
          .duration.sub(c.maxReduction),
      ]),
    ),
  ).duration;
  const curve: CrashPoint[] = [];
  const messages: string[] = [];
  let duration = normalDuration;
  for (let guard = 0; guard < 1000; guard += 1) {
    const point = pointFor(problem, crashable, duration);
    if (point === null) {
      break;
    }
    curve.push({ ...point, duration });
    if (duration.le(minimum)) {
      break;
    }
    duration = Fraction.max(duration.sub(Fraction.ONE), minimum);
  }
  messages.push(
    `Duración normal ${normalDuration.toString()} y mínima ${minimum.toString()} con todas las actividades en su duración de quiebre.`,
  );
  let targetResult: CrashingResult["target"] = null;
  if (target !== undefined) {
    if (target.lt(minimum)) {
      const last = curve[curve.length - 1]!;
      targetResult = { ...last, feasible: false, requested: target };
      messages.push(
        `No se puede acortar el proyecto por debajo de ${minimum.toString()}: las actividades críticas ya están en su duración de quiebre. El objetivo ${target.toString()} no es alcanzable.`,
      );
    } else {
      const point = pointFor(
        problem,
        crashable,
        Fraction.min(target, normalDuration),
      )!;
      targetResult = {
        ...point,
        duration: Fraction.min(target, normalDuration),
        feasible: true,
        requested: target,
      };
      const used = point.crashed.filter((c) => !c.amount.isZero());
      messages.push(
        `Acortar a ${targetResult.duration.toString()} cuesta ${point.cost.toString()}${used.length > 0 ? `: ${used.map((c) => `${c.id} en ${c.amount.toString()}`).join(", ")}` : ""}.`,
      );
    }
  }
  return {
    normalDuration,
    minimumDuration: minimum,
    curve,
    target: targetResult,
    crashable,
    messages,
  };
}
