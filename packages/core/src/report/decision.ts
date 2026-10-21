// SPDX-License-Identifier: GPL-3.0-or-later
// Reportes de análisis de decisiones.
import type {
  BayesProblem,
  BayesResult,
  PayoffProblem,
  PayoffResult,
} from "../decision/payoff";
import type { DecisionTree, TreeResult } from "../decision/tree";
import type { GameResult } from "../decision/game";
import { numberFormatter, textTable, type NumberOptions } from "./format";

export function reportPayoff(
  problem: PayoffProblem,
  r: PayoffResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const isMax = problem.sense === "max";
  const lines = ["LibreIO. Tabla de pagos"];
  if (problem.title) {
    lines.push(`Problema: ${problem.title}`);
  }
  lines.push(
    `Objetivo: ${isMax ? "maximizar ganancias" : "minimizar costos"}`,
    "",
  );
  lines.push(
    textTable(
      [
        "",
        ...problem.states,
        ...(problem.probabilities ? ["Valor esperado"] : []),
      ],
      [
        "l",
        ...problem.states.map(() => "r" as const),
        ...(problem.probabilities ? ["r" as const] : []),
      ],
      [
        ...(problem.probabilities
          ? [["Probabilidad", ...problem.probabilities.map(number), ""]]
          : []),
        ...problem.alternatives.map((a, i) => [
          a,
          ...problem.payoffs[i]!.map(number),
          ...(r.expectedValue ? [number(r.expectedValue.values[i]!)] : []),
        ]),
      ],
    ),
  );
  lines.push("", "Criterios");
  const rows: string[][] = [
    [
      isMax ? "Maximax" : "Minimin",
      problem.alternatives[r.maximax.alternative]!,
      number(r.maximax.value),
    ],
    [
      isMax ? "Maximin" : "Minimax",
      problem.alternatives[r.maximin.alternative]!,
      number(r.maximin.value),
    ],
    [
      "Laplace",
      problem.alternatives[r.laplace.alternative]!,
      number(r.laplace.value),
    ],
    [
      `Hurwicz (α = ${number(problem.alpha)})`,
      problem.alternatives[r.hurwicz.alternative]!,
      number(r.hurwicz.value),
    ],
    [
      "Savage (arrepentimiento máximo)",
      problem.alternatives[r.savage.alternative]!,
      number(r.savage.value),
    ],
  ];
  if (r.expectedValue && r.expectedRegret && r.evpi && r.evwpi) {
    rows.push([
      "Valor esperado",
      problem.alternatives[r.expectedValue.alternative]!,
      number(r.expectedValue.value),
    ]);
    rows.push([
      "Arrepentimiento esperado",
      problem.alternatives[r.expectedRegret.alternative]!,
      number(r.expectedRegret.value),
    ]);
    rows.push(["Valor esperado con información perfecta", "", number(r.evwpi)]);
    rows.push(["VEIP", "", number(r.evpi)]);
  }
  lines.push(
    textTable(["Criterio", "Alternativa", "Valor"], ["l", "l", "r"], rows),
  );
  lines.push("", "Tabla de arrepentimientos");
  lines.push(
    textTable(
      ["", ...problem.states],
      ["l", ...problem.states.map(() => "r" as const)],
      problem.alternatives.map((a, i) => [
        a,
        ...r.savage.regrets[i]!.map(number),
      ]),
    ),
  );
  return `${lines.join("\n")}\n`;
}

export function reportBayes(
  problem: BayesProblem,
  r: BayesResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const lines = ["LibreIO. Revisión bayesiana"];
  if (problem.title) {
    lines.push(`Problema: ${problem.title}`);
  }
  lines.push("");
  lines.push(
    `Sin información: ${problem.alternatives[r.withoutInformation.alternative]} con ${number(r.withoutInformation.value)}`,
  );
  lines.push(
    `Valor esperado con información perfecta: ${number(r.evwpi)}. VEIP: ${number(r.evpi)}`,
    "",
  );
  lines.push("Probabilidades conjuntas y posteriores");
  lines.push(
    textTable(
      [
        "Indicador",
        "P(indicador)",
        ...problem.states.map((s) => `P(${s} | indicador)`),
        "Decisión",
        "Valor",
      ],
      ["l", "r", ...problem.states.map(() => "r" as const), "l", "r"],
      problem.indicators.map((name, k) => [
        name,
        number(r.indicatorProbabilities[k]!),
        ...r.posteriors[k]!.map(number),
        problem.alternatives[r.decisions[k]!.alternative]!,
        number(r.decisions[k]!.value),
      ]),
    ),
  );
  lines.push("", `Valor esperado con información muestral: ${number(r.evwsi)}`);
  lines.push(`VEIM: ${number(r.evsi)}`);
  lines.push(`Eficiencia: ${number(r.efficiency)}`);
  return `${lines.join("\n")}\n`;
}

export function reportDecisionTree(
  tree: DecisionTree,
  r: TreeResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const lines = ["LibreIO. Árbol de decisión"];
  if (tree.title) {
    lines.push(`Problema: ${tree.title}`);
  }
  lines.push("");
  if (r.status !== "ok") {
    lines.push(...r.messages);
    return `${lines.join("\n")}\n`;
  }
  lines.push(`Valor del árbol: ${number(r.rootValue)}`, "");
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const rows: string[][] = [];
  for (const id of r.order) {
    const node = byId.get(id)!;
    const value = r.values[id]!;
    if (node.kind === "terminal") {
      rows.push([id, "pago", node.label ?? "", number(value), ""]);
      continue;
    }
    const detail = node.branches
      .map((b, k) => {
        const partial = r.branchValues[id]?.[k];
        const label = b.label ?? b.to;
        const prob = b.probability ? ` p = ${number(b.probability)}` : "";
        const chosen =
          node.kind === "decision" && r.choices[id] === k ? " <- elegida" : "";
        return `${label}${prob}: ${partial ? number(partial) : "-"}${chosen}`;
      })
      .join("; ");
    rows.push([
      id,
      node.kind === "decision" ? "decisión" : "azar",
      node.label ?? "",
      number(value),
      detail,
    ]);
  }
  lines.push(
    textTable(
      ["Nodo", "Tipo", "Etiqueta", "Valor", "Ramas"],
      ["l", "l", "l", "r", "l"],
      rows,
    ),
  );
  lines.push("", ...r.messages.slice(1));
  return `${lines.join("\n")}\n`;
}

export function reportGame(r: GameResult, options: NumberOptions = {}): string {
  const number = numberFormatter(options);
  const lines = ["LibreIO. Juego de suma cero", ""];
  lines.push(
    textTable(
      ["", ...r.columns, "Mín. fila"],
      ["l", ...r.columns.map(() => "r" as const), "r"],
      [
        ...r.matrix.map((row, i) => [
          r.rows[i]!,
          ...row.map(number),
          number(row.reduce((a, b) => (b.lt(a) ? b : a))),
        ]),
        [
          "Máx. columna",
          ...r.columns.map((_, j) =>
            number(
              r.matrix
                .map((row) => row[j]!)
                .reduce((a, b) => (b.gt(a) ? b : a)),
            ),
          ),
          "",
        ],
      ],
    ),
  );
  lines.push(
    "",
    `Maximin: ${number(r.maximin.value)} (${r.rows[r.maximin.row]}). Minimax: ${number(r.minimax.value)} (${r.columns[r.minimax.column]}).`,
  );
  if (r.saddle) {
    lines.push(
      `Punto de silla en ${r.rows[r.saddle.row]}, ${r.columns[r.saddle.column]}.`,
    );
  } else {
    for (const s of r.dominance.steps) {
      lines.push(s.note);
    }
    lines.push(
      `Método: ${r.method === "graphical" ? "resolución gráfica y programación lineal" : "programación lineal"}.`,
    );
  }
  lines.push(`Valor del juego: ${number(r.value)}`);
  lines.push(`Estrategia de filas: (${r.rowStrategy.map(number).join(", ")})`);
  lines.push(
    `Estrategia de columnas: (${r.columnStrategy.map(number).join(", ")})`,
  );
  return `${lines.join("\n")}\n`;
}
