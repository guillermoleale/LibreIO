// SPDX-License-Identifier: GPL-3.0-or-later
// Lectura y escritura de problemas de decisión en JSON (.io.json): tabla de pagos, Bayes, árbol y juego.
import { Fraction } from "../rational/Fraction";
import {
  fail,
  jsonNumber,
  jsonObject,
  jsonOptional,
  jsonTitle,
} from "../queueing/parse";
import type { BayesProblem, PayoffProblem } from "./payoff";
import type { DecisionTree, TreeNode } from "./tree";

export type DecisionFile =
  | { readonly type: "payoff"; readonly problem: PayoffProblem }
  | { readonly type: "bayes"; readonly problem: BayesProblem }
  | { readonly type: "tree"; readonly tree: DecisionTree }
  | {
      readonly type: "game";
      readonly title: string | null;
      readonly rows: string[];
      readonly columns: string[];
      readonly matrix: Fraction[][];
    };

function names(
  value: unknown,
  what: string,
  count: number,
  prefix: string,
): string[] {
  if (value === undefined) {
    return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
  }
  if (
    !Array.isArray(value) ||
    value.some((v) => typeof v !== "string" || v === "")
  ) {
    fail(`"${what}" debe ser una lista de nombres`);
  }
  return value as string[];
}

function matrix(value: unknown, what: string): Fraction[][] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((row) => !Array.isArray(row) || row.length === 0)
  ) {
    fail(`"${what}" debe ser una matriz no vacía`);
  }
  const rows = value as unknown[][];
  const width = rows[0]!.length;
  if (rows.some((row) => row.length !== width)) {
    fail(`"${what}" debe ser rectangular`);
  }
  return rows.map((row, i) =>
    row.map((v, j) => jsonNumber(v, `${what}[${i + 1}][${j + 1}]`)),
  );
}

function list(value: unknown, what: string): Fraction[] {
  if (!Array.isArray(value)) {
    fail(`"${what}" debe ser una lista de números`);
  }
  return value.map((v, i) => jsonNumber(v, `${what}[${i + 1}]`));
}

export function parseDecisionFile(text: string): DecisionFile {
  const root = jsonObject(text, ["payoff", "bayes", "tree", "game"]);
  const title = jsonTitle(root);
  const type = root["type"] as DecisionFile["type"];
  if (type === "payoff") {
    const payoffs = matrix(root["payoffs"], "payoffs");
    const alternatives = names(
      root["alternatives"],
      "alternatives",
      payoffs.length,
      "A",
    );
    const states = names(root["states"], "states", payoffs[0]!.length, "S");
    const probabilities =
      root["probabilities"] === undefined || root["probabilities"] === null
        ? null
        : list(root["probabilities"], "probabilities");
    return {
      type,
      problem: {
        title,
        sense: root["sense"] === "min" ? "min" : "max",
        alternatives,
        states,
        payoffs,
        probabilities,
        alpha: jsonOptional(root["alpha"], "alpha") ?? Fraction.of(1, 2),
      },
    };
  }
  if (type === "bayes") {
    const payoffs = matrix(root["payoffs"], "payoffs");
    const likelihoods = matrix(root["likelihoods"], "likelihoods");
    return {
      type,
      problem: {
        title,
        states: names(root["states"], "states", payoffs[0]!.length, "S"),
        priors: list(root["priors"], "priors"),
        alternatives: names(
          root["alternatives"],
          "alternatives",
          payoffs.length,
          "A",
        ),
        payoffs,
        indicators: names(
          root["indicators"],
          "indicators",
          likelihoods[0]!.length,
          "I",
        ),
        likelihoods,
        sense: root["sense"] === "min" ? "min" : "max",
      },
    };
  }
  if (type === "game") {
    const m = matrix(root["matrix"], "matrix");
    return {
      type,
      title,
      rows: names(root["rows"], "rows", m.length, "F"),
      columns: names(root["columns"], "columns", m[0]!.length, "C"),
      matrix: m,
    };
  }
  const nodesRaw = root["nodes"];
  if (!Array.isArray(nodesRaw) || nodesRaw.length === 0) {
    fail(`"nodes" debe ser una lista de nodos`);
  }
  const nodes: TreeNode[] = nodesRaw.map((n, i) => {
    if (typeof n !== "object" || n === null) {
      fail(`El nodo ${i + 1} debe ser un objeto`);
    }
    const node = n as Record<string, unknown>;
    const id = node["id"];
    if (typeof id !== "string" || id === "") {
      fail(`El nodo ${i + 1} necesita un "id"`);
    }
    const kind = node["kind"];
    if (kind !== "decision" && kind !== "chance" && kind !== "terminal") {
      fail(`El nodo ${id} debe ser "decision", "chance" o "terminal"`);
    }
    const branchesRaw = node["branches"] ?? [];
    if (!Array.isArray(branchesRaw)) {
      fail(`"branches" de ${id} debe ser una lista`);
    }
    const branches = branchesRaw.map((b, k) => {
      if (typeof b !== "object" || b === null) {
        fail(`La rama ${k + 1} de ${id} debe ser un objeto`);
      }
      const br = b as Record<string, unknown>;
      if (typeof br["to"] !== "string" || br["to"] === "") {
        fail(`La rama ${k + 1} de ${id} necesita "to"`);
      }
      const probability = jsonOptional(
        br["probability"],
        `probabilidad de la rama ${k + 1} de ${id}`,
      );
      const payoff = jsonOptional(
        br["payoff"],
        `pago de la rama ${k + 1} de ${id}`,
      );
      return {
        to: br["to"],
        label: typeof br["label"] === "string" ? br["label"] : null,
        ...(probability !== undefined ? { probability } : {}),
        ...(payoff !== undefined ? { payoff } : {}),
      };
    });
    const payoff = jsonOptional(node["payoff"], `pago de ${id}`);
    return {
      id,
      kind,
      label: typeof node["label"] === "string" ? node["label"] : null,
      branches,
      ...(payoff !== undefined ? { payoff } : {}),
    };
  });
  const rootId = root["root"];
  if (typeof rootId !== "string" || !nodes.some((n) => n.id === rootId)) {
    fail(`"root" debe ser el id de un nodo`);
  }
  return {
    type,
    tree: {
      title,
      sense: root["sense"] === "min" ? "min" : "max",
      root: rootId,
      nodes,
    },
  };
}

export function serializeDecisionFile(file: DecisionFile): string {
  const out = (f: Fraction | undefined | null) =>
    f === undefined || f === null
      ? undefined
      : f.isInteger()
        ? Number(f.num)
        : f.toString();
  if (file.type === "payoff") {
    const p = file.problem;
    return `${JSON.stringify(
      {
        type: "payoff",
        title: p.title ?? undefined,
        sense: p.sense,
        alternatives: p.alternatives,
        states: p.states,
        probabilities: p.probabilities?.map((v) => out(v)) ?? undefined,
        alpha: out(p.alpha),
        payoffs: p.payoffs.map((r) => r.map((v) => out(v))),
      },
      null,
      2,
    )}\n`;
  }
  if (file.type === "bayes") {
    const p = file.problem;
    return `${JSON.stringify(
      {
        type: "bayes",
        title: p.title ?? undefined,
        sense: p.sense,
        states: p.states,
        priors: p.priors.map((v) => out(v)),
        alternatives: p.alternatives,
        payoffs: p.payoffs.map((r) => r.map((v) => out(v))),
        indicators: p.indicators,
        likelihoods: p.likelihoods.map((r) => r.map((v) => out(v))),
      },
      null,
      2,
    )}\n`;
  }
  if (file.type === "game") {
    return `${JSON.stringify({ type: "game", title: file.title ?? undefined, rows: file.rows, columns: file.columns, matrix: file.matrix.map((r) => r.map((v) => out(v))) }, null, 2)}\n`;
  }
  const t = file.tree;
  return `${JSON.stringify(
    {
      type: "tree",
      title: t.title ?? undefined,
      sense: t.sense,
      root: t.root,
      nodes: t.nodes.map((n) => ({
        id: n.id,
        kind: n.kind,
        label: n.label ?? undefined,
        payoff: out(n.payoff),
        branches: n.branches.map((b) => ({
          to: b.to,
          label: b.label ?? undefined,
          probability: out(b.probability),
          payoff: out(b.payoff),
        })),
      })),
    },
    null,
    2,
  )}\n`;
}
