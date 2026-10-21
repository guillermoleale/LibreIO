// SPDX-License-Identifier: GPL-3.0-or-later
// Borradores editables (texto por celda) de los problemas de decisión y su conversión al modelo del núcleo.
import {
  Fraction,
  type BayesProblem,
  type DecisionFile,
  type DecisionTree,
  type PayoffProblem,
} from "@libreio/core";

export type Kind = "payoff" | "bayes" | "tree" | "game";
export type Sense = "max" | "min";

export interface PayoffDraft {
  title: string;
  sense: Sense;
  alternatives: string[];
  states: string[];
  payoffs: string[][];
  useProbabilities: boolean;
  probabilities: string[];
  alpha: string;
}

export interface BayesDraft {
  title: string;
  sense: Sense;
  states: string[];
  priors: string[];
  alternatives: string[];
  payoffs: string[][];
  indicators: string[];
  /** likelihoods[estado][indicador] */
  likelihoods: string[][];
}

export interface TreeNodeDraft {
  id: string;
  kind: "decision" | "chance" | "terminal";
  label: string;
  payoff: string;
}

export interface TreeBranchDraft {
  from: string;
  to: string;
  label: string;
  probability: string;
  payoff: string;
}

export interface TreeDraft {
  title: string;
  sense: Sense;
  root: string;
  nodes: TreeNodeDraft[];
  branches: TreeBranchDraft[];
}

export interface GameDraft {
  title: string;
  rows: string[];
  columns: string[];
  matrix: string[][];
}

export interface Drafts {
  payoff: PayoffDraft;
  bayes: BayesDraft;
  tree: TreeDraft;
  game: GameDraft;
}

const fr = (f: Fraction | undefined | null): string =>
  f === undefined || f === null ? "" : f.toString();

export const emptyPayoff: PayoffDraft = {
  title: "",
  sense: "max",
  alternatives: ["A1", "A2"],
  states: ["S1", "S2"],
  payoffs: [
    ["10", "5"],
    ["8", "7"],
  ],
  useProbabilities: true,
  probabilities: ["1/2", "1/2"],
  alpha: "1/2",
};

export const emptyBayes: BayesDraft = {
  title: "",
  sense: "max",
  states: ["S1", "S2"],
  priors: ["1/2", "1/2"],
  alternatives: ["A1", "A2"],
  payoffs: [
    ["10", "-5"],
    ["2", "2"],
  ],
  indicators: ["I1", "I2"],
  likelihoods: [
    ["4/5", "1/5"],
    ["1/5", "4/5"],
  ],
};

export const emptyTree: TreeDraft = {
  title: "",
  sense: "max",
  root: "r",
  nodes: [
    { id: "r", kind: "decision", label: "Decisión", payoff: "" },
    { id: "c", kind: "chance", label: "Azar", payoff: "" },
    { id: "t1", kind: "terminal", label: "", payoff: "50" },
    { id: "t2", kind: "terminal", label: "", payoff: "0" },
  ],
  branches: [
    { from: "r", to: "c", label: "Invertir", probability: "", payoff: "-10" },
    { from: "r", to: "t2", label: "No invertir", probability: "", payoff: "" },
    { from: "c", to: "t1", label: "Éxito", probability: "1/2", payoff: "" },
    { from: "c", to: "t2", label: "Fracaso", probability: "1/2", payoff: "" },
  ],
};

export const emptyGame: GameDraft = {
  title: "",
  rows: ["F1", "F2"],
  columns: ["C1", "C2"],
  matrix: [
    ["3", "-1"],
    ["-2", "2"],
  ],
};

export const emptyDrafts: Drafts = {
  payoff: emptyPayoff,
  bayes: emptyBayes,
  tree: emptyTree,
  game: emptyGame,
};

export function payoffToDraft(p: PayoffProblem): PayoffDraft {
  return {
    title: p.title ?? "",
    sense: p.sense,
    alternatives: [...p.alternatives],
    states: [...p.states],
    payoffs: p.payoffs.map((r) => r.map(fr)),
    useProbabilities: p.probabilities !== null,
    probabilities: p.probabilities
      ? p.probabilities.map(fr)
      : p.states.map(() => ""),
    alpha: fr(p.alpha),
  };
}

export function bayesToDraft(p: BayesProblem): BayesDraft {
  return {
    title: p.title ?? "",
    sense: p.sense ?? "max",
    states: [...p.states],
    priors: p.priors.map(fr),
    alternatives: [...p.alternatives],
    payoffs: p.payoffs.map((r) => r.map(fr)),
    indicators: [...p.indicators],
    likelihoods: p.likelihoods.map((r) => r.map(fr)),
  };
}

export function treeToDraft(tree: DecisionTree): TreeDraft {
  return {
    title: tree.title ?? "",
    sense: tree.sense,
    root: tree.root,
    nodes: tree.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      label: n.label ?? "",
      payoff: fr(n.payoff),
    })),
    branches: tree.nodes.flatMap((n) =>
      n.branches.map((b) => ({
        from: n.id,
        to: b.to,
        label: b.label ?? "",
        probability: fr(b.probability),
        payoff: fr(b.payoff),
      })),
    ),
  };
}

export function gameToDraft(
  title: string | null,
  rows: string[],
  columns: string[],
  matrix: Fraction[][],
): GameDraft {
  return {
    title: title ?? "",
    rows: [...rows],
    columns: [...columns],
    matrix: matrix.map((r) => r.map(fr)),
  };
}

export function fileToDrafts(
  file: DecisionFile,
  current: Drafts,
): { kind: Kind; drafts: Drafts } {
  if (file.type === "payoff") {
    return {
      kind: "payoff",
      drafts: { ...current, payoff: payoffToDraft(file.problem) },
    };
  }
  if (file.type === "bayes") {
    return {
      kind: "bayes",
      drafts: { ...current, bayes: bayesToDraft(file.problem) },
    };
  }
  if (file.type === "tree") {
    return {
      kind: "tree",
      drafts: { ...current, tree: treeToDraft(file.tree) },
    };
  }
  return {
    kind: "game",
    drafts: {
      ...current,
      game: gameToDraft(file.title, file.rows, file.columns, file.matrix),
    },
  };
}

export interface BuildResult<T> {
  readonly value: T | null;
  readonly invalid: Set<string>;
}

function number(text: string, key: string, invalid: Set<string>): Fraction {
  try {
    return Fraction.parse(text.trim());
  } catch {
    invalid.add(key);
    return Fraction.ZERO;
  }
}

function optional(
  text: string,
  key: string,
  invalid: Set<string>,
): Fraction | undefined {
  if (text.trim() === "") {
    return undefined;
  }
  return number(text, key, invalid);
}

function names(list: string[], prefix: string, invalid: Set<string>): string[] {
  return list.map((n, i) => {
    const name = n.trim();
    if (name === "" || list.findIndex((x) => x.trim() === name) !== i) {
      invalid.add(`${prefix}-${i}`);
    }
    return name;
  });
}

function sumsToOne(values: Fraction[]): boolean {
  return (
    values.length > 0 &&
    values.every((v) => !v.isNegative()) &&
    Fraction.sum(values).eq(Fraction.ONE)
  );
}

export function buildPayoff(d: PayoffDraft): BuildResult<PayoffProblem> {
  const invalid = new Set<string>();
  const alternatives = names(d.alternatives, "alt", invalid);
  const states = names(d.states, "state", invalid);
  const payoffs = d.payoffs.map((row, i) =>
    row.map((v, j) => number(v, `pay-${i}-${j}`, invalid)),
  );
  let probabilities: Fraction[] | null = null;
  if (d.useProbabilities) {
    probabilities = d.probabilities.map((v, j) =>
      number(v, `prob-${j}`, invalid),
    );
    if (!sumsToOne(probabilities)) {
      d.probabilities.forEach((_, j) => invalid.add(`prob-${j}`));
    }
  }
  const alpha = number(d.alpha, "alpha", invalid);
  if (alpha.isNegative() || alpha.gt(Fraction.ONE)) {
    invalid.add("alpha");
  }
  if (alternatives.length === 0 || states.length === 0) {
    invalid.add("size");
  }
  return {
    value:
      invalid.size > 0
        ? null
        : {
            title: d.title.trim() === "" ? null : d.title.trim(),
            sense: d.sense,
            alternatives,
            states,
            payoffs,
            probabilities,
            alpha,
          },
    invalid,
  };
}

export function buildBayes(d: BayesDraft): BuildResult<BayesProblem> {
  const invalid = new Set<string>();
  const states = names(d.states, "state", invalid);
  const alternatives = names(d.alternatives, "alt", invalid);
  const indicators = names(d.indicators, "ind", invalid);
  const priors = d.priors.map((v, j) => number(v, `prior-${j}`, invalid));
  if (!sumsToOne(priors)) {
    d.priors.forEach((_, j) => invalid.add(`prior-${j}`));
  }
  const payoffs = d.payoffs.map((row, i) =>
    row.map((v, j) => number(v, `pay-${i}-${j}`, invalid)),
  );
  const likelihoods = d.likelihoods.map((row, j) => {
    const values = row.map((v, k) => number(v, `lik-${j}-${k}`, invalid));
    if (!sumsToOne(values)) {
      row.forEach((_, k) => invalid.add(`lik-${j}-${k}`));
    }
    return values;
  });
  if (
    states.length === 0 ||
    alternatives.length === 0 ||
    indicators.length === 0
  ) {
    invalid.add("size");
  }
  return {
    value:
      invalid.size > 0
        ? null
        : {
            title: d.title.trim() === "" ? null : d.title.trim(),
            sense: d.sense,
            states,
            priors,
            alternatives,
            payoffs,
            indicators,
            likelihoods,
          },
    invalid,
  };
}

export function buildTree(d: TreeDraft): BuildResult<DecisionTree> {
  const invalid = new Set<string>();
  const ids = d.nodes.map((n) => n.id.trim());
  ids.forEach((id, i) => {
    if (id === "" || ids.indexOf(id) !== i) {
      invalid.add(`node-id-${i}`);
    }
  });
  const known = new Set(ids);
  if (!known.has(d.root.trim())) {
    invalid.add("root");
  }
  const branchesByNode = new Map<string, TreeBranchDraft[]>();
  d.branches.forEach((b, k) => {
    if (!known.has(b.from.trim())) {
      invalid.add(`branch-from-${k}`);
    }
    if (!known.has(b.to.trim()) || b.to.trim() === b.from.trim()) {
      invalid.add(`branch-to-${k}`);
    }
    branchesByNode.set(b.from.trim(), [
      ...(branchesByNode.get(b.from.trim()) ?? []),
      b,
    ]);
  });
  const nodes = d.nodes.map((n, i) => {
    const id = n.id.trim();
    const own = branchesByNode.get(id) ?? [];
    const payoff = optional(n.payoff, `node-payoff-${i}`, invalid);
    if (n.kind === "terminal" && payoff === undefined) {
      invalid.add(`node-payoff-${i}`);
    }
    if (n.kind !== "terminal" && own.length === 0) {
      invalid.add(`node-id-${i}`);
    }
    const branches = own.map((b) => {
      const k = d.branches.indexOf(b);
      const probability = optional(b.probability, `branch-prob-${k}`, invalid);
      const branchPayoff = optional(b.payoff, `branch-payoff-${k}`, invalid);
      if (n.kind === "chance" && probability === undefined) {
        invalid.add(`branch-prob-${k}`);
      }
      return {
        to: b.to.trim(),
        label: b.label.trim() === "" ? null : b.label.trim(),
        ...(probability !== undefined ? { probability } : {}),
        ...(branchPayoff !== undefined ? { payoff: branchPayoff } : {}),
      };
    });
    if (n.kind === "chance") {
      const probabilities = branches.map((b) => b.probability ?? Fraction.ZERO);
      if (!sumsToOne(probabilities)) {
        own.forEach((b) => invalid.add(`branch-prob-${d.branches.indexOf(b)}`));
      }
    }
    return {
      id,
      kind: n.kind,
      label: n.label.trim() === "" ? null : n.label.trim(),
      branches,
      ...(payoff !== undefined ? { payoff } : {}),
    };
  });
  return {
    value:
      invalid.size > 0
        ? null
        : {
            title: d.title.trim() === "" ? null : d.title.trim(),
            sense: d.sense,
            root: d.root.trim(),
            nodes,
          },
    invalid,
  };
}

export interface GameProblem {
  readonly title: string | null;
  readonly rows: string[];
  readonly columns: string[];
  readonly matrix: Fraction[][];
}

export function buildGame(d: GameDraft): BuildResult<GameProblem> {
  const invalid = new Set<string>();
  const rows = names(d.rows, "row", invalid);
  const columns = names(d.columns, "col", invalid);
  const matrix = d.matrix.map((row, i) =>
    row.map((v, j) => number(v, `cell-${i}-${j}`, invalid)),
  );
  if (rows.length === 0 || columns.length === 0) {
    invalid.add("size");
  }
  return {
    value:
      invalid.size > 0
        ? null
        : {
            title: d.title.trim() === "" ? null : d.title.trim(),
            rows,
            columns,
            matrix,
          },
    invalid,
  };
}
