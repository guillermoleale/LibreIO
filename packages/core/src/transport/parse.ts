// SPDX-License-Identifier: GPL-3.0-or-later
// Lectura y escritura de problemas de transporte, transbordo y asignación en JSON legible (.io.json).
import { Fraction } from "../rational/Fraction";
import { ParseError } from "../parser/ParseError";
import type {
  AssignmentProblem,
  Sense,
  TransportProblem,
  TransshipmentProblem,
} from "./types";

export type TransportFile =
  | { readonly type: "transport"; readonly problem: TransportProblem }
  | { readonly type: "transshipment"; readonly problem: TransshipmentProblem }
  | { readonly type: "assignment"; readonly problem: AssignmentProblem };

function fail(message: string): never {
  throw new ParseError(1, message);
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${what} debe ser un objeto JSON`);
  }
  return value as Record<string, unknown>;
}

function asNames(
  value: unknown,
  what: string,
  fallbackPrefix: string,
  count?: number,
): string[] {
  if (value === undefined) {
    if (count === undefined) {
      fail(`Falta la lista "${what}"`);
    }
    return Array.from({ length: count }, (_, i) => `${fallbackPrefix}${i + 1}`);
  }
  if (
    !Array.isArray(value) ||
    value.some((v) => typeof v !== "string" || v.trim() === "")
  ) {
    fail(`"${what}" debe ser una lista de nombres no vacíos`);
  }
  return value as string[];
}

function asFraction(value: unknown, what: string): Fraction {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail(`${what} debe ser un número finito`);
    }
    return Fraction.fromNumber(value);
  }
  if (typeof value === "string") {
    try {
      return Fraction.parse(value);
    } catch {
      fail(`${what}: '${value}' no es un número`);
    }
  }
  fail(`${what} debe ser un número o una fracción como "1/3"`);
}

function asCost(value: unknown, what: string): Fraction | null {
  if (value === null || value === "M" || value === "m") {
    return null;
  }
  return asFraction(value, what);
}

function asFractionList(value: unknown, what: string): Fraction[] {
  if (!Array.isArray(value)) {
    fail(`"${what}" debe ser una lista de números`);
  }
  return value.map((v, i) => asFraction(v, `${what}[${i + 1}]`));
}

function asSense(value: unknown): Sense {
  if (value === undefined || value === "min" || value === "MIN") {
    return "min";
  }
  if (value === "max" || value === "MAX") {
    return "max";
  }
  fail(`"sense" debe ser "min" o "max"`);
}

function asTitle(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asCostMatrix(
  value: unknown,
  rows: number,
  columns: number,
  rowWhat: string,
  columnWhat: string,
): Array<Array<Fraction | null>> {
  if (!Array.isArray(value) || value.length !== rows) {
    fail(`"costs" debe tener una fila por ${rowWhat} (${rows})`);
  }
  return value.map((row, i) => {
    if (!Array.isArray(row) || row.length !== columns) {
      fail(
        `La fila ${i + 1} de "costs" debe tener un costo por ${columnWhat} (${columns})`,
      );
    }
    return row.map((c, j) => asCost(c, `costs[${i + 1}][${j + 1}]`));
  });
}

export function parseTransportFile(text: string): TransportFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    fail(`El archivo no es JSON válido: ${(e as Error).message}`);
  }
  const root = asRecord(data, "El archivo");
  const type = root["type"];
  if (type === "transport") {
    const supply = asFractionList(root["supply"], "supply");
    const demand = asFractionList(root["demand"], "demand");
    const sources = asNames(root["sources"], "sources", "O", supply.length);
    const destinations = asNames(
      root["destinations"],
      "destinations",
      "D",
      demand.length,
    );
    if (
      sources.length !== supply.length ||
      destinations.length !== demand.length
    ) {
      fail("La cantidad de nombres no coincide con la de ofertas o demandas");
    }
    const costs = asCostMatrix(
      root["costs"],
      sources.length,
      destinations.length,
      "origen",
      "destino",
    );
    if (
      supply.some((s) => s.isNegative()) ||
      demand.some((d) => d.isNegative())
    ) {
      fail("Las ofertas y demandas no pueden ser negativas");
    }
    return {
      type,
      problem: {
        title: asTitle(root["title"]),
        sense: asSense(root["sense"]),
        sources,
        destinations,
        supply,
        demand,
        costs,
      },
    };
  }
  if (type === "assignment") {
    const costsRaw = root["costs"];
    if (!Array.isArray(costsRaw) || costsRaw.length === 0) {
      fail(`"costs" debe ser una matriz con al menos una fila`);
    }
    const agents = asNames(root["agents"], "agents", "A", costsRaw.length);
    const firstRow = costsRaw[0];
    const taskCount = Array.isArray(firstRow) ? firstRow.length : 0;
    const tasks = asNames(root["tasks"], "tasks", "T", taskCount);
    const costs = asCostMatrix(
      costsRaw,
      agents.length,
      tasks.length,
      "agente",
      "tarea",
    );
    return {
      type,
      problem: {
        title: asTitle(root["title"]),
        sense: asSense(root["sense"]),
        agents,
        tasks,
        costs,
      },
    };
  }
  if (type === "transshipment") {
    const nodesRaw = root["nodes"];
    if (!Array.isArray(nodesRaw) || nodesRaw.length === 0) {
      fail(`"nodes" debe ser una lista de nodos`);
    }
    const nodes = nodesRaw.map((n, i) => {
      const node = asRecord(n, `El nodo ${i + 1}`);
      const name = node["name"];
      if (typeof name !== "string" || name.trim() === "") {
        fail(`El nodo ${i + 1} necesita un "name"`);
      }
      return {
        name,
        supply:
          node["supply"] === undefined
            ? Fraction.ZERO
            : asFraction(node["supply"], `supply de ${name}`),
        demand:
          node["demand"] === undefined
            ? Fraction.ZERO
            : asFraction(node["demand"], `demand de ${name}`),
      };
    });
    const names = new Set(nodes.map((n) => n.name));
    if (names.size !== nodes.length) {
      fail("Hay nodos con el mismo nombre");
    }
    const arcsRaw = root["arcs"];
    if (!Array.isArray(arcsRaw) || arcsRaw.length === 0) {
      fail(`"arcs" debe ser una lista de arcos`);
    }
    const arcs = arcsRaw.map((a, i) => {
      const arc = asRecord(a, `El arco ${i + 1}`);
      const from = arc["from"];
      const to = arc["to"];
      if (typeof from !== "string" || !names.has(from)) {
        fail(`El arco ${i + 1} sale de un nodo desconocido`);
      }
      if (typeof to !== "string" || !names.has(to)) {
        fail(`El arco ${i + 1} llega a un nodo desconocido`);
      }
      return {
        from,
        to,
        cost: asFraction(arc["cost"], `cost del arco ${from}-${to}`),
      };
    });
    return {
      type,
      problem: {
        title: asTitle(root["title"]),
        sense: asSense(root["sense"]),
        nodes,
        arcs,
      },
    };
  }
  fail(`"type" debe ser "transport", "transshipment" o "assignment"`);
}

function costOut(c: Fraction | null): string | number | null {
  if (c === null) {
    return null;
  }
  return c.isInteger() ? Number(c.num) : c.toString();
}

function fractionOut(f: Fraction): string | number {
  return f.isInteger() ? Number(f.num) : f.toString();
}

export function serializeTransportFile(file: TransportFile): string {
  if (file.type === "transport") {
    const p = file.problem;
    return `${JSON.stringify(
      {
        type: "transport",
        title: p.title ?? undefined,
        sense: p.sense,
        sources: p.sources,
        destinations: p.destinations,
        supply: p.supply.map(fractionOut),
        demand: p.demand.map(fractionOut),
        costs: p.costs.map((row) => row.map(costOut)),
      },
      null,
      2,
    )}\n`;
  }
  if (file.type === "assignment") {
    const p = file.problem;
    return `${JSON.stringify(
      {
        type: "assignment",
        title: p.title ?? undefined,
        sense: p.sense,
        agents: p.agents,
        tasks: p.tasks,
        costs: p.costs.map((row) => row.map(costOut)),
      },
      null,
      2,
    )}\n`;
  }
  const p = file.problem;
  return `${JSON.stringify(
    {
      type: "transshipment",
      title: p.title ?? undefined,
      sense: p.sense,
      nodes: p.nodes.map((n) => ({
        name: n.name,
        ...(n.supply.isZero() ? {} : { supply: fractionOut(n.supply) }),
        ...(n.demand.isZero() ? {} : { demand: fractionOut(n.demand) }),
      })),
      arcs: p.arcs.map((a) => ({
        from: a.from,
        to: a.to,
        cost: fractionOut(a.cost),
      })),
    },
    null,
    2,
  )}\n`;
}
