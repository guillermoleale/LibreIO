// SPDX-License-Identifier: GPL-3.0-or-later
import type { Fraction } from "../rational/Fraction";

export interface Activity {
  readonly id: string;
  readonly name: string | null;
  readonly predecessors: string[];
  /** Duración normal (o esperada si se dan las tres estimaciones). */
  readonly duration: Fraction;
  readonly optimistic?: Fraction;
  readonly mostLikely?: Fraction;
  readonly pessimistic?: Fraction;
  readonly normalCost?: Fraction;
  readonly crashDuration?: Fraction;
  readonly crashCost?: Fraction;
  readonly crashCostPerUnit?: Fraction;
}

export interface ProjectProblem {
  readonly title: string | null;
  readonly activities: Activity[];
}

export interface ActivityTimes {
  readonly id: string;
  readonly name: string | null;
  readonly duration: Fraction;
  readonly es: Fraction;
  readonly ef: Fraction;
  readonly ls: Fraction;
  readonly lf: Fraction;
  readonly totalSlack: Fraction;
  readonly freeSlack: Fraction;
  readonly critical: boolean;
  readonly predecessors: string[];
  readonly successors: string[];
}

export interface CpmResult {
  readonly status: "ok" | "cycle";
  readonly duration: Fraction;
  readonly activities: ActivityTimes[];
  readonly criticalPaths: string[][];
  /** Orden topológico usado en la pasada hacia adelante. */
  readonly order: string[];
  readonly messages: string[];
}

export interface PertActivity {
  readonly id: string;
  readonly optimistic: Fraction;
  readonly mostLikely: Fraction;
  readonly pessimistic: Fraction;
  readonly expected: Fraction;
  readonly variance: Fraction;
}

export interface PertResult {
  readonly cpm: CpmResult;
  readonly activities: PertActivity[];
  readonly expectedDuration: Fraction;
  readonly criticalPath: string[];
  readonly variance: Fraction;
  readonly standardDeviation: number;
  readonly probabilityByDate: (date: number | Fraction) => number;
  readonly dateForProbability: (probability: number) => number;
  readonly messages: string[];
}

export interface CrashPoint {
  readonly duration: Fraction;
  readonly cost: Fraction;
  readonly crashed: Array<{
    readonly id: string;
    readonly amount: Fraction;
    readonly duration: Fraction;
  }>;
  readonly criticalPaths: string[][];
}

export interface CrashTarget extends CrashPoint {
  readonly feasible: boolean;
  readonly requested: Fraction;
}

export interface CrashingResult {
  readonly normalDuration: Fraction;
  readonly minimumDuration: Fraction;
  readonly curve: CrashPoint[];
  readonly target: CrashTarget | null;
  readonly crashable: Array<{
    readonly id: string;
    readonly maxReduction: Fraction;
    readonly costPerUnit: Fraction;
  }>;
  readonly messages: string[];
}
