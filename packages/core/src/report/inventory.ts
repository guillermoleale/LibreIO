// SPDX-License-Identifier: GPL-3.0-or-later
// Reportes de inventarios.
import type { EoqInput, EoqResult } from "../inventory/eoq";
import type {
  ContinuousReviewResult,
  NewsvendorResult,
} from "../inventory/newsvendor";
import { numberFormatter, textTable, type NumberOptions } from "./format";

export function reportEoq(
  input: EoqInput,
  r: EoqResult,
  options: NumberOptions = {},
): string {
  const number = r.exact
    ? numberFormatter(options)
    : numberFormatter({
        numberFormat: "decimal",
        decimals: options.decimals ?? 2,
      });
  const lines = ["LibreIO. Lote económico"];
  lines.push(
    `Demanda ${input.demand.toString()}, costo de pedido ${input.orderCost.toString()}, costo de mantener ${r.holdingCost.toString()}`,
  );
  if (input.shortageCost) {
    lines.push(`Costo de faltante ${input.shortageCost.toString()}`);
  }
  if (input.productionRate) {
    lines.push(`Tasa de producción ${input.productionRate.toString()}`);
  }
  lines.push("", `Q* = ${number(r.quantity)}`);
  lines.push(
    textTable(
      ["Concepto", "Valor"],
      ["l", "r"],
      [
        ["Costo de pedir por período", number(r.orderingCost)],
        ["Costo de mantener por período", number(r.holdingCostTotal)],
        ...(input.shortageCost
          ? [["Costo de faltantes por período", number(r.shortageCostTotal)]]
          : []),
        ["Costo de pedir más mantener", number(r.annualCost)],
        ...(r.totalCost
          ? [["Costo total con compra", number(r.totalCost)]]
          : []),
        ["Pedidos por período", number(r.ordersPerPeriod)],
        ["Ciclo", number(r.cycleTime)],
        ["Inventario máximo", number(r.maxInventory)],
        ...(r.shortage ? [["Faltante máximo", number(r.shortage)]] : []),
        ...(r.reorderPoint
          ? [["Punto de reorden", number(r.reorderPoint)]]
          : []),
      ],
    ),
  );
  if (r.candidates) {
    lines.push("", "Descuentos por cantidad");
    lines.push(
      textTable(
        ["Precio", "Desde", "Q sin restricción", "Q factible", "Costo total"],
        ["r", "r", "r", "r", "r"],
        r.candidates.map((c) => [
          c.unitCost.toString(),
          c.minQuantity.toString(),
          c.unconstrainedQuantity.toDecimal(2),
          c.feasibleQuantity.toDecimal(2),
          c.totalCost.toDecimal(2),
        ]),
      ),
    );
  }
  lines.push("", ...r.messages);
  return `${lines.join("\n")}\n`;
}

export function reportNewsvendor(
  r: NewsvendorResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const lines = ["LibreIO. Una sola compra (newsvendor)"];
  lines.push(
    `Costo ${r.input.cost.toString()}, precio ${r.input.price.toString()}, rescate ${(r.input.salvage ?? r.input.cost.sub(r.overageCost)).toString()}`,
  );
  lines.push(
    "",
    `Costo de faltante Cu = ${number(r.underageCost)}, costo de sobrante Co = ${number(r.overageCost)}`,
  );
  lines.push(`Razón crítica = ${number(r.criticalRatio)}`);
  lines.push(
    `Q* = ${r.z === null ? number(r.quantity) : r.quantity.toDecimal(2)}`,
  );
  if (r.table) {
    lines.push(
      "",
      textTable(
        [
          "Demanda",
          "Probabilidad",
          "Acumulada",
          "Ganancia esperada si Q = demanda",
        ],
        ["r", "r", "r", "r"],
        r.table.map((row) => [
          number(row.value),
          number(row.probability),
          number(row.cumulative),
          number(row.expectedProfit),
        ]),
      ),
    );
  }
  lines.push("", ...r.messages);
  return `${lines.join("\n")}\n`;
}

export function reportContinuousReview(
  r: ContinuousReviewResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter({
    numberFormat: "decimal",
    decimals: options.decimals ?? 1,
  });
  const lines = ["LibreIO. Revisión continua"];
  lines.push(
    `Demanda ${r.input.demand.toString()}, lote ${r.input.orderQuantity.toString()}, tiempo de entrega ${r.input.leadTime.toString()}`,
  );
  lines.push(
    `Demanda en el tiempo de entrega normal con media ${r.input.leadTimeDemand.mean.toString()} y desvío ${r.input.leadTimeDemand.sd.toString()}`,
  );
  lines.push(
    "",
    `z = ${r.z.toFixed(3)} para un nivel de servicio del ${(r.input.serviceLevel * 100).toFixed(1)} %`,
  );
  lines.push(`Stock de seguridad: ${number(r.safetyStock)}`);
  lines.push(`Punto de reorden: ${number(r.reorderPoint)}`);
  lines.push(
    `Pedidos por período: ${r.ordersPerPeriod.toString()}, ciclo ${r.cycleTime.toString()}`,
  );
  return `${lines.join("\n")}\n`;
}
