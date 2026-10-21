// SPDX-License-Identifier: GPL-3.0-or-later
// Borradores editables (texto por celda) de los problemas de transporte, transbordo y asignación.
import {
  Fraction,
  type AssignmentProblem,
  type TransportFile,
  type TransportProblem,
  type TransshipmentProblem,
} from "@libreio/core";

export type Sense = "min" | "max";

export interface TransportDraft {
  title: string;
  sense: Sense;
  sources: string[];
  destinations: string[];
  supply: string[];
  demand: string[];
  costs: string[][];
}

export interface TransshipmentDraft {
  title: string;
  sense: Sense;
  nodes: Array<{ name: string; supply: string; demand: string }>;
  arcs: Array<{ from: string; to: string; cost: string }>;
}

export interface AssignmentDraft {
  title: string;
  sense: Sense;
  agents: string[];
  tasks: string[];
  costs: string[][];
}

export type Kind = "transport" | "transshipment" | "assignment";

const fr = (f: Fraction) => f.toString();
const costText = (c: Fraction | null) => (c === null ? "M" : c.toString());

export function transportToDraft(p: TransportProblem): TransportDraft {
  return {
    title: p.title ?? "",
    sense: p.sense,
    sources: [...p.sources],
    destinations: [...p.destinations],
    supply: p.supply.map(fr),
    demand: p.demand.map(fr),
    costs: p.costs.map((row) => row.map(costText)),
  };
}

export function transshipmentToDraft(
  p: TransshipmentProblem,
): TransshipmentDraft {
  return {
    title: p.title ?? "",
    sense: p.sense,
    nodes: p.nodes.map((n) => ({
      name: n.name,
      supply: n.supply.isZero() ? "" : fr(n.supply),
      demand: n.demand.isZero() ? "" : fr(n.demand),
    })),
    arcs: p.arcs.map((a) => ({ from: a.from, to: a.to, cost: fr(a.cost) })),
  };
}

export function assignmentToDraft(p: AssignmentProblem): AssignmentDraft {
  return {
    title: p.title ?? "",
    sense: p.sense,
    agents: [...p.agents],
    tasks: [...p.tasks],
    costs: p.costs.map((row) => row.map(costText)),
  };
}

export function fileToDrafts(file: TransportFile): {
  kind: Kind;
  transport?: TransportDraft;
  transshipment?: TransshipmentDraft;
  assignment?: AssignmentDraft;
} {
  if (file.type === "transport") {
    return { kind: "transport", transport: transportToDraft(file.problem) };
  }
  if (file.type === "transshipment") {
    return {
      kind: "transshipment",
      transshipment: transshipmentToDraft(file.problem),
    };
  }
  return { kind: "assignment", assignment: assignmentToDraft(file.problem) };
}

export interface BuildResult<T> {
  readonly problem: T | null;
  readonly invalid: Set<string>;
}

function number(
  text: string,
  key: string,
  invalid: Set<string>,
  fallback: Fraction | null = null,
): Fraction {
  const trimmed = text.trim();
  if (trimmed === "" && fallback !== null) {
    return fallback;
  }
  try {
    const value = Fraction.parse(trimmed);
    if (value.isNegative()) {
      invalid.add(key);
    }
    return value;
  } catch {
    invalid.add(key);
    return Fraction.ZERO;
  }
}

function cost(
  text: string,
  key: string,
  invalid: Set<string>,
): Fraction | null {
  const trimmed = text.trim().toUpperCase();
  if (trimmed === "M" || trimmed === "-") {
    return null;
  }
  try {
    return Fraction.parse(trimmed);
  } catch {
    invalid.add(key);
    return Fraction.ZERO;
  }
}

function name(
  text: string,
  key: string,
  invalid: Set<string>,
  others: string[],
): string {
  const trimmed = text.trim();
  if (trimmed === "" || others.filter((o) => o.trim() === trimmed).length > 1) {
    invalid.add(key);
  }
  return trimmed;
}

export function buildTransport(
  d: TransportDraft,
): BuildResult<TransportProblem> {
  const invalid = new Set<string>();
  const sources = d.sources.map((s, i) =>
    name(s, `source-${i}`, invalid, d.sources),
  );
  const destinations = d.destinations.map((s, j) =>
    name(s, `destination-${j}`, invalid, d.destinations),
  );
  const supply = d.supply.map((s, i) => number(s, `supply-${i}`, invalid));
  const demand = d.demand.map((s, j) => number(s, `demand-${j}`, invalid));
  const costs = d.costs.map((row, i) =>
    row.map((c, j) => cost(c, `cost-${i}-${j}`, invalid)),
  );
  if (sources.length === 0 || destinations.length === 0) {
    invalid.add("size");
  }
  return {
    problem:
      invalid.size > 0
        ? null
        : {
            title: d.title.trim() === "" ? null : d.title.trim(),
            sense: d.sense,
            sources,
            destinations,
            supply,
            demand,
            costs,
          },
    invalid,
  };
}

export function buildAssignment(
  d: AssignmentDraft,
): BuildResult<AssignmentProblem> {
  const invalid = new Set<string>();
  const agents = d.agents.map((s, i) =>
    name(s, `agent-${i}`, invalid, d.agents),
  );
  const tasks = d.tasks.map((s, j) => name(s, `task-${j}`, invalid, d.tasks));
  const costs = d.costs.map((row, i) =>
    row.map((c, j) => cost(c, `cost-${i}-${j}`, invalid)),
  );
  if (agents.length === 0 || tasks.length === 0) {
    invalid.add("size");
  }
  return {
    problem:
      invalid.size > 0
        ? null
        : {
            title: d.title.trim() === "" ? null : d.title.trim(),
            sense: d.sense,
            agents,
            tasks,
            costs,
          },
    invalid,
  };
}

export function buildTransshipment(
  d: TransshipmentDraft,
): BuildResult<TransshipmentProblem> {
  const invalid = new Set<string>();
  const names = d.nodes.map((n) => n.name);
  const nodes = d.nodes.map((n, i) => ({
    name: name(n.name, `node-${i}`, invalid, names),
    supply: number(n.supply, `node-supply-${i}`, invalid, Fraction.ZERO),
    demand: number(n.demand, `node-demand-${i}`, invalid, Fraction.ZERO),
  }));
  const known = new Set(nodes.map((n) => n.name));
  const arcs = d.arcs.map((a, k) => {
    if (!known.has(a.from.trim())) {
      invalid.add(`arc-from-${k}`);
    }
    if (!known.has(a.to.trim()) || a.to.trim() === a.from.trim()) {
      invalid.add(`arc-to-${k}`);
    }
    let value = Fraction.ZERO;
    try {
      value = Fraction.parse(a.cost.trim());
    } catch {
      invalid.add(`arc-cost-${k}`);
    }
    return { from: a.from.trim(), to: a.to.trim(), cost: value };
  });
  if (nodes.length < 2 || arcs.length === 0) {
    invalid.add("size");
  }
  return {
    problem:
      invalid.size > 0
        ? null
        : {
            title: d.title.trim() === "" ? null : d.title.trim(),
            sense: d.sense,
            nodes,
            arcs,
          },
    invalid,
  };
}

export const emptyTransport: TransportDraft = {
  title: "",
  sense: "min",
  sources: ["O1", "O2"],
  destinations: ["D1", "D2"],
  supply: ["10", "10"],
  demand: ["10", "10"],
  costs: [
    ["1", "2"],
    ["3", "4"],
  ],
};

export const emptyAssignment: AssignmentDraft = {
  title: "",
  sense: "min",
  agents: ["A1", "A2"],
  tasks: ["T1", "T2"],
  costs: [
    ["1", "2"],
    ["3", "4"],
  ],
};

export const emptyTransshipment: TransshipmentDraft = {
  title: "",
  sense: "min",
  nodes: [
    { name: "S", supply: "10", demand: "" },
    { name: "T", supply: "", demand: "" },
    { name: "D", supply: "", demand: "10" },
  ],
  arcs: [
    { from: "S", to: "T", cost: "1" },
    { from: "T", to: "D", cost: "2" },
  ],
};
