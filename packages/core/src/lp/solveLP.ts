// SPDX-License-Identifier: GPL-3.0-or-later
// Simplex tableau con dos fases o Big M, traza completa, pivoteo manual y análisis posóptimo.
import { Fraction } from "../rational/Fraction";
import type { LPModel } from "../parser/model";
import { MValue } from "./MValue";
import { toStandardForm, type StandardForm } from "./standardForm";
import {
  analyzeTableau,
  basicNames,
  chooseEntering,
  chooseLeaving,
  columnIndexByName,
  initialTableau,
  isBasic,
  phaseCosts,
  pivot,
  ratios,
  withObjective,
  type EnteringRule,
  type Phase,
  type SimplexMethod,
  type Tableau,
} from "./tableau";
import { computeSensitivity, type Sensitivity } from "./sensitivity";
import { dualSolution, formulateDual, type DualResult } from "./dual";

export interface SolveOptions {
  readonly method?: SimplexMethod;
  readonly rule?: EnteringRule;
}

export type LPStatus = "optimal" | "unbounded" | "infeasible";

export interface VariableValue {
  readonly name: string;
  readonly value: Fraction;
}

export interface Iteration {
  /** Posición en la traza, desde 0. */
  readonly index: number;
  readonly phase: Phase;
  readonly tableau: Tableau;
  /** Columna que entra desde este tableau, o null si es el último de su fase. */
  readonly entering: number | null;
  readonly leaving: number | null;
  readonly pivotRow: number | null;
  readonly enteringName: string | null;
  readonly leavingName: string | null;
  /** Razón mínima de cada fila para la columna que entra. */
  readonly ratios: Array<Fraction | null> | null;
  /** Filas empatadas en la razón mínima. */
  readonly tiedRows: number[];
  /** Explicación en español de lo que pasa en este paso. */
  readonly note: string;
}

export interface LPSolution {
  readonly variables: VariableValue[];
  /** Valor de Z en el sentido original del problema. */
  readonly objective: Fraction;
}

export interface Infeasibility {
  readonly artificial: string;
  readonly row: number;
  readonly value: Fraction;
}

export interface LPResult {
  readonly status: LPStatus;
  readonly method: SimplexMethod;
  readonly rule: EnteringRule;
  readonly standardForm: StandardForm;
  readonly trace: Iteration[];
  /** Cantidad de pivotes. */
  readonly iterations: number;
  readonly solution: LPSolution | null;
  readonly sensitivity: Sensitivity | null;
  readonly dual: DualResult | null;
  readonly flags: {
    readonly degenerate: boolean;
    readonly alternativeOptima: boolean;
  };
  readonly messages: string[];
  readonly unboundedVariable: string | null;
  readonly infeasibility: Infeasibility[] | null;
}

function name(t: Tableau, col: number | null): string | null {
  return col === null ? null : t.columns[col]!.name;
}

function rowLabel(sf: StandardForm, i: number): string {
  const row = sf.rows[i]!;
  return row.label ?? String(row.row);
}

function step(
  index: number,
  t: Tableau,
  partial: Partial<Omit<Iteration, "index" | "phase" | "tableau">> & {
    note: string;
  },
): Iteration {
  const entering = partial.entering ?? null;
  const leaving = partial.leaving ?? null;
  return {
    index,
    phase: t.phase,
    tableau: t,
    entering,
    leaving,
    pivotRow: partial.pivotRow ?? null,
    enteringName: name(t, entering),
    leavingName: name(t, leaving),
    ratios: partial.ratios ?? null,
    tiedRows: partial.tiedRows ?? [],
    note: partial.note,
  };
}

function pivotNote(
  t: Tableau,
  sf: StandardForm,
  entering: number,
  pivotRow: number,
  r: Fraction,
  tiedRows: number[],
): string {
  const d = t.objectiveRow[entering]!;
  let note = `Entra ${name(t, entering)} (costo reducido ${d.toString()}) y sale ${name(t, t.basis[pivotRow]!)} (razón mínima ${r.toString()}).`;
  if (tiedRows.length > 1) {
    const labels = tiedRows.map((i) => rowLabel(sf, i)).join(" y ");
    note += ` Empate de razón mínima entre las filas ${labels}: sale la de menor índice.`;
  }
  return note;
}

/** Artificiales básicas con valor positivo: el problema es infactible. */
function positiveArtificials(t: Tableau, sf: StandardForm): Infeasibility[] {
  const list: Infeasibility[] = [];
  t.basis.forEach((col, i) => {
    const column = t.columns[col]!;
    if (column.kind === "artificial" && t.rhs[i]!.isPositive()) {
      list.push({
        artificial: column.name,
        row: sf.rows[column.rowIndex!]!.row,
        value: t.rhs[i]!,
      });
    }
  });
  return list;
}

/** Saca de la base, con pivotes degenerados, las artificiales que quedaron básicas en cero. */
function driveOutArtificials(
  t: Tableau,
  sf: StandardForm,
  trace: Iteration[],
): Tableau {
  let current = t;
  for (;;) {
    let done = true;
    for (let i = 0; i < current.basis.length; i += 1) {
      const col = current.basis[i]!;
      if (current.columns[col]!.kind !== "artificial") {
        continue;
      }
      const row = current.rows[i]!;
      const target = row.findIndex(
        (a, j) =>
          !a.isZero() &&
          current.columns[j]!.kind !== "artificial" &&
          !isBasic(current, j),
      );
      if (target < 0) {
        continue;
      }
      trace.push(
        step(trace.length, current, {
          entering: target,
          leaving: col,
          pivotRow: i,
          ratios: ratios(current, target),
          note: `Pivote degenerado: ${name(current, col)} está en la base con valor cero y se reemplaza por ${name(current, target)} para dejar solo variables del problema original. Z no cambia.`,
        }),
      );
      current = pivot(current, i, target);
      done = false;
      break;
    }
    if (done) {
      return current;
    }
  }
}

function solutionFrom(
  model: LPModel,
  sf: StandardForm,
  t: Tableau,
): LPSolution {
  const values = model.variables.map(() => Fraction.ZERO);
  t.basis.forEach((col, i) => {
    const column = t.columns[col]!;
    if (column.kind === "decision") {
      const v = column.variableIndex!;
      const value = t.rhs[i]!;
      values[v] = values[v]!.add(column.sign === 1 ? value : value.neg());
    }
  });
  const objective =
    sf.sense === "max" ? t.objectiveValue.c : t.objectiveValue.c.neg();
  return {
    variables: model.variables.map((v, i) => ({
      name: v.name,
      value: values[i]!,
    })),
    objective,
  };
}

/** Columnas que se omiten en el análisis: artificiales y la parte negativa de las variables libres. */
export function isAuxiliaryColumn(t: Tableau, col: number): boolean {
  const column = t.columns[col]!;
  return (
    column.kind === "artificial" ||
    (column.kind === "decision" && column.sign === -1)
  );
}

function detectAlternativeOptima(t: Tableau): string | null {
  for (let j = 0; j < t.columns.length; j += 1) {
    if (
      isBasic(t, j) ||
      isAuxiliaryColumn(t, j) ||
      !t.objectiveRow[j]!.isZero()
    ) {
      continue;
    }
    const r = ratios(t, j);
    const leaving = chooseLeaving(r);
    if (leaving === null || r[leaving.pivotRow]!.isPositive()) {
      return t.columns[j]!.name;
    }
  }
  return null;
}

export function solveLP(model: LPModel, options: SolveOptions = {}): LPResult {
  const method: SimplexMethod = options.method ?? "twoPhase";
  const rule: EnteringRule = options.rule ?? "dantzig";
  const sf = toStandardForm(model);
  const messages: string[] = [...sf.messages];
  const trace: Iteration[] = [];
  let t = initialTableau(sf, method);
  let status: LPStatus | null = null;
  let unboundedVariable: string | null = null;
  let infeasibility: Infeasibility[] | null = null;

  const pivotCount = (): number =>
    trace.filter((s) => s.entering !== null).length;

  while (status === null) {
    const analysis = analyzeTableau(t, rule);
    if (analysis.kind === "pivot") {
      const r = analysis.ratios[analysis.pivotRow]!;
      trace.push(
        step(trace.length, t, {
          entering: analysis.entering,
          leaving: analysis.leaving,
          pivotRow: analysis.pivotRow,
          ratios: analysis.ratios,
          tiedRows: analysis.tiedRows,
          note: pivotNote(
            t,
            sf,
            analysis.entering,
            analysis.pivotRow,
            r,
            analysis.tiedRows,
          ),
        }),
      );
      t = pivot(t, analysis.pivotRow, analysis.entering);
      continue;
    }
    if (analysis.kind === "unbounded") {
      const positive = positiveArtificials(t, sf);
      if (positive.length > 0) {
        // Big M: la dirección ilimitada no reduce las artificiales, así que el original es infactible.
        infeasibility = positive;
        status = "infeasible";
        trace.push(
          step(trace.length, t, {
            note: `Problema infactible: la variable artificial ${positive[0]!.artificial} sigue en la base con valor ${positive[0]!.value.toString()} y ninguna variable puede reducirla.`,
          }),
        );
        messages.push(
          `Problema infactible: la variable artificial ${positive[0]!.artificial} queda en la base con valor ${positive[0]!.value.toString()}.`,
        );
        break;
      }
      unboundedVariable = name(t, analysis.entering);
      status = "unbounded";
      trace.push(
        step(trace.length, t, {
          entering: analysis.entering,
          ratios: analysis.ratios,
          note: `Problema ilimitado: ${unboundedVariable} tiene costo reducido ${t.objectiveRow[analysis.entering]!.toString()} y mejora la función objetivo, pero ninguna fila tiene razón mínima porque ningún coeficiente de su columna es positivo.`,
        }),
      );
      messages.push(
        `Problema ilimitado: la variable ${unboundedVariable} mejora la función objetivo sin límite porque ninguna fila tiene razón mínima (ningún coeficiente positivo en su columna).`,
      );
      break;
    }
    // Óptimo de la fase actual
    if (t.phase === "phase1") {
      const positive = positiveArtificials(t, sf);
      if (positive.length > 0) {
        infeasibility = positive;
        status = "infeasible";
        const sum = t.objectiveValue.c.neg();
        trace.push(
          step(trace.length, t, {
            note: `Fin de la fase 1 con suma de artificiales ${sum.toString()}: la artificial ${positive[0]!.artificial} vale ${positive[0]!.value.toString()}. El problema es infactible.`,
          }),
        );
        messages.push(
          `Problema infactible: al terminar la fase 1 la variable artificial ${positive[0]!.artificial} sigue en la base con valor ${positive[0]!.value.toString()}.`,
        );
        break;
      }
      trace.push(
        step(trace.length, t, {
          note: "Fin de la fase 1: todas las artificiales valen cero. Se restaura la función objetivo original y empieza la fase 2.",
        }),
      );
      t = driveOutArtificials(t, sf, trace);
      t = withObjective(t, phaseCosts(sf, "phase2"), "phase2");
      continue;
    }
    const positive = positiveArtificials(t, sf);
    if (positive.length > 0) {
      infeasibility = positive;
      status = "infeasible";
      trace.push(
        step(trace.length, t, {
          note: `Óptimo de la Big M con la artificial ${positive[0]!.artificial} en la base con valor ${positive[0]!.value.toString()}: el valor óptimo contiene a M, el problema es infactible.`,
        }),
      );
      messages.push(
        `Problema infactible: en el óptimo del método de la Big M la artificial ${positive[0]!.artificial} vale ${positive[0]!.value.toString()} y el valor óptimo contiene a M.`,
      );
      break;
    }
    if (
      t.phase === "bigM" &&
      t.basis.some((col) => t.columns[col]!.kind === "artificial")
    ) {
      const before = trace.length;
      t = driveOutArtificials(t, sf, trace);
      if (trace.length > before) {
        continue;
      }
    }
    status = "optimal";
    trace.push(
      step(trace.length, t, {
        note: `Tableau óptimo: ningún costo reducido es negativo. Z = ${(sf.sense === "max" ? t.objectiveValue.c : t.objectiveValue.c.neg()).toString()}.`,
      }),
    );
  }

  const iterations = pivotCount();
  if (status !== "optimal") {
    return {
      status,
      method,
      rule,
      standardForm: sf,
      trace,
      iterations,
      solution: null,
      sensitivity: null,
      dual: null,
      flags: { degenerate: false, alternativeOptima: false },
      messages,
      unboundedVariable,
      infeasibility,
    };
  }

  const solution = solutionFrom(model, sf, t);
  messages.unshift(
    `Óptimo encontrado en ${iterations} iteraciones. Z = ${solution.objective.toString()}.`,
  );
  const zeroBasics = t.basis
    .filter((_, i) => t.rhs[i]!.isZero())
    .map((col) => t.columns[col]!.name);
  const degenerate = zeroBasics.length > 0;
  if (degenerate) {
    messages.push(
      `La solución es degenerada: ${zeroBasics.length === 1 ? "la variable básica" : "las variables básicas"} ${zeroBasics.join(", ")} ${zeroBasics.length === 1 ? "vale" : "valen"} cero.`,
    );
  }
  const alternative = detectAlternativeOptima(t);
  if (alternative !== null) {
    messages.push(
      `Existen soluciones alternativas: la variable no básica ${alternative} tiene costo reducido cero y puede entrar a la base sin cambiar Z.`,
    );
  }
  const sensitivity = computeSensitivity(model, sf, t, solution);
  const dualModel = formulateDual(model);
  const dual = dualSolution(dualModel, sensitivity, solution.objective);
  return {
    status,
    method,
    rule,
    standardForm: sf,
    trace,
    iterations,
    solution,
    sensitivity,
    dual,
    flags: { degenerate, alternativeOptima: alternative !== null },
    messages,
    unboundedVariable: null,
    infeasibility: null,
  };
}

export type PivotOutcome =
  | {
      readonly ok: true;
      readonly step: Iteration;
      readonly next: Tableau;
      readonly dantzig: boolean;
      readonly warning: string | null;
    }
  | { readonly ok: false; readonly error: string };

/**
 * Pivoteo manual: el alumno elige la variable que entra y opcionalmente la que sale.
 * Valida la elección y avisa cuando es válida pero no es la de Dantzig o no respeta la razón mínima.
 */
export function manualPivot(
  t: Tableau,
  enteringName: string,
  leavingName?: string,
): PivotOutcome {
  const entering = columnIndexByName(t, enteringName);
  if (entering < 0) {
    return {
      ok: false,
      error: `La variable '${enteringName}' no existe en el tableau.`,
    };
  }
  const label = t.columns[entering]!.name;
  if (isBasic(t, entering)) {
    return {
      ok: false,
      error: `La variable ${label} ya es básica y no puede entrar.`,
    };
  }
  if (t.columns[entering]!.kind === "artificial") {
    return {
      ok: false,
      error: `La variable artificial ${label} no puede volver a entrar a la base.`,
    };
  }
  const d = t.objectiveRow[entering]!;
  if (!d.isNegative()) {
    return {
      ok: false,
      error: `La variable ${label} no mejora la función objetivo: su costo reducido es ${d.toString()} y debe ser negativo para entrar.`,
    };
  }
  const r = ratios(t, entering);
  const best = chooseLeaving(r);
  const warnings: string[] = [];
  const dantzigChoice = chooseEntering(t, "dantzig");
  const dantzig = dantzigChoice === entering;
  if (!dantzig && dantzigChoice !== null) {
    warnings.push(
      `La regla de Dantzig elegiría ${name(t, dantzigChoice)} (costo reducido ${t.objectiveRow[dantzigChoice]!.toString()}). La elección es válida y se pivotea igual.`,
    );
  }
  let pivotRow: number;
  if (leavingName !== undefined && leavingName !== "") {
    const leaving = columnIndexByName(t, leavingName);
    if (leaving < 0) {
      return {
        ok: false,
        error: `La variable '${leavingName}' no existe en el tableau.`,
      };
    }
    const row = t.basis.indexOf(leaving);
    if (row < 0) {
      return {
        ok: false,
        error: `La variable ${name(t, leaving)} no es básica y no puede salir.`,
      };
    }
    if (r[row] === null) {
      return {
        ok: false,
        error: `La variable ${name(t, leaving)} no puede salir: el coeficiente de ${label} en su fila no es positivo y no hay razón mínima.`,
      };
    }
    pivotRow = row;
    if (
      best !== null &&
      best.pivotRow !== row &&
      r[row]!.gt(r[best.pivotRow]!)
    ) {
      warnings.push(
        `${name(t, leaving)} no tiene la razón mínima (${r[row]!.toString()} contra ${r[best.pivotRow]!.toString()} de ${name(t, t.basis[best.pivotRow]!)}): el nuevo tableau deja de ser factible.`,
      );
    }
  } else {
    if (best === null) {
      return {
        ok: false,
        error: `La variable ${label} no tiene razón mínima: ningún coeficiente de su columna es positivo, el problema es ilimitado en esa dirección.`,
      };
    }
    pivotRow = best.pivotRow;
  }
  const leaving = t.basis[pivotRow]!;
  const tiedRows =
    best !== null && best.pivotRow === pivotRow ? best.tiedRows : [];
  const note = `Entra ${label} (costo reducido ${d.toString()}) y sale ${name(t, leaving)} (razón ${r[pivotRow]!.toString()}).`;
  return {
    ok: true,
    step: step(0, t, {
      entering,
      leaving,
      pivotRow,
      ratios: r,
      tiedRows,
      note,
    }),
    next: pivot(t, pivotRow, entering),
    dantzig,
    warning: warnings.length > 0 ? warnings.join(" ") : null,
  };
}

export { basicNames, MValue };
