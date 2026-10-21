// SPDX-License-Identifier: GPL-3.0-or-later
// Pasos del método húngaro: matriz después de cada reducción, líneas de cobertura y ajuste.
import { useState } from "react";
import type { AssignmentResult, Fraction } from "@libreio/core";
import { t } from "../i18n";

interface HungarianStepsProps {
  readonly result: AssignmentResult;
  readonly number: (f: Fraction) => string;
}

export function HungarianSteps({ result, number }: HungarianStepsProps) {
  const [index, setIndex] = useState(result.steps.length - 1);
  const step = result.steps[Math.min(index, result.steps.length - 1)]!;
  const p = result.problem;
  const assigned = (i: number, j: number) =>
    step.assignment?.some((c) => c.i === i && c.j === j) ?? false;
  return (
    <div className="hungarian-steps" data-testid="hungarian-steps">
      <div className="tableau-controls">
        <div className="toolbar">
          <button
            type="button"
            className="secondary"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            data-testid="hungarian-prev"
          >
            {t("tableau.prev")}
          </button>
          <span className="position" data-testid="hungarian-position">
            {t("transport.step")} {index + 1} {t("tableau.of")}{" "}
            {result.steps.length}
          </span>
          <button
            type="button"
            className="secondary"
            disabled={index >= result.steps.length - 1}
            onClick={() =>
              setIndex((i) => Math.min(result.steps.length - 1, i + 1))
            }
            data-testid="hungarian-next"
          >
            {t("tableau.next")}
          </button>
        </div>
      </div>
      <div className="table-scroll">
        <table
          className="data-table numeric hungarian"
          data-testid="hungarian-matrix"
        >
          <thead>
            <tr>
              <th />
              {p.tasks.map((task, j) => (
                <th
                  key={j}
                  className={step.coveredColumns?.includes(j) ? "covered" : ""}
                >
                  {task}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.agents.map((agent, i) => (
              <tr
                key={i}
                className={step.coveredRows?.includes(i) ? "covered" : ""}
              >
                <th scope="row">{agent}</th>
                {step.matrix[i]!.map((v, j) => (
                  <td
                    key={j}
                    className={`${step.coveredColumns?.includes(j) ? "covered " : ""}${v.isZero() ? "zero " : ""}${assigned(i, j) ? "assigned" : ""}`.trim()}
                  >
                    {v.format(number)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note" data-testid="hungarian-note">
        {step.note}
      </p>
    </div>
  );
}
