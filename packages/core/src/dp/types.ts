// SPDX-License-Identifier: GPL-3.0-or-later
import type { Fraction } from "../rational/Fraction";

export interface KnapsackItem {
  readonly name: string;
  readonly weight: Fraction;
  readonly value: Fraction;
  /** Unidades disponibles del objeto (por defecto 1). */
  readonly maxUnits?: number;
}

export interface KnapsackProblem {
  readonly title: string | null;
  readonly capacity: Fraction;
  readonly items: KnapsackItem[];
}

export interface KnapsackDecision {
  readonly units: number;
  readonly value: Fraction;
}

export interface KnapsackRow {
  readonly capacity: Fraction;
  readonly decisions: KnapsackDecision[];
  readonly best: Fraction;
  /** Unidades elegidas del objeto de la etapa. */
  readonly choice: number;
}

export interface KnapsackStage {
  /** Índice del objeto que decide esta etapa. */
  readonly item: number;
  readonly rows: KnapsackRow[];
}

export interface KnapsackResult {
  readonly value: Fraction;
  readonly weight: Fraction;
  readonly selected: number[];
  readonly units: number[];
  readonly stages: KnapsackStage[];
  /** Etapas en el orden en que se resolvieron (la última primero). */
  readonly order: number[];
  readonly messages: string[];
}

export interface StagecoachArc {
  readonly from: string;
  readonly to: string;
  readonly cost: Fraction;
}

export interface StagecoachProblem {
  readonly title: string | null;
  /** Estados de cada etapa, o null para deducirlos de los arcos. */
  readonly stages: string[][] | null;
  readonly arcs: StagecoachArc[];
  readonly sense?: "min" | "max";
}

export interface StagecoachCandidate {
  readonly next: string;
  readonly cost: Fraction;
  readonly total: Fraction;
}

export interface StagecoachRow {
  readonly state: string;
  readonly candidates: StagecoachCandidate[];
  /** Valor óptimo desde el estado. Vale 0 con `decision` null cuando el estado no tiene salida. */
  readonly best: Fraction;
  readonly decision: string | null;
}

export interface StagecoachTable {
  /** Número de etapa desde 1. */
  readonly stage: number;
  readonly rows: StagecoachRow[];
}

export interface StagecoachResult {
  readonly status: "optimal" | "infeasible";
  readonly sense: "min" | "max";
  readonly stagesUsed: string[][];
  readonly tables: StagecoachTable[];
  readonly f: Record<string, Fraction>;
  readonly decisions: Record<string, string>;
  readonly path: string[];
  readonly cost: Fraction | null;
  readonly messages: string[];
}
