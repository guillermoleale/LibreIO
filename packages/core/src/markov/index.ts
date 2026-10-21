// SPDX-License-Identifier: GPL-3.0-or-later
export { markovChain } from "./chain";
export { parseMarkovFile, serializeMarkovFile, type MarkovFile } from "./parse";
export {
  identity,
  inverse,
  multiply,
  solve,
  vectorTimesMatrix,
  type Matrix,
} from "./linear";
export type {
  AbsorbingAnalysis,
  CommunicationClass,
  MarkovProblem,
  MarkovResult,
} from "./types";
