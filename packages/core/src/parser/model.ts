// SPDX-License-Identifier: GPL-3.0-or-later
// Modelo interno de programación lineal, resultado del parser y entrada de los algoritmos.
import type { Fraction } from "../rational/Fraction";
import type { Extended } from "../rational/Extended";

export type Sense = "max" | "min";
export type Relation = "<=" | ">=" | "=";
export type VariableKind = "continuous" | "integer" | "binary";

export interface Variable {
  /** Nombre en mayúsculas, como lo muestra LINDO. */
  readonly name: string;
  readonly lower: Extended;
  readonly upper: Extended;
  readonly kind: VariableKind;
}

export interface Constraint {
  /** Etiqueta opcional escrita antes del paréntesis. */
  readonly label: string | null;
  /** Número de fila al estilo LINDO: la fila 1 es la función objetivo. */
  readonly row: number;
  /** Coeficientes alineados con `LPModel.variables`. */
  readonly coefficients: Fraction[];
  readonly relation: Relation;
  readonly rhs: Fraction;
}

export interface LPModel {
  readonly title: string | null;
  readonly sense: Sense;
  /** Variables en orden de aparición. */
  readonly variables: Variable[];
  /** Coeficientes de la función objetivo alineados con `variables`. */
  readonly objective: Fraction[];
  readonly constraints: Constraint[];
}

/** Nombre con el que se muestra una fila: su etiqueta o su número. */
export function constraintName(constraint: Constraint): string {
  return constraint.label ?? String(constraint.row);
}
