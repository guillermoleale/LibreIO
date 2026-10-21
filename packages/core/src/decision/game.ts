// SPDX-License-Identifier: GPL-3.0-or-later
// Juegos de suma cero de dos jugadores: punto de silla, dominancia, resolución gráfica en 2 por n
// (o m por 2) y programación lineal en general.
import { Fraction } from "../rational/Fraction";
import { INFINITY, NEG_INFINITY, finite } from "../rational/Extended";
import type { Constraint, LPModel } from "../parser/model";
import { solveLP } from "../lp/solveLP";

export interface DominanceStep {
  readonly kind: "row" | "column";
  readonly removed: number;
  readonly by: number;
  readonly note: string;
}

export interface GraphicalLine {
  /** Índice de la estrategia del otro jugador que define la recta. */
  readonly index: number;
  /** Valor en p = 0 y en p = 1. */
  readonly atZero: Fraction;
  readonly atOne: Fraction;
}

export interface GraphicalSolution {
  readonly player: "row" | "column";
  /** Índices (en la matriz original) de las dos estrategias del jugador que se grafica. */
  readonly strategies: [number, number];
  readonly lines: GraphicalLine[];
  readonly optimum: Fraction;
  readonly value: Fraction;
}

export interface GameResult {
  readonly rows: string[];
  readonly columns: string[];
  readonly matrix: Fraction[][];
  readonly maximin: { readonly value: Fraction; readonly row: number };
  readonly minimax: { readonly value: Fraction; readonly column: number };
  readonly saddle: {
    readonly row: number;
    readonly column: number;
    readonly value: Fraction;
  } | null;
  readonly dominance: {
    readonly steps: DominanceStep[];
    readonly rows: number[];
    readonly columns: number[];
  };
  readonly rowStrategy: Fraction[];
  readonly columnStrategy: Fraction[];
  readonly value: Fraction;
  readonly method: "saddle" | "graphical" | "lp";
  readonly graphical: GraphicalSolution | null;
  readonly lp: { readonly row: LPModel; readonly column: LPModel } | null;
  readonly messages: string[];
}

export interface GameOptions {
  readonly rows?: string[];
  readonly columns?: string[];
}

function dominated(
  a: Fraction[],
  b: Fraction[],
  better: (x: Fraction, y: Fraction) => boolean,
): boolean {
  // a está dominada por b si b es al menos tan buena en todo y mejor en algo
  return (
    a.every((v, k) => better(b[k]!, v) || b[k]!.eq(v)) &&
    a.some((v, k) => better(b[k]!, v) && !b[k]!.eq(v))
  );
}

function gameLP(
  matrix: Fraction[][],
  rows: number[],
  columns: number[],
  player: "row" | "column",
): LPModel {
  if (player === "row") {
    const names = [...rows.map((i) => `P${i + 1}`), "V"];
    const variables = names.map((name) => ({
      name,
      lower: name === "V" ? NEG_INFINITY : finite(Fraction.ZERO),
      upper: INFINITY,
      kind: "continuous" as const,
    }));
    const objective = names.map((name) =>
      name === "V" ? Fraction.ONE : Fraction.ZERO,
    );
    const constraints: Constraint[] = columns.map((j, k) => ({
      label: `C${j + 1}`,
      row: k + 2,
      coefficients: [...rows.map((i) => matrix[i]![j]!), Fraction.MINUS_ONE],
      relation: ">=" as const,
      rhs: Fraction.ZERO,
    }));
    constraints.push({
      label: "SUMA",
      row: columns.length + 2,
      coefficients: [...rows.map(() => Fraction.ONE), Fraction.ZERO],
      relation: "=" as const,
      rhs: Fraction.ONE,
    });
    return {
      title: "Jugador de filas",
      sense: "max",
      variables,
      objective,
      constraints,
    };
  }
  const names = [...columns.map((j) => `Q${j + 1}`), "W"];
  const variables = names.map((name) => ({
    name,
    lower: name === "W" ? NEG_INFINITY : finite(Fraction.ZERO),
    upper: INFINITY,
    kind: "continuous" as const,
  }));
  const objective = names.map((name) =>
    name === "W" ? Fraction.ONE : Fraction.ZERO,
  );
  const constraints: Constraint[] = rows.map((i, k) => ({
    label: `F${i + 1}`,
    row: k + 2,
    coefficients: [...columns.map((j) => matrix[i]![j]!), Fraction.MINUS_ONE],
    relation: "<=" as const,
    rhs: Fraction.ZERO,
  }));
  constraints.push({
    label: "SUMA",
    row: rows.length + 2,
    coefficients: [...columns.map(() => Fraction.ONE), Fraction.ZERO],
    relation: "=" as const,
    rhs: Fraction.ONE,
  });
  return {
    title: "Jugador de columnas",
    sense: "min",
    variables,
    objective,
    constraints,
  };
}

export function solveGame(
  matrix: Fraction[][],
  options: GameOptions = {},
): GameResult {
  const m = matrix.length;
  const n = matrix[0]?.length ?? 0;
  if (m === 0 || n === 0 || matrix.some((r) => r.length !== n)) {
    throw new RangeError("La matriz del juego debe ser rectangular y no vacía");
  }
  const rowNames = options.rows ?? matrix.map((_, i) => `F${i + 1}`);
  const columnNames = options.columns ?? matrix[0]!.map((_, j) => `C${j + 1}`);
  const rowMins = matrix.map((r) => r.reduce((a, b) => Fraction.min(a, b)));
  const colMaxs = matrix[0]!.map((_, j) =>
    matrix.map((r) => r[j]!).reduce((a, b) => Fraction.max(a, b)),
  );
  let maximinRow = 0;
  rowMins.forEach((v, i) => {
    if (v.gt(rowMins[maximinRow]!)) {
      maximinRow = i;
    }
  });
  let minimaxCol = 0;
  colMaxs.forEach((v, j) => {
    if (v.lt(colMaxs[minimaxCol]!)) {
      minimaxCol = j;
    }
  });
  const maximin = { value: rowMins[maximinRow]!, row: maximinRow };
  const minimax = { value: colMaxs[minimaxCol]!, column: minimaxCol };
  const messages: string[] = [];
  if (maximin.value.eq(minimax.value)) {
    const value = maximin.value;
    messages.push(
      `Maximin = minimax = ${value.toString()}: punto de silla en ${rowNames[maximinRow]} y ${columnNames[minimaxCol]}. Estrategias puras.`,
    );
    return {
      rows: rowNames,
      columns: columnNames,
      matrix,
      maximin,
      minimax,
      saddle: { row: maximinRow, column: minimaxCol, value },
      dominance: {
        steps: [],
        rows: matrix.map((_, i) => i),
        columns: matrix[0]!.map((_, j) => j),
      },
      rowStrategy: matrix.map((_, i) =>
        i === maximinRow ? Fraction.ONE : Fraction.ZERO,
      ),
      columnStrategy: matrix[0]!.map((_, j) =>
        j === minimaxCol ? Fraction.ONE : Fraction.ZERO,
      ),
      value,
      method: "saddle",
      graphical: null,
      lp: null,
      messages,
    };
  }
  messages.push(
    `Maximin ${maximin.value.toString()} y minimax ${minimax.value.toString()} no coinciden: no hay punto de silla, se buscan estrategias mixtas.`,
  );
  // Dominancia
  let rows = matrix.map((_, i) => i);
  let columns = matrix[0]!.map((_, j) => j);
  const steps: DominanceStep[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const i of rows) {
      for (const k of rows) {
        if (i === k) {
          continue;
        }
        const a = columns.map((j) => matrix[i]![j]!);
        const b = columns.map((j) => matrix[k]![j]!);
        if (dominated(a, b, (x, y) => x.gt(y))) {
          steps.push({
            kind: "row",
            removed: i,
            by: k,
            note: `La fila ${rowNames[i]} está dominada por ${rowNames[k]} y se elimina.`,
          });
          rows = rows.filter((r) => r !== i);
          changed = true;
          break;
        }
      }
      if (changed) {
        break;
      }
    }
    if (changed) {
      continue;
    }
    for (const j of columns) {
      for (const l of columns) {
        if (j === l) {
          continue;
        }
        const a = rows.map((i) => matrix[i]![j]!);
        const b = rows.map((i) => matrix[i]![l]!);
        if (dominated(a, b, (x, y) => x.lt(y))) {
          steps.push({
            kind: "column",
            removed: j,
            by: l,
            note: `La columna ${columnNames[j]} está dominada por ${columnNames[l]} y se elimina.`,
          });
          columns = columns.filter((c) => c !== j);
          changed = true;
          break;
        }
      }
      if (changed) {
        break;
      }
    }
  }
  // Programación lineal para ambos jugadores sobre el juego reducido
  const rowModel = gameLP(matrix, rows, columns, "row");
  const columnModel = gameLP(matrix, rows, columns, "column");
  const rowResult = solveLP(rowModel);
  const columnResult = solveLP(columnModel);
  if (rowResult.status !== "optimal" || columnResult.status !== "optimal") {
    throw new RangeError(
      "No se pudo resolver el juego por programación lineal",
    );
  }
  const rowStrategy = matrix.map(() => Fraction.ZERO);
  rows.forEach((i, k) => {
    rowStrategy[i] = rowResult.solution!.variables[k]!.value;
  });
  const columnStrategy = matrix[0]!.map(() => Fraction.ZERO);
  columns.forEach((j, k) => {
    columnStrategy[j] = columnResult.solution!.variables[k]!.value;
  });
  const value = rowResult.solution!.objective;
  let graphical: GraphicalSolution | null = null;
  if (rows.length === 2) {
    const [r1, r2] = rows as [number, number];
    const p = rowStrategy[r1]!;
    graphical = {
      player: "row",
      strategies: [r1, r2],
      lines: columns.map((j) => ({
        index: j,
        atZero: matrix[r2]![j]!,
        atOne: matrix[r1]![j]!,
      })),
      optimum: p,
      value,
    };
    messages.push(
      `Resolución gráfica para el jugador de filas: p = ${p.toString()} sobre ${rowNames[r1]} y ${Fraction.ONE.sub(p).toString()} sobre ${rowNames[r2]}.`,
    );
  } else if (columns.length === 2) {
    const [c1, c2] = columns as [number, number];
    const q = columnStrategy[c1]!;
    graphical = {
      player: "column",
      strategies: [c1, c2],
      lines: rows.map((i) => ({
        index: i,
        atZero: matrix[i]![c2]!,
        atOne: matrix[i]![c1]!,
      })),
      optimum: q,
      value,
    };
    messages.push(
      `Resolución gráfica para el jugador de columnas: q = ${q.toString()} sobre ${columnNames[c1]} y ${Fraction.ONE.sub(q).toString()} sobre ${columnNames[c2]}.`,
    );
  }
  messages.push(
    `Valor del juego ${value.toString()}. Filas: (${rowStrategy.map((v) => v.toString()).join(", ")}). Columnas: (${columnStrategy.map((v) => v.toString()).join(", ")}).`,
  );
  return {
    rows: rowNames,
    columns: columnNames,
    matrix,
    maximin,
    minimax,
    saddle: null,
    dominance: { steps, rows, columns },
    rowStrategy,
    columnStrategy,
    value,
    method: graphical ? "graphical" : "lp",
    graphical,
    lp: { row: rowModel, column: columnModel },
    messages,
  };
}
