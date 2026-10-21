// SPDX-License-Identifier: GPL-3.0-or-later
// Una sola compra (newsvendor) con demanda discreta, uniforme o normal, y revisión continua con nivel de servicio.
import { Fraction } from "../rational/Fraction";
import { normalQuantile } from "../pert/normal";

export type DemandDistribution =
  | {
      readonly kind: "discrete";
      readonly values: Fraction[];
      readonly probabilities: Fraction[];
    }
  | { readonly kind: "uniform"; readonly min: Fraction; readonly max: Fraction }
  | { readonly kind: "normal"; readonly mean: Fraction; readonly sd: Fraction };

export interface NewsvendorInput {
  readonly cost: Fraction;
  readonly price: Fraction;
  readonly salvage?: Fraction;
  /** Costo de oportunidad adicional por unidad faltante, además del margen perdido. */
  readonly shortagePenalty?: Fraction;
  readonly demand: DemandDistribution;
}

export interface NewsvendorRow {
  readonly value: Fraction;
  readonly probability: Fraction;
  readonly cumulative: Fraction;
  readonly expectedProfit: Fraction;
}

export interface NewsvendorResult {
  readonly input: NewsvendorInput;
  readonly underageCost: Fraction;
  readonly overageCost: Fraction;
  readonly criticalRatio: Fraction;
  readonly quantity: Fraction;
  readonly z: number | null;
  readonly table: NewsvendorRow[] | null;
  readonly expectedProfit: Fraction | null;
  readonly messages: string[];
}

export function newsvendor(input: NewsvendorInput): NewsvendorResult {
  const salvage = input.salvage ?? Fraction.ZERO;
  const underage = input.price
    .sub(input.cost)
    .add(input.shortagePenalty ?? Fraction.ZERO);
  const overage = input.cost.sub(salvage);
  if (!underage.isPositive() || !overage.isPositive()) {
    throw new RangeError(
      "El precio debe superar al costo y el costo al valor de rescate",
    );
  }
  const criticalRatio = underage.div(underage.add(overage));
  const messages = [
    `Razón crítica Cu / (Cu + Co) = ${underage.toString()} / (${underage.toString()} + ${overage.toString()}) = ${criticalRatio.toString()}.`,
  ];
  const d = input.demand;
  if (d.kind === "uniform") {
    const quantity = d.min.add(d.max.sub(d.min).mul(criticalRatio));
    messages.push(
      `Demanda uniforme en [${d.min.toString()}, ${d.max.toString()}]: Q* = ${quantity.toString()}.`,
    );
    return {
      input,
      underageCost: underage,
      overageCost: overage,
      criticalRatio,
      quantity,
      z: null,
      table: null,
      expectedProfit: null,
      messages,
    };
  }
  if (d.kind === "normal") {
    const z = normalQuantile(criticalRatio.toNumber());
    const quantity = d.mean.add(
      Fraction.fromNumber(Math.round(z * 1e6) / 1e6).mul(d.sd),
    );
    messages.push(
      `Demanda normal (${d.mean.toString()}, ${d.sd.toString()}): z = ${z.toFixed(4)} y Q* = ${quantity.toDecimal(2)}.`,
    );
    return {
      input,
      underageCost: underage,
      overageCost: overage,
      criticalRatio,
      quantity,
      z,
      table: null,
      expectedProfit: null,
      messages,
    };
  }
  const pairs = d.values
    .map((value, i) => ({
      value,
      probability: d.probabilities[i] ?? Fraction.ZERO,
    }))
    .sort((a, b) => a.value.cmp(b.value));
  const total = Fraction.sum(pairs.map((p) => p.probability));
  if (!total.eq(Fraction.ONE)) {
    throw new RangeError("Las probabilidades de la demanda deben sumar 1");
  }
  const expectedProfitFor = (q: Fraction): Fraction => {
    let profit = Fraction.ZERO;
    for (const p of pairs) {
      const sold = Fraction.min(q, p.value);
      const left = q.sub(sold);
      const short = p.value.sub(sold);
      const value = input.price
        .mul(sold)
        .add(salvage.mul(left))
        .sub(input.cost.mul(q))
        .sub((input.shortagePenalty ?? Fraction.ZERO).mul(short));
      profit = profit.add(p.probability.mul(value));
    }
    return profit;
  };
  let cumulative = Fraction.ZERO;
  const table: NewsvendorRow[] = pairs.map((p) => {
    cumulative = cumulative.add(p.probability);
    return {
      value: p.value,
      probability: p.probability,
      cumulative,
      expectedProfit: expectedProfitFor(p.value),
    };
  });
  const chosen =
    table.find((row) => row.cumulative.ge(criticalRatio)) ??
    table[table.length - 1]!;
  messages.push(
    `Demanda discreta: la menor cantidad con probabilidad acumulada mayor o igual que ${criticalRatio.toString()} es ${chosen.value.toString()}.`,
  );
  return {
    input,
    underageCost: underage,
    overageCost: overage,
    criticalRatio,
    quantity: chosen.value,
    z: null,
    table,
    expectedProfit: chosen.expectedProfit,
    messages,
  };
}

export interface ContinuousReviewInput {
  readonly demand: Fraction;
  readonly orderQuantity: Fraction;
  readonly leadTime: Fraction;
  readonly leadTimeDemand: { readonly mean: Fraction; readonly sd: Fraction };
  /** Probabilidad de no quedarse sin stock durante el tiempo de entrega. */
  readonly serviceLevel: number;
}

export interface ContinuousReviewResult {
  readonly input: ContinuousReviewInput;
  readonly z: number;
  readonly safetyStock: Fraction;
  readonly reorderPoint: Fraction;
  readonly ordersPerPeriod: Fraction;
  readonly cycleTime: Fraction;
  readonly messages: string[];
}

export function continuousReview(
  input: ContinuousReviewInput,
): ContinuousReviewResult {
  if (input.serviceLevel <= 0 || input.serviceLevel >= 1) {
    throw new RangeError("El nivel de servicio debe estar entre 0 y 1");
  }
  const z = normalQuantile(input.serviceLevel);
  const zFraction = Fraction.fromNumber(Math.round(z * 1e6) / 1e6);
  const safetyStock = zFraction.mul(input.leadTimeDemand.sd);
  const reorderPoint = input.leadTimeDemand.mean.add(safetyStock);
  return {
    input,
    z,
    safetyStock,
    reorderPoint,
    ordersPerPeriod: input.demand.div(input.orderQuantity),
    cycleTime: input.orderQuantity.div(input.demand),
    messages: [
      `Nivel de servicio ${(input.serviceLevel * 100).toFixed(1)} %: z = ${z.toFixed(3)}.`,
      `Stock de seguridad z σ = ${safetyStock.toDecimal(2)} y punto de reorden μ + z σ = ${reorderPoint.toDecimal(2)}.`,
    ],
  };
}
