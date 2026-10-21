// SPDX-License-Identifier: GPL-3.0-or-later
// Formulación del problema dual y su solución a partir de los precios sombra del primal.
import { Fraction } from "../rational/Fraction";
import {
  INFINITY,
  NEG_INFINITY,
  finite,
  type Extended,
} from "../rational/Extended";
import type { LPModel, Relation, Variable } from "../parser/model";
import type { Sensitivity } from "./sensitivity";
import type { VariableValue } from "./solveLP";

export interface DualResult {
  /** El dual como modelo: variables Y1..Ym y función objetivo W. */
  readonly model: LPModel;
  readonly values: VariableValue[];
  readonly objective: Fraction;
  readonly messages: string[];
}

function dualVariableBounds(
  primalSense: "max" | "min",
  relation: Relation,
): { lower: Extended; upper: Extended } {
  if (relation === "=") {
    return { lower: NEG_INFINITY, upper: INFINITY };
  }
  const nonNegative =
    primalSense === "max" ? relation === "<=" : relation === ">=";
  return nonNegative
    ? { lower: finite(Fraction.ZERO), upper: INFINITY }
    : { lower: NEG_INFINITY, upper: finite(Fraction.ZERO) };
}

export function formulateDual(model: LPModel): LPModel {
  const m = model.constraints.length;
  const dualSense = model.sense === "max" ? "min" : "max";
  const variables: Variable[] = model.constraints.map((c, i) => ({
    name: `Y${i + 1}`,
    ...dualVariableBounds(model.sense, c.relation),
    kind: "continuous",
  }));
  const objective = model.constraints.map((c) => c.rhs);
  const constraints = model.variables.map((v, j) => {
    const coefficients = model.constraints.map((c) => c.coefficients[j]!);
    const free = !v.lower.finite;
    const relation: Relation = free ? "=" : model.sense === "max" ? ">=" : "<=";
    return {
      label: v.name,
      row: j + 2,
      coefficients,
      relation,
      rhs: model.objective[j]!,
    };
  });
  void m;
  return {
    title: model.title === null ? "Dual" : `Dual de ${model.title}`,
    sense: dualSense,
    variables,
    objective,
    constraints,
  };
}

export function dualSolution(
  dualModel: LPModel,
  sensitivity: Sensitivity,
  primalObjective: Fraction,
): DualResult {
  const messages: string[] = [];
  const values = sensitivity.constraints.map((c, i) => ({
    name: dualModel.variables[i]!.name,
    value: c.shadowPrice,
  }));
  return { model: dualModel, values, objective: primalObjective, messages };
}
