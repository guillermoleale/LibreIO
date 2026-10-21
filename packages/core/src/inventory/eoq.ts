// SPDX-License-Identifier: GPL-3.0-or-later
// Lote económico: básico, con faltantes, con tasa de producción finita, con tiempo de entrega
// y con descuentos por cantidad.
import { Fraction } from "../rational/Fraction";
import { sqrtFraction } from "./sqrt";

export interface PriceBreak {
  readonly minQuantity: Fraction;
  readonly unitCost: Fraction;
}

export interface EoqInput {
  /** Demanda por período (por ejemplo por año). */
  readonly demand: Fraction;
  readonly orderCost: Fraction;
  /** Costo de mantener una unidad durante un período. Si hay descuentos se calcula como holdingRate por el precio. */
  readonly holdingCost?: Fraction;
  readonly holdingRate?: Fraction;
  readonly unitCost?: Fraction;
  readonly shortageCost?: Fraction;
  readonly productionRate?: Fraction;
  readonly leadTime?: Fraction;
  readonly priceBreaks?: PriceBreak[];
}

export interface EoqCandidate {
  readonly unitCost: Fraction;
  readonly minQuantity: Fraction;
  readonly holdingCost: Fraction;
  readonly unconstrainedQuantity: Fraction;
  readonly feasibleQuantity: Fraction;
  readonly totalCost: Fraction;
}

export interface EoqResult {
  readonly quantity: Fraction;
  readonly exact: boolean;
  readonly holdingCost: Fraction;
  readonly unitCost: Fraction | null;
  readonly orderingCost: Fraction;
  readonly holdingCostTotal: Fraction;
  readonly shortageCostTotal: Fraction;
  /** Costo de pedir más mantener (más faltantes si corresponde) por período. */
  readonly annualCost: Fraction;
  /** Costo total con compra, cuando hay precio unitario. */
  readonly totalCost: Fraction | null;
  readonly ordersPerPeriod: Fraction;
  readonly cycleTime: Fraction;
  readonly maxInventory: Fraction;
  readonly shortage: Fraction | null;
  readonly reorderPoint: Fraction | null;
  readonly candidates: EoqCandidate[] | null;
  readonly messages: string[];
}

function costAt(
  input: EoqInput,
  holding: Fraction,
  q: Fraction,
): { ordering: Fraction; holding: Fraction; shortage: Fraction } {
  const ordering = input.demand.mul(input.orderCost).div(q);
  const rate = input.productionRate
    ? Fraction.ONE.sub(input.demand.div(input.productionRate))
    : Fraction.ONE;
  if (input.shortageCost) {
    const p = input.shortageCost;
    const maxInventory = q.mul(rate).mul(p).div(holding.add(p));
    const shortage = q.mul(rate).sub(maxInventory);
    return {
      ordering,
      holding: holding
        .mul(maxInventory)
        .mul(maxInventory)
        .div(Fraction.of(2).mul(q).mul(rate)),
      shortage: p
        .mul(shortage)
        .mul(shortage)
        .div(Fraction.of(2).mul(q).mul(rate)),
    };
  }
  return {
    ordering,
    holding: holding.mul(q).mul(rate).div(Fraction.of(2)),
    shortage: Fraction.ZERO,
  };
}

function optimalQuantity(
  input: EoqInput,
  holding: Fraction,
): { value: Fraction; exact: boolean } {
  let radicand = Fraction.of(2)
    .mul(input.demand)
    .mul(input.orderCost)
    .div(holding);
  if (input.shortageCost) {
    radicand = radicand
      .mul(holding.add(input.shortageCost))
      .div(input.shortageCost);
  }
  if (input.productionRate) {
    if (!input.productionRate.gt(input.demand)) {
      throw new RangeError(
        "La tasa de producción debe ser mayor que la demanda",
      );
    }
    radicand = radicand.div(
      Fraction.ONE.sub(input.demand.div(input.productionRate)),
    );
  }
  return sqrtFraction(radicand);
}

export function eoq(input: EoqInput): EoqResult {
  if (!input.demand.isPositive() || !input.orderCost.isPositive()) {
    throw new RangeError("La demanda y el costo de pedido deben ser positivos");
  }
  const messages: string[] = [];
  if (input.priceBreaks && input.priceBreaks.length > 0) {
    const rate = input.holdingRate;
    if (!rate || !rate.isPositive()) {
      throw new RangeError(
        "Con descuentos por cantidad hace falta la tasa de mantenimiento (fracción del precio por período)",
      );
    }
    const breaks = [...input.priceBreaks].sort((a, b) =>
      a.minQuantity.cmp(b.minQuantity),
    );
    const candidates: EoqCandidate[] = breaks.map((b, i) => {
      const holding = rate.mul(b.unitCost);
      const q = optimalQuantity(input, holding).value;
      const upper = breaks[i + 1]?.minQuantity ?? null;
      let feasible = q;
      if (q.lt(b.minQuantity)) {
        feasible = b.minQuantity;
      } else if (upper !== null && q.ge(upper)) {
        feasible = upper.sub(Fraction.ONE);
        if (feasible.lt(b.minQuantity)) {
          feasible = b.minQuantity;
        }
      }
      const c = costAt(input, holding, feasible);
      const totalCost = input.demand
        .mul(b.unitCost)
        .add(c.ordering)
        .add(c.holding)
        .add(c.shortage);
      return {
        unitCost: b.unitCost,
        minQuantity: b.minQuantity,
        holdingCost: holding,
        unconstrainedQuantity: q,
        feasibleQuantity: feasible,
        totalCost,
      };
    });
    let best = candidates[0]!;
    for (const c of candidates) {
      if (c.totalCost.lt(best.totalCost)) {
        best = c;
      }
    }
    messages.push(
      `Se evalúa cada precio con su lote factible: el menor costo total es ${best.totalCost.toDecimal(2)} con precio ${best.unitCost.toString()} y lote ${best.feasibleQuantity.toDecimal(2)}.`,
    );
    const base = eoqWith(
      { ...input, holdingCost: best.holdingCost, unitCost: best.unitCost },
      best.feasibleQuantity,
      true,
      messages,
    );
    return {
      ...base,
      candidates,
      unitCost: best.unitCost,
      totalCost: best.totalCost,
    };
  }
  const holding =
    input.holdingCost ??
    (input.holdingRate && input.unitCost
      ? input.holdingRate.mul(input.unitCost)
      : null);
  if (!holding || !holding.isPositive()) {
    throw new RangeError(
      "Falta el costo de mantener (o la tasa y el precio unitario)",
    );
  }
  const q = optimalQuantity(input, holding);
  return eoqWith(
    { ...input, holdingCost: holding },
    q.value,
    q.exact,
    messages,
  );
}

function eoqWith(
  input: EoqInput,
  quantity: Fraction,
  exact: boolean,
  messages: string[],
): EoqResult {
  const holding = input.holdingCost!;
  const c = costAt(input, holding, quantity);
  const rate = input.productionRate
    ? Fraction.ONE.sub(input.demand.div(input.productionRate))
    : Fraction.ONE;
  let maxInventory = quantity.mul(rate);
  let shortage: Fraction | null = null;
  if (input.shortageCost) {
    maxInventory = quantity
      .mul(rate)
      .mul(input.shortageCost)
      .div(holding.add(input.shortageCost));
    shortage = quantity.mul(rate).sub(maxInventory);
  }
  const ordersPerPeriod = input.demand.div(quantity);
  const cycleTime = quantity.div(input.demand);
  let reorderPoint: Fraction | null = null;
  if (input.leadTime !== undefined) {
    const demandDuringLead = input.demand.mul(input.leadTime);
    reorderPoint = demandDuringLead;
    if (demandDuringLead.ge(quantity)) {
      // Tiempo de entrega mayor que el ciclo: se pide cuando el inventario llega a la demanda del resto del ciclo
      const cycles = demandDuringLead.div(quantity).floor();
      reorderPoint = demandDuringLead.sub(cycles.mul(quantity));
      messages.push(
        `El tiempo de entrega supera el ciclo: hay ${cycles.toString()} pedidos en tránsito y el punto de reorden es ${reorderPoint.toString()}.`,
      );
    }
    if (shortage) {
      reorderPoint = reorderPoint.sub(shortage);
    }
  }
  const annualCost = c.ordering.add(c.holding).add(c.shortage);
  const unitCost = input.unitCost ?? null;
  return {
    quantity,
    exact,
    holdingCost: holding,
    unitCost,
    orderingCost: c.ordering,
    holdingCostTotal: c.holding,
    shortageCostTotal: c.shortage,
    annualCost,
    totalCost: unitCost ? annualCost.add(input.demand.mul(unitCost)) : null,
    ordersPerPeriod,
    cycleTime,
    maxInventory,
    shortage,
    reorderPoint,
    candidates: null,
    messages: [
      `Lote óptimo Q* = ${exact ? quantity.toString() : quantity.toDecimal(2)} con costo de pedir más mantener ${annualCost.toDecimal(2)} por período.`,
      ...messages,
    ],
  };
}
