// SPDX-License-Identifier: GPL-3.0-or-later
// Árboles de decisión resueltos hacia atrás.
import { Fraction } from "../rational/Fraction";

export interface TreeBranch {
  readonly to: string;
  readonly label: string | null;
  readonly probability?: Fraction;
  /** Pago (o costo negativo) que se suma al tomar la rama. */
  readonly payoff?: Fraction;
}

export interface TreeNode {
  readonly id: string;
  readonly kind: "decision" | "chance" | "terminal";
  readonly label: string | null;
  readonly payoff?: Fraction;
  readonly branches: TreeBranch[];
}

export interface DecisionTree {
  readonly title: string | null;
  readonly sense: "max" | "min";
  readonly root: string;
  readonly nodes: TreeNode[];
}

export interface TreeResult {
  readonly status: "ok" | "invalid";
  readonly rootValue: Fraction;
  readonly values: Record<string, Fraction>;
  /** Índice de la rama elegida en cada nodo de decisión. */
  readonly choices: Record<string, number>;
  /** Valor que aporta cada rama (pago de la rama más valor del hijo), por nodo. */
  readonly branchValues: Record<string, Fraction[]>;
  /** Orden de evaluación hacia atrás, de la raíz a las hojas. */
  readonly order: string[];
  readonly messages: string[];
}

export function solveDecisionTree(tree: DecisionTree): TreeResult {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const values: Record<string, Fraction> = {};
  const choices: Record<string, number> = {};
  const branchValues: Record<string, Fraction[]> = {};
  const order: string[] = [];
  const messages: string[] = [];
  const isMax = tree.sense === "max";
  if (!byId.has(tree.root)) {
    return {
      status: "invalid",
      rootValue: Fraction.ZERO,
      values,
      choices,
      branchValues,
      order,
      messages: [`No existe el nodo raíz ${tree.root}.`],
    };
  }
  const visiting = new Set<string>();
  let invalid = false;
  const evaluate = (id: string): Fraction => {
    if (values[id] !== undefined) {
      return values[id];
    }
    if (visiting.has(id)) {
      invalid = true;
      messages.push(`El árbol tiene un ciclo en ${id}.`);
      return Fraction.ZERO;
    }
    visiting.add(id);
    order.push(id);
    const node = byId.get(id);
    if (!node) {
      invalid = true;
      messages.push(`No existe el nodo ${id}.`);
      visiting.delete(id);
      return Fraction.ZERO;
    }
    let value: Fraction;
    if (node.kind === "terminal") {
      value = node.payoff ?? Fraction.ZERO;
    } else {
      const partials = node.branches.map((b) =>
        (b.payoff ?? Fraction.ZERO).add(evaluate(b.to)),
      );
      branchValues[id] = partials;
      if (node.kind === "chance") {
        const probabilities = node.branches.map(
          (b) => b.probability ?? Fraction.ZERO,
        );
        if (
          node.branches.length === 0 ||
          !Fraction.sum(probabilities).eq(Fraction.ONE) ||
          probabilities.some((p) => p.isNegative())
        ) {
          invalid = true;
          messages.push(
            `Las probabilidades del nodo de azar ${id} deben sumar 1.`,
          );
        }
        value = Fraction.sum(partials.map((v, k) => v.mul(probabilities[k]!)));
      } else {
        if (partials.length === 0) {
          invalid = true;
          messages.push(`El nodo de decisión ${id} no tiene ramas.`);
          value = Fraction.ZERO;
        } else {
          let bestIndex = 0;
          partials.forEach((v, k) => {
            if (
              isMax ? v.gt(partials[bestIndex]!) : v.lt(partials[bestIndex]!)
            ) {
              bestIndex = k;
            }
          });
          choices[id] = bestIndex;
          value = partials[bestIndex]!;
        }
      }
    }
    values[id] = value;
    visiting.delete(id);
    return value;
  };
  const rootValue = evaluate(tree.root);
  if (!invalid) {
    messages.unshift(`Valor del árbol: ${rootValue.toString()}.`);
    const root = byId.get(tree.root)!;
    if (root.kind === "decision" && choices[tree.root] !== undefined) {
      messages.push(
        `En la raíz se elige ${root.branches[choices[tree.root]!]!.label ?? `la rama ${choices[tree.root]! + 1}`}.`,
      );
    }
  }
  return {
    status: invalid ? "invalid" : "ok",
    rootValue,
    values,
    choices,
    branchValues,
    order,
    messages,
  };
}
