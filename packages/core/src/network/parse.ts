// SPDX-License-Identifier: GPL-3.0-or-later
// Lectura y escritura de redes en JSON (.io.json).
import { Fraction } from "../rational/Fraction";
import { ParseError } from "../parser/ParseError";
import type { NetworkProblem } from "./types";

function fail(message: string): never {
  throw new ParseError(1, message);
}

function number(value: unknown, what: string): Fraction {
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

export function parseNetworkFile(text: string): NetworkProblem {
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
  if (root["type"] !== "network") {
    fail(`"type" debe ser "network"`);
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
      weight: number(
        arc["weight"] ?? arc["cost"] ?? arc["capacity"],
        `peso del arco ${from}-${to}`,
      ),
    };
  });
  const nodesRaw = root["nodes"];
  let nodes: string[] = [];
  if (nodesRaw !== undefined) {
    if (
      !Array.isArray(nodesRaw) ||
      nodesRaw.some((n) => typeof n !== "string")
    ) {
      fail(`"nodes" debe ser una lista de nombres`);
    }
    nodes = nodesRaw as string[];
  }
  return {
    title:
      typeof root["title"] === "string" && root["title"] !== ""
        ? root["title"]
        : null,
    directed: root["directed"] === true,
    nodes,
    arcs,
  };
}

export function serializeNetworkFile(problem: NetworkProblem): string {
  const out = (f: Fraction) => (f.isInteger() ? Number(f.num) : f.toString());
  return `${JSON.stringify(
    {
      type: "network",
      title: problem.title ?? undefined,
      directed: problem.directed,
      nodes: problem.nodes,
      arcs: problem.arcs.map((a) => ({
        from: a.from,
        to: a.to,
        weight: out(a.weight),
      })),
    },
    null,
    2,
  )}\n`;
}
