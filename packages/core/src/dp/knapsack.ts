// SPDX-License-Identifier: GPL-3.0-or-later
// Mochila por programación dinámica: una etapa por objeto, resuelta hacia atrás con la tabla
// f(etapa, capacidad) y la cantidad de unidades elegida en cada caso.
import { Fraction } from "../rational/Fraction";
import type {
  KnapsackDecision,
  KnapsackProblem,
  KnapsackResult,
  KnapsackRow,
  KnapsackStage,
} from "./types";

export function knapsack(problem: KnapsackProblem): KnapsackResult {
  if (!problem.capacity.isInteger() || problem.capacity.isNegative()) {
    throw new RangeError(
      "La capacidad y los pesos deben ser enteros no negativos",
    );
  }
  for (const item of problem.items) {
    if (!item.weight.isInteger() || !item.weight.isPositive()) {
      throw new RangeError(
        `El peso de ${item.name} debe ser entero y positivo (los pesos deben ser enteros)`,
      );
    }
    if ((item.maxUnits ?? 1) < 1 || !Number.isInteger(item.maxUnits ?? 1)) {
      throw new RangeError(
        `Las unidades de ${item.name} deben ser un entero positivo`,
      );
    }
  }
  const capacity = Number(problem.capacity.num);
  const n = problem.items.length;
  // next[c] = valor óptimo de las etapas siguientes con capacidad c
  let next: Fraction[] = Array.from(
    { length: capacity + 1 },
    () => Fraction.ZERO,
  );
  const stages: KnapsackStage[] = new Array<KnapsackStage>(n);
  const order: number[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const item = problem.items[i]!;
    const weight = Number(item.weight.num);
    const maxUnits = item.maxUnits ?? 1;
    const current: Fraction[] = [];
    const rows: KnapsackRow[] = [];
    for (let c = 0; c <= capacity; c += 1) {
      const decisions: KnapsackDecision[] = [];
      let best = Fraction.ZERO;
      let choice = 0;
      for (let u = 0; u <= maxUnits && u * weight <= c; u += 1) {
        const value = item.value.mul(Fraction.of(u)).add(next[c - u * weight]!);
        decisions.push({ units: u, value });
        if (u === 0 || value.gt(best)) {
          best = value;
          choice = u;
        }
      }
      current.push(best);
      rows.push({ capacity: Fraction.of(c), decisions, best, choice });
    }
    stages[i] = { item: i, rows };
    order.push(i);
    next = current;
  }
  // Reconstrucción hacia adelante desde la primera etapa con la capacidad total
  const units: number[] = problem.items.map(() => 0);
  let remaining = capacity;
  for (let i = 0; i < n; i += 1) {
    const row = stages[i]!.rows[remaining]!;
    units[i] = row.choice;
    remaining -= row.choice * Number(problem.items[i]!.weight.num);
  }
  const selected = units.map((u, i) => (u > 0 ? i : -1)).filter((i) => i >= 0);
  const value = n === 0 ? Fraction.ZERO : stages[0]!.rows[capacity]!.best;
  const weight = Fraction.of(capacity - remaining);
  const names = selected.map(
    (i) =>
      `${problem.items[i]!.name}${units[i]! > 1 ? ` (${units[i]} unidades)` : ""}`,
  );
  return {
    value,
    weight,
    selected,
    units,
    stages,
    order,
    messages: [
      `Valor óptimo ${value.toString()} con peso ${weight.toString()} de ${problem.capacity.toString()}.`,
      selected.length > 0
        ? `Objetos elegidos: ${names.join(", ")}.`
        : "No conviene llevar ningún objeto.",
    ],
  };
}
