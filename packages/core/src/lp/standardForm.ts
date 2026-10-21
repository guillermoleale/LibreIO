// SPDX-License-Identifier: GPL-3.0-or-later
// Conversión del modelo a forma estándar de maximización con holguras, excesos y artificiales.
import { Fraction } from "../rational/Fraction";
import type { LPModel, Relation, Sense } from "../parser/model";

export type ColumnKind = "decision" | "slack" | "surplus" | "artificial";

export interface Column {
  /** Nombre que se muestra: X, SLK 2, ART 3, o X+ y X- para una variable libre. */
  readonly name: string;
  readonly kind: ColumnKind;
  /** Fila de la forma estándar a la que pertenece una holgura, exceso o artificial. */
  readonly rowIndex: number | null;
  /** Índice de la variable original para las columnas de decisión. */
  readonly variableIndex: number | null;
  /** -1 para la parte negativa de una variable libre. */
  readonly sign: 1 | -1;
}

export interface StandardRow {
  readonly index: number;
  /** Número de fila al estilo LINDO (la fila 1 es la función objetivo). */
  readonly row: number;
  readonly label: string | null;
  /** Relación después de normalizar el lado derecho a no negativo. */
  readonly relation: Relation;
  /** Restricción original, o null si la fila viene de una cota. */
  readonly constraintIndex: number | null;
  readonly boundOf: number | null;
  readonly boundKind: "lower" | "upper" | null;
  /** La fila se multiplicó por -1 porque su lado derecho era negativo. */
  readonly flipped: boolean;
  /** Columna de holgura (<=) o de exceso (>=). */
  readonly slackColumn: number | null;
  readonly artificialColumn: number | null;
}

export interface StandardForm {
  readonly sense: Sense;
  readonly columns: Column[];
  readonly A: Fraction[][];
  readonly b: Fraction[];
  /** Coeficientes de la función objetivo en forma de maximización. */
  readonly c: Fraction[];
  readonly rows: StandardRow[];
  readonly initialBasis: number[];
  readonly hasArtificials: boolean;
  readonly messages: string[];
}

interface PendingRow {
  readonly label: string | null;
  readonly coefficients: Fraction[];
  readonly relation: Relation;
  readonly rhs: Fraction;
  readonly constraintIndex: number | null;
  readonly boundOf: number | null;
  readonly boundKind: "lower" | "upper" | null;
}

export function toStandardForm(model: LPModel): StandardForm {
  const messages: string[] = [];
  const n = model.variables.length;

  // Columnas de decisión: una por variable, dos si la variable es libre o tiene cota inferior negativa.
  const columns: Column[] = [];
  const decisionColumns: number[][] = model.variables.map(() => []);
  model.variables.forEach((v, i) => {
    const split = !v.lower.finite || v.lower.value.isNegative();
    if (split) {
      decisionColumns[i]!.push(columns.length);
      columns.push({
        name: `${v.name}+`,
        kind: "decision",
        rowIndex: null,
        variableIndex: i,
        sign: 1,
      });
      decisionColumns[i]!.push(columns.length);
      columns.push({
        name: `${v.name}-`,
        kind: "decision",
        rowIndex: null,
        variableIndex: i,
        sign: -1,
      });
    } else {
      decisionColumns[i]!.push(columns.length);
      columns.push({
        name: v.name,
        kind: "decision",
        rowIndex: null,
        variableIndex: i,
        sign: 1,
      });
    }
  });
  const decisionCount = columns.length;

  const pending: PendingRow[] = model.constraints.map((c, i) => ({
    label: c.label,
    coefficients: c.coefficients,
    relation: c.relation,
    rhs: c.rhs,
    constraintIndex: i,
    boundOf: null,
    boundKind: null,
  }));
  const unit = (i: number): Fraction[] =>
    model.variables.map((_, j) => (j === i ? Fraction.ONE : Fraction.ZERO));
  model.variables.forEach((v, i) => {
    if (v.lower.finite && !v.lower.value.isZero()) {
      pending.push({
        label: `SLB ${v.name}`,
        coefficients: unit(i),
        relation: ">=",
        rhs: v.lower.value,
        constraintIndex: null,
        boundOf: i,
        boundKind: "lower",
      });
    }
    if (v.upper.finite) {
      pending.push({
        label: `SUB ${v.name}`,
        coefficients: unit(i),
        relation: "<=",
        rhs: v.upper.value,
        constraintIndex: null,
        boundOf: i,
        boundKind: "upper",
      });
    }
  });

  const integerNames = model.variables
    .filter((v) => v.kind !== "continuous")
    .map((v) => v.name);
  if (integerNames.length > 0) {
    messages.push(
      `Las variables enteras o binarias (${integerNames.join(", ")}) se resuelven como relajación continua. La programación entera llega en la fase 2.`,
    );
  }

  // Filas con lado derecho no negativo
  const rowsData = pending.map((p, index) => {
    const flipped = p.rhs.isNegative();
    const factor = flipped ? Fraction.MINUS_ONE : Fraction.ONE;
    const relation: Relation = flipped
      ? p.relation === "<="
        ? ">="
        : p.relation === ">="
          ? "<="
          : "="
      : p.relation;
    const row = index + 2;
    if (flipped) {
      messages.push(
        `La fila ${p.label ?? row} se multiplicó por -1 porque su lado derecho era negativo.`,
      );
    }
    return {
      ...p,
      index,
      row,
      flipped,
      relation,
      rhs: p.rhs.mul(factor),
      factor,
    };
  });

  // Holguras y excesos
  const slackColumns: Array<number | null> = rowsData.map(() => null);
  rowsData.forEach((r, i) => {
    if (r.relation === "<=") {
      slackColumns[i] = columns.length;
      columns.push({
        name: `SLK ${r.row}`,
        kind: "slack",
        rowIndex: i,
        variableIndex: null,
        sign: 1,
      });
    } else if (r.relation === ">=") {
      slackColumns[i] = columns.length;
      columns.push({
        name: `SLK ${r.row}`,
        kind: "surplus",
        rowIndex: i,
        variableIndex: null,
        sign: 1,
      });
    }
  });
  // Artificiales
  const artificialColumns: Array<number | null> = rowsData.map(() => null);
  rowsData.forEach((r, i) => {
    if (r.relation !== "<=") {
      artificialColumns[i] = columns.length;
      columns.push({
        name: `ART ${r.row}`,
        kind: "artificial",
        rowIndex: i,
        variableIndex: null,
        sign: 1,
      });
    }
  });

  const totalColumns = columns.length;
  const A: Fraction[][] = rowsData.map((r, i) => {
    const row: Fraction[] = Array.from(
      { length: totalColumns },
      () => Fraction.ZERO,
    );
    for (let v = 0; v < n; v += 1) {
      const coef = r.coefficients[v]!.mul(r.factor);
      for (const col of decisionColumns[v]!) {
        row[col] = columns[col]!.sign === 1 ? coef : coef.neg();
      }
    }
    const slack = slackColumns[i];
    if (slack !== null && slack !== undefined) {
      row[slack] = r.relation === "<=" ? Fraction.ONE : Fraction.MINUS_ONE;
    }
    const artificial = artificialColumns[i];
    if (artificial !== null && artificial !== undefined) {
      row[artificial] = Fraction.ONE;
    }
    return row;
  });
  const b = rowsData.map((r) => r.rhs);

  const senseFactor = model.sense === "max" ? Fraction.ONE : Fraction.MINUS_ONE;
  const c: Fraction[] = Array.from(
    { length: totalColumns },
    () => Fraction.ZERO,
  );
  for (let col = 0; col < decisionCount; col += 1) {
    const column = columns[col]!;
    const coef = model.objective[column.variableIndex!]!.mul(senseFactor);
    c[col] = column.sign === 1 ? coef : coef.neg();
  }

  const rows: StandardRow[] = rowsData.map((r, i) => ({
    index: i,
    row: r.row,
    label: r.label,
    relation: r.relation,
    constraintIndex: r.constraintIndex,
    boundOf: r.boundOf,
    boundKind: r.boundKind,
    flipped: r.flipped,
    slackColumn: slackColumns[i] ?? null,
    artificialColumn: artificialColumns[i] ?? null,
  }));
  const initialBasis = rows.map((r) =>
    r.relation === "<=" ? r.slackColumn! : r.artificialColumn!,
  );

  return {
    sense: model.sense,
    columns,
    A,
    b,
    c,
    rows,
    initialBasis,
    hasArtificials: rows.some((r) => r.artificialColumn !== null),
    messages,
  };
}
