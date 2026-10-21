// SPDX-License-Identifier: GPL-3.0-or-later
import type { Fraction } from "../rational/Fraction";

export type QueueKind =
  "MM1" | "MMs" | "MM1K" | "MMsK" | "MMsN" | "MG1" | "MD1" | "MEk1";

export interface QueueModel {
  readonly kind: QueueKind;
  /** Tasa de llegadas. */
  readonly lambda: Fraction;
  /** Tasa de servicio por servidor. */
  readonly mu: Fraction;
  readonly servers?: number;
  /** Capacidad total del sistema (en cola más en servicio). */
  readonly capacity?: number;
  /** Tamaño de la población en M/M/s con población finita. */
  readonly population?: number;
  /** Varianza del tiempo de servicio en M/G/1. */
  readonly serviceVariance?: Fraction;
  /** Fases de Erlang en M/Ek/1. */
  readonly phases?: number;
  readonly title?: string | null;
}

export interface PnRow {
  readonly n: number;
  readonly probability: Fraction;
  readonly cumulative: Fraction;
}

export interface QueueResult {
  readonly model: QueueModel;
  readonly stable: boolean;
  readonly lambda: Fraction;
  readonly mu: Fraction;
  readonly servers: number;
  readonly lambdaEff: Fraction;
  readonly rho: Fraction;
  readonly L: Fraction;
  readonly Lq: Fraction;
  readonly W: Fraction;
  readonly Wq: Fraction;
  readonly P0: Fraction;
  readonly probabilityOfWaiting: Fraction;
  readonly Pn: (n: number) => Fraction;
  readonly pnTable: PnRow[];
  readonly messages: string[];
}

export interface QueueCosts {
  readonly serverCost: Fraction;
  readonly waitingCost: Fraction;
  /** Costo de espera sobre los clientes en el sistema (L) o solo en cola (Lq). */
  readonly basis?: "system" | "queue";
}

export interface QueueCostResult {
  readonly servers: number;
  readonly serviceCost: Fraction;
  readonly waitingCostTotal: Fraction;
  readonly total: Fraction;
  readonly basis: "system" | "queue";
}

export interface CapacityRow {
  readonly value: Fraction;
  readonly model: QueueModel;
  readonly result: QueueResult;
  readonly cost: QueueCostResult | null;
}

export interface CapacityAnalysis {
  readonly vary: "servers" | "lambda" | "mu" | "capacity";
  readonly rows: CapacityRow[];
  readonly best: number | null;
  readonly messages: string[];
}
