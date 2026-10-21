// SPDX-License-Identifier: GPL-3.0-or-later
// Lectura y escritura de problemas de inventario en JSON (.io.json).
import { Fraction } from "../rational/Fraction";
import { fail, jsonNumber, jsonObject, jsonTitle } from "../queueing/parse";
import type { EoqInput } from "./eoq";
import type {
  ContinuousReviewInput,
  DemandDistribution,
  NewsvendorInput,
} from "./newsvendor";

export type InventoryFile =
  | {
      readonly model: "eoq";
      readonly title: string | null;
      readonly input: EoqInput;
    }
  | {
      readonly model: "newsvendor";
      readonly title: string | null;
      readonly input: NewsvendorInput;
    }
  | {
      readonly model: "continuousReview";
      readonly title: string | null;
      readonly input: ContinuousReviewInput;
    };

function demand(value: unknown): DemandDistribution {
  if (typeof value !== "object" || value === null) {
    fail(`"demand" debe describir la distribución de la demanda`);
  }
  const d = value as Record<string, unknown>;
  if (d["kind"] === "uniform") {
    return {
      kind: "uniform",
      min: jsonNumber(d["min"], "min"),
      max: jsonNumber(d["max"], "max"),
    };
  }
  if (d["kind"] === "normal") {
    return {
      kind: "normal",
      mean: jsonNumber(d["mean"], "mean"),
      sd: jsonNumber(d["sd"], "sd"),
    };
  }
  if (d["kind"] === "discrete") {
    const values = d["values"];
    const probabilities = d["probabilities"];
    if (
      !Array.isArray(values) ||
      !Array.isArray(probabilities) ||
      values.length !== probabilities.length ||
      values.length === 0
    ) {
      fail(
        `La demanda discreta necesita "values" y "probabilities" de igual largo`,
      );
    }
    return {
      kind: "discrete",
      values: values.map((v, i) => jsonNumber(v, `values[${i + 1}]`)),
      probabilities: probabilities.map((v, i) =>
        jsonNumber(v, `probabilities[${i + 1}]`),
      ),
    };
  }
  fail(`"demand.kind" debe ser "uniform", "normal" o "discrete"`);
}

export function parseInventoryFile(text: string): InventoryFile {
  const root = jsonObject(text, "inventory");
  const title = jsonTitle(root);
  const model = root["model"];
  if (model === "eoq") {
    const breaks = root["priceBreaks"];
    const input: EoqInput = {
      demand: jsonNumber(root["demand"], "demand"),
      orderCost: jsonNumber(root["orderCost"], "orderCost"),
      ...(root["holdingCost"] !== undefined
        ? { holdingCost: jsonNumber(root["holdingCost"], "holdingCost") }
        : {}),
      ...(root["holdingRate"] !== undefined
        ? { holdingRate: jsonNumber(root["holdingRate"], "holdingRate") }
        : {}),
      ...(root["unitCost"] !== undefined
        ? { unitCost: jsonNumber(root["unitCost"], "unitCost") }
        : {}),
      ...(root["shortageCost"] !== undefined
        ? { shortageCost: jsonNumber(root["shortageCost"], "shortageCost") }
        : {}),
      ...(root["productionRate"] !== undefined
        ? {
            productionRate: jsonNumber(
              root["productionRate"],
              "productionRate",
            ),
          }
        : {}),
      ...(root["leadTime"] !== undefined
        ? { leadTime: jsonNumber(root["leadTime"], "leadTime") }
        : {}),
      ...(Array.isArray(breaks)
        ? {
            priceBreaks: breaks.map((b, i) => {
              if (typeof b !== "object" || b === null) {
                fail(`El descuento ${i + 1} debe ser un objeto`);
              }
              const bb = b as Record<string, unknown>;
              return {
                minQuantity: jsonNumber(
                  bb["minQuantity"],
                  `minQuantity del descuento ${i + 1}`,
                ),
                unitCost: jsonNumber(
                  bb["unitCost"],
                  `unitCost del descuento ${i + 1}`,
                ),
              };
            }),
          }
        : {}),
    };
    return { model, title, input };
  }
  if (model === "newsvendor") {
    const input: NewsvendorInput = {
      cost: jsonNumber(root["cost"], "cost"),
      price: jsonNumber(root["price"], "price"),
      ...(root["salvage"] !== undefined
        ? { salvage: jsonNumber(root["salvage"], "salvage") }
        : {}),
      ...(root["shortagePenalty"] !== undefined
        ? {
            shortagePenalty: jsonNumber(
              root["shortagePenalty"],
              "shortagePenalty",
            ),
          }
        : {}),
      demand: demand(root["demand"]),
    };
    return { model, title, input };
  }
  if (model === "continuousReview") {
    const ltd = root["leadTimeDemand"];
    if (typeof ltd !== "object" || ltd === null) {
      fail(`"leadTimeDemand" debe tener media y desvío`);
    }
    const l = ltd as Record<string, unknown>;
    const level = root["serviceLevel"];
    if (typeof level !== "number" || level <= 0 || level >= 1) {
      fail(`"serviceLevel" debe ser un número entre 0 y 1`);
    }
    const input: ContinuousReviewInput = {
      demand: jsonNumber(root["demand"], "demand"),
      orderQuantity: jsonNumber(root["orderQuantity"], "orderQuantity"),
      leadTime: jsonNumber(root["leadTime"], "leadTime"),
      leadTimeDemand: {
        mean: jsonNumber(l["mean"], "mean"),
        sd: jsonNumber(l["sd"], "sd"),
      },
      serviceLevel: level,
    };
    return { model, title, input };
  }
  fail(`"model" debe ser "eoq", "newsvendor" o "continuousReview"`);
}

export function serializeInventoryFile(file: InventoryFile): string {
  const out = (f: Fraction | undefined) =>
    f === undefined ? undefined : f.isInteger() ? Number(f.num) : f.toString();
  let body: Record<string, unknown>;
  if (file.model === "eoq") {
    const i = file.input;
    body = {
      demand: out(i.demand),
      orderCost: out(i.orderCost),
      holdingCost: out(i.holdingCost),
      holdingRate: out(i.holdingRate),
      unitCost: out(i.unitCost),
      shortageCost: out(i.shortageCost),
      productionRate: out(i.productionRate),
      leadTime: out(i.leadTime),
      priceBreaks: i.priceBreaks?.map((b) => ({
        minQuantity: out(b.minQuantity),
        unitCost: out(b.unitCost),
      })),
    };
  } else if (file.model === "newsvendor") {
    const i = file.input;
    const d = i.demand;
    body = {
      cost: out(i.cost),
      price: out(i.price),
      salvage: out(i.salvage),
      shortagePenalty: out(i.shortagePenalty),
      demand:
        d.kind === "uniform"
          ? { kind: "uniform", min: out(d.min), max: out(d.max) }
          : d.kind === "normal"
            ? { kind: "normal", mean: out(d.mean), sd: out(d.sd) }
            : {
                kind: "discrete",
                values: d.values.map((v) => out(v)),
                probabilities: d.probabilities.map((v) => out(v)),
              },
    };
  } else {
    const i = file.input;
    body = {
      demand: out(i.demand),
      orderQuantity: out(i.orderQuantity),
      leadTime: out(i.leadTime),
      leadTimeDemand: {
        mean: out(i.leadTimeDemand.mean),
        sd: out(i.leadTimeDemand.sd),
      },
      serviceLevel: i.serviceLevel,
    };
  }
  return `${JSON.stringify({ type: "inventory", title: file.title ?? undefined, model: file.model, ...body }, null, 2)}\n`;
}
