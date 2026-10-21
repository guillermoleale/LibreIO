// SPDX-License-Identifier: GPL-3.0-or-later
import type { Fraction } from "../rational/Fraction";

export interface MarkovProblem {
  readonly title: string | null;
  readonly states: string[];
  /** Matriz de transición: matrix[i][j] = P(ir de i a j). */
  readonly matrix: Fraction[][];
}

export interface CommunicationClass {
  readonly states: string[];
  readonly recurrent: boolean;
}

export interface AbsorbingAnalysis {
  readonly transient: string[];
  readonly absorbing: string[];
  /** Transiciones entre transitorios. */
  readonly Q: Fraction[][];
  /** Transiciones de transitorios a absorbentes. */
  readonly R: Fraction[][];
  /** Matriz fundamental N = (I - Q)^-1. */
  readonly N: Fraction[][];
  /** Probabilidades de absorción B = N R. */
  readonly B: Fraction[][];
  /** Pasos esperados hasta la absorción desde cada transitorio. */
  readonly expectedSteps: Fraction[];
}

export interface MarkovResult {
  readonly problem: MarkovProblem;
  readonly states: string[];
  readonly matrix: Fraction[][];
  readonly classes: CommunicationClass[];
  readonly absorbingStates: string[];
  readonly transientStates: string[];
  readonly recurrentStates: string[];
  readonly irreducible: boolean;
  readonly period: number | null;
  readonly periodic: boolean;
  readonly regular: boolean;
  /** Distribución estacionaria de una cadena irreducible (regular o periódica). */
  readonly stationary: Fraction[] | null;
  /** Estado estable: solo si la cadena es regular. */
  readonly steadyState: Fraction[] | null;
  /** m[i][j]: tiempo medio de primer paso de i a j; en la diagonal, tiempo de recurrencia. */
  readonly meanFirstPassage: Fraction[][] | null;
  readonly recurrenceTimes: Fraction[] | null;
  readonly absorbing: AbsorbingAnalysis | null;
  readonly distributionAfter: (initial: Fraction[], n: number) => Fraction[];
  readonly power: (n: number) => Fraction[][];
  readonly messages: string[];
}
