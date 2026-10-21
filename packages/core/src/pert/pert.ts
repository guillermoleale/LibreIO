// SPDX-License-Identifier: GPL-3.0-or-later
// PERT con tres estimaciones: duración esperada, varianza y probabilidades sobre el camino crítico.
import { Fraction } from "../rational/Fraction";
import { cpm } from "./cpm";
import { normalCdf, normalQuantile } from "./normal";
import type { PertActivity, PertResult, ProjectProblem } from "./types";

const SIX = Fraction.of(6);
const FOUR = Fraction.of(4);

export function pert(problem: ProjectProblem): PertResult {
  const activities: PertActivity[] = problem.activities.map((a) => {
    const optimistic = a.optimistic ?? a.duration;
    const mostLikely = a.mostLikely ?? a.duration;
    const pessimistic = a.pessimistic ?? a.duration;
    const expected = optimistic
      .add(mostLikely.mul(FOUR))
      .add(pessimistic)
      .div(SIX);
    const spread = pessimistic.sub(optimistic).div(SIX);
    return {
      id: a.id,
      optimistic,
      mostLikely,
      pessimistic,
      expected,
      variance: spread.mul(spread),
    };
  });
  const durations = new Map(activities.map((a) => [a.id, a.expected]));
  const result = cpm(problem, durations);
  const varianceOf = new Map(activities.map((a) => [a.id, a.variance]));
  let criticalPath: string[] = [];
  let variance = Fraction.ZERO;
  for (const path of result.criticalPaths) {
    const v = Fraction.sum(path.map((id) => varianceOf.get(id)!));
    if (criticalPath.length === 0 || v.gt(variance)) {
      criticalPath = path;
      variance = v;
    }
  }
  const mu = result.duration.toNumber();
  const sigma = Math.sqrt(variance.toNumber());
  const probabilityByDate = (date: number | Fraction): number => {
    const t = typeof date === "number" ? date : date.toNumber();
    if (sigma === 0) {
      return t >= mu ? 1 : 0;
    }
    return normalCdf((t - mu) / sigma);
  };
  const dateForProbability = (probability: number): number =>
    mu + normalQuantile(probability) * sigma;
  const messages = [
    `Duración esperada del proyecto: ${result.duration.toString()}.`,
    `Camino crítico ${criticalPath.join(" -> ")} con varianza ${variance.toString()} (desvío ${sigma.toFixed(4)}).`,
  ];
  if (result.criticalPaths.length > 1) {
    messages.push(
      "Hay más de un camino crítico: se usa el de mayor varianza para las probabilidades.",
    );
  }
  return {
    cpm: result,
    activities,
    expectedDuration: result.duration,
    criticalPath,
    variance,
    standardDeviation: sigma,
    probabilityByDate,
    dateForProbability,
    messages,
  };
}
