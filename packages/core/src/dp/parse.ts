// SPDX-License-Identifier: GPL-3.0-or-later
// Lectura y escritura de problemas de programación dinámica en JSON (.io.json).
import { Fraction } from "../rational/Fraction";
import {
  fail,
  jsonInteger,
  jsonNumber,
  jsonObject,
  jsonTitle,
} from "../queueing/parse";
import type { KnapsackProblem, StagecoachProblem } from "./types";

export type DpFile =
  | { readonly type: "knapsack"; readonly problem: KnapsackProblem }
  | { readonly type: "stagecoach"; readonly problem: StagecoachProblem };

export function parseDpFile(text: string): DpFile {
  const root = jsonObject(text, ["knapsack", "stagecoach"]);
  const title = jsonTitle(root);
  if (root["type"] === "knapsack") {
    const itemsRaw = root["items"];
    if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
      fail(`"items" debe ser una lista de objetos con peso y valor`);
    }
    const items = itemsRaw.map((item, i) => {
      if (typeof item !== "object" || item === null) {
        fail(`El objeto ${i + 1} debe ser un objeto JSON`);
      }
      const it = item as Record<string, unknown>;
      const name =
        typeof it["name"] === "string" && it["name"] !== ""
          ? it["name"]
          : String(i + 1);
      return {
        name,
        weight: jsonNumber(it["weight"], `peso de ${name}`),
        value: jsonNumber(it["value"], `valor de ${name}`),
        ...(it["maxUnits"] !== undefined
          ? { maxUnits: jsonInteger(it["maxUnits"], `unidades de ${name}`) }
          : {}),
      };
    });
    return {
      type: "knapsack",
      problem: {
        title,
        capacity: jsonNumber(root["capacity"], "capacity"),
        items,
      },
    };
  }
  const arcsRaw = root["arcs"];
  if (!Array.isArray(arcsRaw) || arcsRaw.length === 0) {
    fail(`"arcs" debe ser una lista de arcos`);
  }
  const arcs = arcsRaw.map((a, i) => {
    if (typeof a !== "object" || a === null) {
      fail(`El arco ${i + 1} debe ser un objeto`);
    }
    const arc = a as Record<string, unknown>;
    const from = arc["from"];
    const to = arc["to"];
    if (
      typeof from !== "string" ||
      from === "" ||
      typeof to !== "string" ||
      to === ""
    ) {
      fail(`El arco ${i + 1} necesita "from" y "to"`);
    }
    return {
      from,
      to,
      cost: jsonNumber(
        arc["cost"] ?? arc["weight"],
        `costo del arco ${from}-${to}`,
      ),
    };
  });
  let stages: string[][] | null = null;
  const stagesRaw = root["stages"];
  if (stagesRaw !== undefined && stagesRaw !== null) {
    if (
      !Array.isArray(stagesRaw) ||
      stagesRaw.some(
        (s) => !Array.isArray(s) || s.some((x) => typeof x !== "string"),
      )
    ) {
      fail(`"stages" debe ser una lista de listas de estados`);
    }
    stages = stagesRaw as string[][];
  }
  const sense = root["sense"];
  if (sense !== undefined && sense !== "min" && sense !== "max") {
    fail(`"sense" debe ser "min" o "max"`);
  }
  return {
    type: "stagecoach",
    problem: {
      title,
      stages,
      arcs,
      ...(sense === "max" ? { sense: "max" as const } : {}),
    },
  };
}

export function serializeDpFile(file: DpFile): string {
  const out = (f: Fraction) => (f.isInteger() ? Number(f.num) : f.toString());
  if (file.type === "knapsack") {
    const p = file.problem;
    return `${JSON.stringify(
      {
        type: "knapsack",
        title: p.title ?? undefined,
        capacity: out(p.capacity),
        items: p.items.map((i) => ({
          name: i.name,
          weight: out(i.weight),
          value: out(i.value),
          maxUnits: i.maxUnits,
        })),
      },
      null,
      2,
    )}\n`;
  }
  const p = file.problem;
  return `${JSON.stringify(
    {
      type: "stagecoach",
      title: p.title ?? undefined,
      sense: p.sense,
      stages: p.stages ?? undefined,
      arcs: p.arcs.map((a) => ({ from: a.from, to: a.to, cost: out(a.cost) })),
    },
    null,
    2,
  )}\n`;
}
