// SPDX-License-Identifier: GPL-3.0-or-later
import type { StringKey } from "../i18n";

export type ModuleKey =
  | "lp"
  | "ilp"
  | "transport"
  | "network"
  | "pert"
  | "queueing"
  | "inventory"
  | "decision"
  | "dp"
  | "markov";

export type ViewKey = ModuleKey | "about";

export interface ModuleEntry {
  readonly key: ModuleKey;
  readonly label: StringKey;
  readonly available: boolean;
}

export const modules: readonly ModuleEntry[] = [
  { key: "lp", label: "module.lp", available: true },
  { key: "ilp", label: "module.ilp", available: false },
  { key: "transport", label: "module.transport", available: false },
  { key: "network", label: "module.network", available: false },
  { key: "pert", label: "module.pert", available: false },
  { key: "queueing", label: "module.queueing", available: false },
  { key: "inventory", label: "module.inventory", available: false },
  { key: "decision", label: "module.decision", available: false },
  { key: "dp", label: "module.dp", available: false },
  { key: "markov", label: "module.markov", available: false },
];
