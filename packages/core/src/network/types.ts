// SPDX-License-Identifier: GPL-3.0-or-later
import type { Fraction } from "../rational/Fraction";

export interface Arc {
  readonly from: string;
  readonly to: string;
  readonly weight: Fraction;
}

export interface NetworkProblem {
  readonly title: string | null;
  /** Si es falso, cada arco se recorre en los dos sentidos. */
  readonly directed: boolean;
  readonly nodes: string[];
  readonly arcs: Arc[];
}

export interface Label {
  readonly distance: Fraction | null;
  readonly predecessor: string | null;
  readonly permanent: boolean;
}

export interface DijkstraStep {
  readonly index: number;
  readonly settled: string;
  readonly distance: Fraction;
  readonly labels: Record<string, Label>;
  readonly note: string;
}

export interface ShortestPathResult {
  readonly source: string;
  readonly target: string;
  readonly status: "optimal" | "unreachable";
  readonly distance: Fraction | null;
  readonly path: string[];
  readonly pathArcs: Arc[];
  readonly labels: Record<string, Label>;
  readonly steps: DijkstraStep[];
  readonly messages: string[];
}

export interface ArcFlow {
  readonly from: string;
  readonly to: string;
  readonly capacity: Fraction;
  readonly flow: Fraction;
}

export interface AugmentingPath {
  readonly index: number;
  readonly path: string[];
  readonly bottleneck: Fraction;
  readonly totalAfter: Fraction;
  readonly note: string;
}

export interface MaxFlowResult {
  readonly source: string;
  readonly sink: string;
  readonly value: Fraction;
  readonly flows: ArcFlow[];
  readonly augmentingPaths: AugmentingPath[];
  readonly minCut: {
    readonly sourceSide: string[];
    readonly sinkSide: string[];
    readonly arcs: Arc[];
    readonly capacity: Fraction;
  };
  readonly messages: string[];
}

export interface SpanningTreeStep {
  readonly index: number;
  readonly edge: Arc;
  readonly accepted: boolean;
  readonly note: string;
  /** Nodos ya conectados después del paso (Prim) o componentes (Kruskal). */
  readonly treeNodes: string[];
}

export interface SpanningTreeResult {
  readonly method: "kruskal" | "prim";
  readonly edges: Arc[];
  readonly cost: Fraction;
  readonly connected: boolean;
  readonly steps: SpanningTreeStep[];
  readonly messages: string[];
}

export interface TspNode {
  readonly id: number;
  readonly parent: number | null;
  readonly path: string[];
  readonly cost: Fraction;
  readonly bound: Fraction;
  readonly pruned: boolean;
  readonly complete: boolean;
  readonly note: string;
}

export interface HeuristicStep {
  readonly note: string;
  readonly tour: string[];
  readonly cost: Fraction;
}

export interface TourResult {
  readonly tour: string[];
  readonly cost: Fraction;
  readonly steps: HeuristicStep[];
}

export interface TspResult {
  readonly start: string;
  readonly status: "optimal" | "infeasible";
  readonly optimal: {
    readonly tour: string[];
    readonly cost: Fraction;
    readonly nodes: TspNode[];
    readonly explored: number;
  };
  readonly nearestNeighbor: TourResult;
  readonly cheapestInsertion: TourResult;
  readonly messages: string[];
}
