// SPDX-License-Identifier: GPL-3.0-or-later
import type { Fraction } from "../rational/Fraction";
import type { Extended } from "../rational/Extended";
import type { MValue } from "../lp/MValue";

export type Sense = "min" | "max";

export interface TransportProblem {
  readonly title: string | null;
  readonly sense: Sense;
  readonly sources: string[];
  readonly destinations: string[];
  readonly supply: Fraction[];
  readonly demand: Fraction[];
  /** null marca una ruta prohibida (costo M). */
  readonly costs: Array<Array<Fraction | null>>;
}

export type InitialMethod =
  | "northwest"
  | "matrixMinimum"
  | "rowMinimum"
  | "columnMinimum"
  | "vogel"
  | "russell";

export interface Cell {
  readonly i: number;
  readonly j: number;
}

export interface InitialStep {
  readonly cell: Cell | null;
  readonly amount: Fraction | null;
  readonly note: string;
  readonly remainingSupply: Fraction[];
  readonly remainingDemand: Fraction[];
  readonly crossedRows: boolean[];
  readonly crossedColumns: boolean[];
  readonly rowPenalties?: Array<MValue | null>;
  readonly columnPenalties?: Array<MValue | null>;
  readonly rowValues?: Array<MValue | null>;
  readonly columnValues?: Array<MValue | null>;
}

export interface InitialSolution {
  readonly method: InitialMethod;
  readonly allocation: Array<Array<Fraction | null>>;
  readonly cost: MValue;
  readonly basicCount: number;
  readonly degenerate: boolean;
  readonly steps: InitialStep[];
}

export interface CycleCell extends Cell {
  readonly sign: 1 | -1;
}

export interface TransportIteration {
  readonly index: number;
  readonly allocation: Array<Array<Fraction | null>>;
  readonly u: MValue[];
  readonly v: MValue[];
  /** Costo reducido de cada celda no básica; null en las básicas. */
  readonly reducedCosts: Array<Array<MValue | null>>;
  readonly cost: MValue;
  readonly entering: Cell | null;
  readonly cycle: CycleCell[] | null;
  readonly theta: Fraction | null;
  readonly leaving: Cell | null;
  /** Celdas con asignación cero agregadas para completar la base. */
  readonly addedZeros: Cell[];
  readonly note: string;
}

export interface CostRange {
  readonly basic: boolean;
  readonly reducedCost: MValue | null;
  readonly min: Extended;
  readonly max: Extended;
}

export interface TransportResult {
  readonly original: TransportProblem;
  /** Problema balanceado que se resolvió. */
  readonly problem: TransportProblem;
  readonly balanced: {
    readonly kind: "source" | "destination";
    readonly amount: Fraction;
  } | null;
  readonly initial: InitialSolution;
  readonly iterations: TransportIteration[];
  readonly status: "optimal" | "infeasible";
  readonly allocation: Array<Array<Fraction | null>>;
  /** Costo total en el sentido original. Si tiene parte en M, usa rutas prohibidas. */
  readonly objective: MValue;
  readonly sensitivity: CostRange[][];
  readonly degenerate: boolean;
  readonly messages: string[];
}

export interface TransshipmentNode {
  readonly name: string;
  readonly supply: Fraction;
  readonly demand: Fraction;
}

export interface TransshipmentArc {
  readonly from: string;
  readonly to: string;
  readonly cost: Fraction;
}

export interface TransshipmentProblem {
  readonly title: string | null;
  readonly sense: Sense;
  readonly nodes: TransshipmentNode[];
  readonly arcs: TransshipmentArc[];
}

export interface TransshipmentResult {
  readonly problem: TransshipmentProblem;
  readonly transport: TransportResult;
  readonly buffer: Fraction;
  readonly status: "optimal" | "infeasible";
  readonly objective: Fraction;
  readonly flows: Array<{
    readonly from: string;
    readonly to: string;
    readonly value: Fraction;
  }>;
  readonly through: Array<{ readonly node: string; readonly amount: Fraction }>;
  readonly messages: string[];
}

export interface AssignmentProblem {
  readonly title: string | null;
  readonly sense: Sense;
  readonly agents: string[];
  readonly tasks: string[];
  readonly costs: Array<Array<Fraction | null>>;
}

export type HungarianStepKind =
  | "start"
  | "rowReduction"
  | "columnReduction"
  | "cover"
  | "adjust"
  | "assignment";

export interface HungarianStep {
  readonly kind: HungarianStepKind;
  readonly matrix: MValue[][];
  readonly note: string;
  readonly coveredRows?: number[];
  readonly coveredColumns?: number[];
  readonly minimum?: MValue;
  readonly assignment?: Cell[];
}

export interface AssignmentResult {
  readonly original: AssignmentProblem;
  readonly problem: AssignmentProblem;
  readonly balanced: {
    readonly kind: "agent" | "task";
    readonly amount: number;
  } | null;
  readonly status: "optimal" | "infeasible";
  readonly assignment: Array<{ readonly agent: number; readonly task: number }>;
  readonly objective: Fraction;
  readonly steps: HungarianStep[];
  readonly messages: string[];
}
