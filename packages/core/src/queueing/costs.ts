// SPDX-License-Identifier: GPL-3.0-or-later
// Análisis de costos y de capacidad de un sistema de colas.
import { Fraction } from "../rational/Fraction";
import { solveQueue } from "./models";
import type {
  CapacityAnalysis,
  QueueCostResult,
  QueueCosts,
  QueueModel,
  QueueResult,
} from "./types";

export function queueCost(
  result: QueueResult,
  costs: QueueCosts,
): QueueCostResult {
  const basis = costs.basis ?? "system";
  const customers = basis === "system" ? result.L : result.Lq;
  const serviceCost = costs.serverCost.mul(Fraction.of(result.servers));
  const waitingCostTotal = costs.waitingCost.mul(customers);
  return {
    servers: result.servers,
    serviceCost,
    waitingCostTotal,
    total: serviceCost.add(waitingCostTotal),
    basis,
  };
}

export interface CapacityOptions {
  readonly vary: "servers" | "lambda" | "mu" | "capacity";
  readonly values: Fraction[];
}

export function capacityAnalysis(
  base: QueueModel,
  options: CapacityOptions,
  costs?: QueueCosts,
): CapacityAnalysis {
  const rows = options.values.map((value) => {
    let model: QueueModel;
    if (options.vary === "servers") {
      const s = Number(value.toNumber());
      const kind =
        base.kind === "MM1" || base.kind === "MMs"
          ? "MMs"
          : base.kind === "MM1K" || base.kind === "MMsK"
            ? "MMsK"
            : base.kind;
      model = { ...base, kind, servers: s };
    } else if (options.vary === "lambda") {
      model = { ...base, lambda: value };
    } else if (options.vary === "mu") {
      model = { ...base, mu: value };
    } else {
      model = { ...base, capacity: Number(value.toNumber()) };
    }
    const result = solveQueue(model);
    const cost = costs && result.stable ? queueCost(result, costs) : null;
    return { value, model, result, cost };
  });
  let best: number | null = null;
  rows.forEach((row, i) => {
    if (
      row.cost &&
      (best === null || row.cost.total.lt(rows[best]!.cost!.total))
    ) {
      best = i;
    }
  });
  const chosen = best as number | null;
  return {
    vary: options.vary,
    rows,
    best: chosen,
    messages:
      chosen === null
        ? []
        : [
            `La alternativa de menor costo es ${options.vary} = ${rows[chosen]!.value.toString()} con costo ${rows[chosen]!.cost!.total.toString()} por unidad de tiempo.`,
          ],
  };
}
