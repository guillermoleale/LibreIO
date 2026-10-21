// SPDX-License-Identifier: GPL-3.0-or-later
// Ramificación y acotamiento sobre el simplex: árbol completo con cota, solución y motivo de poda de cada nodo.
import { Fraction } from "../rational/Fraction";
import { finite } from "../rational/Extended";
import type { LPModel, Variable } from "../parser/model";
import {
  solveLP,
  type LPResult,
  type LPSolution,
  type SolveOptions,
  type VariableValue,
} from "../lp/solveLP";

export interface BranchConstraint {
  readonly variable: string;
  readonly direction: "<=" | ">=";
  readonly value: Fraction;
}

export type PruneReason = "infeasible" | "bound" | "integer" | "unbounded";

export interface BBNode {
  readonly id: number;
  readonly parent: number | null;
  readonly depth: number;
  /** Restricción agregada en este nodo respecto de su padre. */
  readonly branch: BranchConstraint | null;
  /** Todas las restricciones de ramificación acumuladas desde la raíz. */
  readonly path: BranchConstraint[];
  readonly status: "optimal" | "infeasible" | "unbounded";
  readonly bound: Fraction | null;
  readonly solution: VariableValue[] | null;
  readonly integer: boolean;
  pruned: PruneReason | null;
  branchedOn: string | null;
  readonly children: number[];
  readonly pivots: number;
  readonly lp: LPResult;
  /** Orden en que se procesó el nodo (0 para la raíz). */
  order: number;
}

export interface IncumbentEvent {
  readonly node: number;
  readonly objective: Fraction;
  readonly branches: number;
  readonly pivots: number;
  bound: Fraction;
}

export interface BBOptions extends SolveOptions {
  /** Elige a mano la variable de ramificación entre las candidatas (índices de variables con valor fraccionario). */
  readonly chooseBranch?: (candidates: number[], node: BBNode) => number;
}

export interface BBResult {
  readonly status: "optimal" | "infeasible" | "unbounded";
  readonly model: LPModel;
  readonly solution: LPSolution | null;
  readonly relaxation: LPResult;
  readonly nodes: BBNode[];
  readonly bestNode: number | null;
  readonly incumbents: IncumbentEvent[];
  readonly branches: number;
  readonly pivots: number;
  readonly messages: string[];
}

function nodeModel(model: LPModel, path: BranchConstraint[]): LPModel {
  const variables: Variable[] = model.variables.map((v) => {
    let lower = v.lower;
    let upper = v.upper;
    for (const c of path) {
      if (c.variable !== v.name) {
        continue;
      }
      if (c.direction === "<=") {
        upper =
          !upper.finite || c.value.lt(upper.value) ? finite(c.value) : upper;
      } else {
        lower =
          !lower.finite || c.value.gt(lower.value) ? finite(c.value) : lower;
      }
    }
    return { ...v, lower, upper, kind: "continuous" };
  });
  return { ...model, variables };
}

function integerIndices(model: LPModel): number[] {
  return model.variables
    .map((v, i) => (v.kind === "continuous" ? -1 : i))
    .filter((i) => i >= 0);
}

export function branchAndBound(
  model: LPModel,
  options: BBOptions = {},
): BBResult {
  const isMax = model.sense === "max";
  const better = (a: Fraction, b: Fraction): boolean =>
    isMax ? a.gt(b) : a.lt(b);
  const integers = integerIndices(model);
  const nodes: BBNode[] = [];
  const incumbents: IncumbentEvent[] = [];
  const messages: string[] = [];
  let branches = 0;
  let pivots = 0;
  const state: {
    incumbent: {
      objective: Fraction;
      solution: VariableValue[];
      node: number;
    } | null;
  } = { incumbent: null };
  let order = 0;

  const createNode = (
    parent: BBNode | null,
    branch: BranchConstraint | null,
  ): BBNode => {
    const path = parent ? [...parent.path, ...(branch ? [branch] : [])] : [];
    const lp = solveLP(nodeModel(model, path), {
      ...(options.method ? { method: options.method } : {}),
      ...(options.rule ? { rule: options.rule } : {}),
    });
    pivots += lp.iterations;
    const solution = lp.solution?.variables ?? null;
    const integer =
      solution !== null &&
      integers.every((i) => solution[i]!.value.isInteger());
    const node: BBNode = {
      id: nodes.length,
      parent: parent?.id ?? null,
      depth: parent ? parent.depth + 1 : 0,
      branch,
      path,
      status: lp.status,
      bound: lp.solution?.objective ?? null,
      solution,
      integer,
      pruned: null,
      branchedOn: null,
      children: [],
      pivots: lp.iterations,
      lp,
      order: -1,
    };
    nodes.push(node);
    if (parent) {
      parent.children.push(node.id);
    }
    return node;
  };

  const classify = (node: BBNode): "open" | "closed" => {
    if (node.status === "infeasible") {
      node.pruned = "infeasible";
      return "closed";
    }
    if (node.status === "unbounded") {
      node.pruned = "unbounded";
      return "closed";
    }
    if (node.integer) {
      node.pruned = "integer";
      if (
        state.incumbent === null ||
        better(node.bound!, state.incumbent.objective)
      ) {
        state.incumbent = {
          objective: node.bound!,
          solution: node.solution!,
          node: node.id,
        };
        incumbents.push({
          node: node.id,
          objective: node.bound!,
          branches,
          pivots,
          bound: node.bound!,
        });
      }
      return "closed";
    }
    if (
      state.incumbent !== null &&
      !better(node.bound!, state.incumbent.objective)
    ) {
      node.pruned = "bound";
      return "closed";
    }
    return "open";
  };

  const root = createNode(null, null);
  const relaxation = root.lp;
  if (root.status === "unbounded") {
    root.pruned = "unbounded";
    root.order = order;
    messages.push("La relajación lineal es ilimitada.");
    return {
      status: "unbounded",
      model,
      solution: null,
      relaxation,
      nodes,
      bestNode: null,
      incumbents,
      branches,
      pivots,
      messages,
    };
  }
  if (root.status === "infeasible") {
    root.pruned = "infeasible";
    root.order = order;
    messages.push("La relajación lineal es infactible.");
    return {
      status: "infeasible",
      model,
      solution: null,
      relaxation,
      nodes,
      bestNode: null,
      incumbents,
      branches,
      pivots,
      messages,
    };
  }
  messages.push(`Relajación lineal: Z = ${root.bound!.toString()}.`);
  const open: BBNode[] = [];
  if (classify(root) === "open") {
    open.push(root);
  }
  root.order = order;
  order += 1;

  while (open.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (better(open[i]!.bound!, open[bestIndex]!.bound!)) {
        bestIndex = i;
      }
    }
    const node = open.splice(bestIndex, 1)[0]!;
    if (node.order < 0) {
      node.order = order;
      order += 1;
    }
    if (
      state.incumbent !== null &&
      !better(node.bound!, state.incumbent.objective)
    ) {
      node.pruned = "bound";
      continue;
    }
    const candidates = integers.filter(
      (i) => !node.solution![i]!.value.isInteger(),
    );
    let chosen: number;
    if (options.chooseBranch) {
      chosen = options.chooseBranch(candidates, node);
      if (!candidates.includes(chosen)) {
        chosen = candidates[0]!;
      }
    } else {
      chosen = candidates[0]!;
      let bestFraction = node.solution![chosen]!.value.fractionalPart();
      for (const i of candidates.slice(1)) {
        const f = node.solution![i]!.value.fractionalPart();
        if (f.gt(bestFraction)) {
          bestFraction = f;
          chosen = i;
        }
      }
    }
    const variable = model.variables[chosen]!;
    const value = node.solution![chosen]!.value;
    node.branchedOn = variable.name;
    branches += 1;
    const left = createNode(node, {
      variable: variable.name,
      direction: "<=",
      value: value.floor(),
    });
    const right = createNode(node, {
      variable: variable.name,
      direction: ">=",
      value: value.ceil(),
    });
    const before = incumbents.length;
    for (const child of [left, right]) {
      child.order = order;
      order += 1;
      if (classify(child) === "open") {
        open.push(child);
      }
    }
    // Cota sobre el óptimo después de cada solución entera nueva: lo mejor entre el incumbente y los nodos abiertos.
    for (let k = before; k < incumbents.length; k += 1) {
      let bound = incumbents[k]!.objective;
      for (const o of open) {
        if (better(o.bound!, bound)) {
          bound = o.bound!;
        }
      }
      incumbents[k]!.bound = bound;
    }
  }

  if (state.incumbent === null) {
    messages.push("No existe solución entera factible.");
    return {
      status: "infeasible",
      model,
      solution: null,
      relaxation,
      nodes,
      bestNode: null,
      incumbents,
      branches,
      pivots,
      messages,
    };
  }
  const best = state.incumbent;
  messages.push(
    `Óptimo entero Z = ${best.objective.toString()} en el nodo ${best.node}. Árbol de ${nodes.length} nodos con ${branches} ramificaciones y ${pivots} pivotes.`,
  );
  return {
    status: "optimal",
    model,
    solution: { variables: best.solution, objective: best.objective },
    relaxation,
    nodes,
    bestNode: best.node,
    incumbents,
    branches,
    pivots,
    messages,
  };
}
