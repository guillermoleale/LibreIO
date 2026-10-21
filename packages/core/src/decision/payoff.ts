// SPDX-License-Identifier: GPL-3.0-or-later
// Tabla de pagos con los criterios clásicos y revisión bayesiana con información muestral.
import { Fraction } from "../rational/Fraction";

export interface PayoffProblem {
  readonly title: string | null;
  readonly sense: "max" | "min";
  readonly alternatives: string[];
  readonly states: string[];
  readonly payoffs: Fraction[][];
  readonly probabilities: Fraction[] | null;
  /** Coeficiente de optimismo de Hurwicz. */
  readonly alpha: Fraction;
}

export interface Choice {
  readonly alternative: number;
  readonly value: Fraction;
  readonly values: Fraction[];
}

export interface SavageChoice extends Choice {
  readonly regrets: Fraction[][];
}

export interface PayoffResult {
  readonly maximax: Choice;
  readonly maximin: Choice;
  readonly laplace: Choice;
  readonly hurwicz: Choice;
  readonly savage: SavageChoice;
  readonly expectedValue: Choice | null;
  readonly expectedRegret: Choice | null;
  readonly evwpi: Fraction | null;
  readonly evpi: Fraction | null;
  readonly messages: string[];
}

function best(values: Fraction[], isMax: boolean): Choice {
  let index = 0;
  values.forEach((v, i) => {
    if (isMax ? v.gt(values[index]!) : v.lt(values[index]!)) {
      index = i;
    }
  });
  return { alternative: index, value: values[index]!, values };
}

function validate(problem: PayoffProblem): void {
  const m = problem.alternatives.length;
  const n = problem.states.length;
  if (m === 0 || n === 0) {
    throw new RangeError(
      "La tabla de pagos necesita al menos una alternativa y un estado",
    );
  }
  if (
    problem.payoffs.length !== m ||
    problem.payoffs.some((row) => row.length !== n)
  ) {
    throw new RangeError(
      "La tabla de pagos no coincide con las alternativas y los estados",
    );
  }
  if (problem.probabilities) {
    if (problem.probabilities.length !== n) {
      throw new RangeError("Hace falta una probabilidad por estado");
    }
    if (
      !Fraction.sum(problem.probabilities).eq(Fraction.ONE) ||
      problem.probabilities.some((p) => p.isNegative())
    ) {
      throw new RangeError(
        "Las probabilidades deben ser no negativas y sumar 1",
      );
    }
  }
}

export function payoffAnalysis(problem: PayoffProblem): PayoffResult {
  validate(problem);
  const isMax = problem.sense === "max";
  const rows = problem.payoffs;
  const n = problem.states.length;
  const rowBest = rows.map((r) =>
    r.reduce((a, b) => (isMax ? Fraction.max(a, b) : Fraction.min(a, b))),
  );
  const rowWorst = rows.map((r) =>
    r.reduce((a, b) => (isMax ? Fraction.min(a, b) : Fraction.max(a, b))),
  );
  const maximax = best(rowBest, isMax);
  const maximin = best(rowWorst, isMax);
  const laplace = best(
    rows.map((r) => Fraction.sum(r).div(Fraction.of(n))),
    isMax,
  );
  const alpha = problem.alpha;
  const hurwicz = best(
    rows.map((_, i) =>
      alpha.mul(rowBest[i]!).add(Fraction.ONE.sub(alpha).mul(rowWorst[i]!)),
    ),
    isMax,
  );
  const columnBest = problem.states.map((_, j) =>
    rows
      .map((r) => r[j]!)
      .reduce((a, b) => (isMax ? Fraction.max(a, b) : Fraction.min(a, b))),
  );
  const regrets = rows.map((r) =>
    r.map((v, j) => (isMax ? columnBest[j]!.sub(v) : v.sub(columnBest[j]!))),
  );
  const savageChoice = best(
    regrets.map((r) => r.reduce((a, b) => Fraction.max(a, b))),
    false,
  );
  const savage: SavageChoice = { ...savageChoice, regrets };
  let expectedValue: Choice | null = null;
  let expectedRegret: Choice | null = null;
  let evwpi: Fraction | null = null;
  let evpi: Fraction | null = null;
  const messages: string[] = [];
  if (problem.probabilities) {
    const p = problem.probabilities;
    expectedValue = best(
      rows.map((r) => Fraction.sum(r.map((v, j) => v.mul(p[j]!)))),
      isMax,
    );
    expectedRegret = best(
      regrets.map((r) => Fraction.sum(r.map((v, j) => v.mul(p[j]!)))),
      false,
    );
    evwpi = Fraction.sum(columnBest.map((v, j) => v.mul(p[j]!)));
    evpi = isMax
      ? evwpi.sub(expectedValue.value)
      : expectedValue.value.sub(evwpi);
    messages.push(
      `Valor esperado: ${problem.alternatives[expectedValue.alternative]} con ${expectedValue.value.toString()}. Con información perfecta ${evwpi.toString()}, VEIP ${evpi.toString()}.`,
    );
  }
  messages.unshift(
    `${isMax ? "Maximax" : "Minimin"}: ${problem.alternatives[maximax.alternative]}. ${isMax ? "Maximin" : "Minimax"}: ${problem.alternatives[maximin.alternative]}. Laplace: ${problem.alternatives[laplace.alternative]}. Hurwicz (α = ${alpha.toString()}): ${problem.alternatives[hurwicz.alternative]}. Savage: ${problem.alternatives[savage.alternative]}.`,
  );
  return {
    maximax,
    maximin,
    laplace,
    hurwicz,
    savage,
    expectedValue,
    expectedRegret,
    evwpi,
    evpi,
    messages,
  };
}

export interface BayesProblem {
  readonly title: string | null;
  readonly states: string[];
  readonly priors: Fraction[];
  readonly alternatives: string[];
  readonly payoffs: Fraction[][];
  readonly indicators: string[];
  /** likelihoods[estado][indicador] = P(indicador | estado). */
  readonly likelihoods: Fraction[][];
  readonly sense?: "max" | "min";
}

export interface BayesResult {
  readonly withoutInformation: Choice;
  readonly evwpi: Fraction;
  readonly evpi: Fraction;
  /** joint[indicador][estado] = P(indicador y estado). */
  readonly joint: Fraction[][];
  readonly indicatorProbabilities: Fraction[];
  /** posteriors[indicador][estado] = P(estado | indicador). */
  readonly posteriors: Fraction[][];
  readonly decisions: Choice[];
  readonly evwsi: Fraction;
  readonly evsi: Fraction;
  readonly efficiency: Fraction;
  readonly messages: string[];
}

export function bayesAnalysis(problem: BayesProblem): BayesResult {
  const isMax = (problem.sense ?? "max") === "max";
  const states = problem.states.length;
  if (
    problem.priors.length !== states ||
    !Fraction.sum(problem.priors).eq(Fraction.ONE)
  ) {
    throw new RangeError(
      "Las probabilidades a priori deben sumar 1 y haber una por estado",
    );
  }
  if (
    problem.likelihoods.length !== states ||
    problem.likelihoods.some(
      (row) =>
        row.length !== problem.indicators.length ||
        !Fraction.sum(row).eq(Fraction.ONE),
    )
  ) {
    throw new RangeError(
      "Las verosimilitudes P(indicador | estado) deben sumar 1 en cada estado",
    );
  }
  const expected = (probabilities: Fraction[]): Choice =>
    best(
      problem.payoffs.map((row) =>
        Fraction.sum(row.map((v, j) => v.mul(probabilities[j]!))),
      ),
      isMax,
    );
  const withoutInformation = expected(problem.priors);
  const columnBest = problem.states.map((_, j) =>
    problem.payoffs
      .map((r) => r[j]!)
      .reduce((a, b) => (isMax ? Fraction.max(a, b) : Fraction.min(a, b))),
  );
  const evwpi = Fraction.sum(
    columnBest.map((v, j) => v.mul(problem.priors[j]!)),
  );
  const evpi = isMax
    ? evwpi.sub(withoutInformation.value)
    : withoutInformation.value.sub(evwpi);
  const joint = problem.indicators.map((_, k) =>
    problem.states.map((_, j) =>
      problem.priors[j]!.mul(problem.likelihoods[j]![k]!),
    ),
  );
  const indicatorProbabilities = joint.map((row) => Fraction.sum(row));
  const posteriors = joint.map((row, k) =>
    row.map((v) =>
      indicatorProbabilities[k]!.isZero()
        ? Fraction.ZERO
        : v.div(indicatorProbabilities[k]!),
    ),
  );
  const decisions = posteriors.map((post) => expected(post));
  const evwsi = Fraction.sum(
    decisions.map((d, k) => d.value.mul(indicatorProbabilities[k]!)),
  );
  const evsi = isMax
    ? evwsi.sub(withoutInformation.value)
    : withoutInformation.value.sub(evwsi);
  const efficiency = evpi.isZero() ? Fraction.ZERO : evsi.div(evpi);
  return {
    withoutInformation,
    evwpi,
    evpi,
    joint,
    indicatorProbabilities,
    posteriors,
    decisions,
    evwsi,
    evsi,
    efficiency,
    messages: [
      `Sin información: ${problem.alternatives[withoutInformation.alternative]} con ${withoutInformation.value.toString()}. VEIP ${evpi.toString()}.`,
      ...problem.indicators.map(
        (name, k) =>
          `P(${name}) = ${indicatorProbabilities[k]!.toString()}; posteriores ${problem.states.map((s, j) => `P(${s}|${name}) = ${posteriors[k]![j]!.toString()}`).join(", ")}; se elige ${problem.alternatives[decisions[k]!.alternative]} con ${decisions[k]!.value.toString()}.`,
      ),
      `Con información muestral ${evwsi.toString()}, VEIM ${evsi.toString()}, eficiencia ${efficiency.toString()}.`,
    ],
  };
}
