// SPDX-License-Identifier: GPL-3.0-or-later
// Reportes de programación entera: clásico (LINDO) y combinado en español con el árbol.
import type { LPModel } from "../parser/model";
import type { BBResult } from "../ilp/branchAndBound";
import { cutText, type GomoryResult } from "../ilp/gomory";
import { formatLinearExpression } from "../parser/formatLP";
import { formatObjectiveValue } from "./classic";
import {
  fixed,
  numberFormatter,
  padLeft,
  textTable,
  type NumberOptions,
} from "./format";

export function reportClassicInteger(model: LPModel, r: BBResult): string {
  const lines: string[] = [];
  const relax = r.relaxation;
  if (relax.status === "optimal") {
    lines.push(
      ` LP OPTIMUM FOUND AT STEP${padLeft(String(relax.iterations), 7)}`,
    );
    lines.push(` OBJECTIVE VALUE =${fixed(relax.solution!.objective, 16, 7)}`);
    lines.push("");
  } else if (relax.status === "unbounded") {
    lines.push(
      ` UNBOUNDED SOLUTION AT STEP${padLeft(String(relax.iterations), 7)}`,
    );
    return `${lines.join("\n")}\n`;
  } else {
    lines.push(
      ` NO FEASIBLE SOLUTION AT STEP${padLeft(String(relax.iterations), 7)}`,
    );
    return `${lines.join("\n")}\n`;
  }
  for (const inc of r.incumbents) {
    lines.push(
      ` NEW INTEGER SOLUTION OF${fixed(inc.objective, 15, 7)}     AT BRANCH${padLeft(String(inc.branches), 7)} PIVOT${padLeft(String(inc.pivots), 7)}`,
    );
    lines.push(` BOUND ON OPTIMUM:${fixed(inc.bound, 10, 5)}`);
  }
  lines.push(
    ` ENUMERATION COMPLETE. BRANCHES=${padLeft(String(r.branches), 6)} PIVOTS=${padLeft(String(r.pivots), 7)}`,
  );
  lines.push("");
  if (r.status !== "optimal" || r.bestNode === null) {
    lines.push(" NO FEASIBLE INTEGER SOLUTION");
    return `${lines.join("\n")}\n`;
  }
  lines.push(" LAST INTEGER SOLUTION IS THE BEST FOUND");
  lines.push(" RE-INSTALLING BEST SOLUTION...");
  lines.push("");
  lines.push("        OBJECTIVE FUNCTION VALUE");
  lines.push("");
  lines.push(
    `        1)${padLeft(formatObjectiveValue(r.solution!.objective), 14)}`,
  );
  lines.push("");
  const best = r.nodes[r.bestNode]!.lp;
  const sensitivity = best.sensitivity!;
  lines.push("  VARIABLE        VALUE          REDUCED COST");
  for (const v of sensitivity.variables) {
    lines.push(
      `${padLeft(v.name, 10)}${fixed(v.value, 17, 6)}${fixed(v.reducedCost, 18, 6)}`,
    );
  }
  lines.push("");
  lines.push("       ROW   SLACK OR SURPLUS     DUAL PRICES");
  for (const c of sensitivity.constraints) {
    lines.push(
      `${padLeft(`${c.label ?? c.row})`, 10)}${fixed(c.slack, 17, 6)}${fixed(c.dualPrice, 18, 6)}`,
    );
  }
  lines.push("");
  lines.push(` NO. ITERATIONS=${padLeft(String(r.pivots), 8)}`);
  lines.push(` BRANCHES=${padLeft(String(r.branches), 5)}`);
  return `${lines.join("\n")}\n`;
}

export function reportCombinedInteger(
  model: LPModel,
  r: BBResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const names = model.variables.map((v) => v.name);
  const lines: string[] = ["LibreIO. Reporte combinado (programación entera)"];
  if (model.title) {
    lines.push(`Problema: ${model.title}`);
  }
  lines.push(
    `Objetivo: ${model.sense === "max" ? "MAX" : "MIN"} ${formatLinearExpression(model.objective, names, number)}`,
  );
  lines.push(
    "Método: ramificación y acotamiento sobre el simplex, nodo de mejor cota primero",
  );
  lines.push("");
  if (r.status === "unbounded") {
    lines.push("La relajación lineal es ilimitada.");
    return `${lines.join("\n")}\n`;
  }
  if (r.status === "infeasible") {
    lines.push("No existe solución entera factible.");
    lines.push(
      `Árbol: ${r.nodes.length} nodos, ${r.branches} ramificaciones, ${r.pivots} pivotes.`,
    );
    return `${lines.join("\n")}\n`;
  }
  const solution = r.solution!;
  lines.push(`Óptimo entero encontrado: Z = ${number(solution.objective)}`);
  lines.push(
    `Árbol: ${r.nodes.length} nodos, ${r.branches} ramificaciones, ${r.pivots} pivotes. Relajación lineal Z = ${number(r.relaxation.solution!.objective)}.`,
  );
  lines.push("");
  lines.push(
    textTable(
      ["Variable", "Valor", "Coeficiente", "Contribución", "Tipo"],
      ["l", "r", "r", "r", "l"],
      model.variables.map((v, i) => [
        v.name,
        number(solution.variables[i]!.value),
        number(model.objective[i]!),
        number(model.objective[i]!.mul(solution.variables[i]!.value)),
        v.kind === "integer"
          ? "entera"
          : v.kind === "binary"
            ? "binaria"
            : "continua",
      ]),
    ),
  );
  lines.push("");
  const kindLabel = (node: BBResult["nodes"][number]): string => {
    if (node.pruned === "infeasible") {
      return "infactible";
    }
    if (node.pruned === "bound") {
      return "podado por cota";
    }
    if (node.pruned === "integer") {
      return node.id === r.bestNode ? "entera, óptimo" : "entera";
    }
    if (node.pruned === "unbounded") {
      return "ilimitado";
    }
    return node.branchedOn ? `ramifica en ${node.branchedOn}` : "abierto";
  };
  lines.push(
    textTable(
      ["Nodo", "Padre", "Rama", "Cota", "Solución", "Estado"],
      ["r", "r", "l", "r", "l", "l"],
      r.nodes.map((node) => [
        String(node.id),
        node.parent === null ? "-" : String(node.parent),
        node.branch
          ? `${node.branch.variable} ${node.branch.direction} ${number(node.branch.value)}`
          : "-",
        node.bound ? number(node.bound) : "-",
        node.solution
          ? node.solution
              .map((v) => `${v.name} = ${number(v.value)}`)
              .join(", ")
          : "-",
        kindLabel(node),
      ]),
    ),
  );
  return `${lines.join("\n")}\n`;
}

export function reportGomory(
  model: LPModel,
  r: GomoryResult,
  options: NumberOptions = {},
): string {
  const number = numberFormatter(options);
  const names = model.variables.map((v) => v.name);
  const lines: string[] = ["LibreIO. Cortes de Gomory"];
  if (model.title) {
    lines.push(`Problema: ${model.title}`);
  }
  lines.push(
    `Objetivo: ${model.sense === "max" ? "MAX" : "MIN"} ${formatLinearExpression(model.objective, names, number)}`,
  );
  lines.push("");
  if (r.status === "optimal" && r.solution) {
    lines.push(
      `Óptimo entero: Z = ${number(r.solution.objective)} con ${r.cuts.length} corte${r.cuts.length === 1 ? "" : "s"}`,
    );
    lines.push(
      r.solution.variables
        .map((v) => `${v.name} = ${number(v.value)}`)
        .join(", "),
    );
  } else if (r.status === "infeasible") {
    lines.push("El problema entero es infactible.");
  } else if (r.status === "unbounded") {
    lines.push("La relajación lineal es ilimitada.");
  } else {
    lines.push(
      "No se llegó a una solución entera: se alcanzó el límite de cortes o el corte no se pudo expresar.",
    );
  }
  lines.push("");
  lines.push(
    textTable(
      ["Iteración", "Z relajación", "Solución", "Corte generado"],
      ["r", "r", "l", "l"],
      r.iterations.map((it) => [
        String(it.index),
        it.lp.solution ? number(it.lp.solution.objective) : "-",
        it.solution.map((v) => `${v.name} = ${number(v.value)}`).join(", "),
        it.cut
          ? `Corte ${it.cut.index} (fila de ${it.cut.sourceVariable}): ${cutText(model, it.cut, number)}`
          : it.integer
            ? "solución entera"
            : "-",
      ]),
    ),
  );
  if (r.cuts.length > 0) {
    lines.push("", "Partes fraccionarias de la fila fuente de cada corte");
    for (const cut of r.cuts) {
      lines.push(
        `Corte ${cut.index}: ${cut.tableauRow.names.map((name, i) => `${number(cut.tableauRow.coefficients[i]!)} ${name}`).join(" + ")} >= ${number(cut.tableauRow.rhs)}`,
      );
    }
  }
  lines.push("", ...r.messages);
  return `${lines.join("\n")}\n`;
}
