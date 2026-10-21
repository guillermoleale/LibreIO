// SPDX-License-Identifier: GPL-3.0-or-later
// Lectura y escritura de modelos de colas en JSON (.io.json).
import { Fraction } from "../rational/Fraction";
import { ParseError } from "../parser/ParseError";
import type { QueueCosts, QueueKind, QueueModel } from "./types";

const KINDS: QueueKind[] = [
  "MM1",
  "MMs",
  "MM1K",
  "MMsK",
  "MMsN",
  "MG1",
  "MD1",
  "MEk1",
];

export function fail(message: string): never {
  throw new ParseError(1, message);
}

export function jsonObject(
  text: string,
  expectedType: string | string[],
): Record<string, unknown> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    fail(`El archivo no es JSON válido: ${(e as Error).message}`);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    fail("El archivo debe ser un objeto JSON");
  }
  const root = data as Record<string, unknown>;
  const types = Array.isArray(expectedType) ? expectedType : [expectedType];
  if (!types.includes(String(root["type"]))) {
    fail(`"type" debe ser ${types.map((t) => `"${t}"`).join(" o ")}`);
  }
  return root;
}

export function jsonNumber(value: unknown, what: string): Fraction {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Fraction.fromNumber(value);
  }
  if (typeof value === "string") {
    try {
      return Fraction.parse(value);
    } catch {
      fail(`${what}: '${value}' no es un número`);
    }
  }
  fail(`${what} debe ser un número`);
}

export function jsonOptional(
  value: unknown,
  what: string,
): Fraction | undefined {
  return value === undefined || value === null || value === ""
    ? undefined
    : jsonNumber(value, what);
}

export function jsonInteger(value: unknown, what: string): number {
  const f = jsonNumber(value, what);
  if (!f.isInteger()) {
    fail(`${what} debe ser entero`);
  }
  return Number(f.num);
}

export function jsonTitle(root: Record<string, unknown>): string | null {
  return typeof root["title"] === "string" && root["title"] !== ""
    ? root["title"]
    : null;
}

export interface QueueFile {
  readonly model: QueueModel;
  readonly costs: QueueCosts | null;
}

export function parseQueueFile(text: string): QueueFile {
  const root = jsonObject(text, "queue");
  const kind = String(root["kind"]) as QueueKind;
  if (!KINDS.includes(kind)) {
    fail(`"kind" debe ser uno de ${KINDS.join(", ")}`);
  }
  const model: QueueModel = {
    kind,
    title: jsonTitle(root),
    lambda: jsonNumber(root["lambda"], "lambda"),
    mu: jsonNumber(root["mu"], "mu"),
    ...(root["servers"] !== undefined
      ? { servers: jsonInteger(root["servers"], "servers") }
      : {}),
    ...(root["capacity"] !== undefined
      ? { capacity: jsonInteger(root["capacity"], "capacity") }
      : {}),
    ...(root["population"] !== undefined
      ? { population: jsonInteger(root["population"], "population") }
      : {}),
    ...(root["serviceVariance"] !== undefined
      ? {
          serviceVariance: jsonNumber(
            root["serviceVariance"],
            "serviceVariance",
          ),
        }
      : {}),
    ...(root["phases"] !== undefined
      ? { phases: jsonInteger(root["phases"], "phases") }
      : {}),
  };
  let costs: QueueCosts | null = null;
  const c = root["costs"];
  if (typeof c === "object" && c !== null) {
    const cc = c as Record<string, unknown>;
    costs = {
      serverCost: jsonNumber(cc["serverCost"], "serverCost"),
      waitingCost: jsonNumber(cc["waitingCost"], "waitingCost"),
      ...(cc["basis"] === "queue" ? { basis: "queue" as const } : {}),
    };
  }
  return { model, costs };
}

export function serializeQueueFile(file: QueueFile): string {
  const out = (f: Fraction | undefined) =>
    f === undefined ? undefined : f.isInteger() ? Number(f.num) : f.toString();
  const m = file.model;
  return `${JSON.stringify(
    {
      type: "queue",
      title: m.title ?? undefined,
      kind: m.kind,
      lambda: out(m.lambda),
      mu: out(m.mu),
      servers: m.servers,
      capacity: m.capacity,
      population: m.population,
      serviceVariance: out(m.serviceVariance),
      phases: m.phases,
      costs: file.costs
        ? {
            serverCost: out(file.costs.serverCost),
            waitingCost: out(file.costs.waitingCost),
            basis: file.costs.basis,
          }
        : undefined,
    },
    null,
    2,
  )}\n`;
}
