// SPDX-License-Identifier: GPL-3.0-or-later
// Tableau navegable iteración por iteración y modo guiado con elección de la variable que entra.
import { useMemo, useState } from "react";
import {
  analyzeTableau,
  finishPhase,
  initialTableau,
  isBasic,
  manualPivot,
  reportClassicTableau,
  type Fraction,
  type Iteration,
  type Phase,
  type Tableau,
} from "@libreio/core";
import { t } from "../i18n";
import { downloadText } from "../common/download";
import { makeFormatter, type NumberFormat } from "../common/numberFormat";
import type { Solved } from "./LPModule";

interface TableauTabProps {
  readonly solved: Solved;
  readonly numberFormat: NumberFormat;
}

interface GuidedStep {
  readonly tableau: Tableau;
  readonly step: Iteration | null;
  readonly message: string | null;
  readonly kind: "info" | "warning" | "error";
}

function phaseLabel(phase: Phase): string {
  if (phase === "phase1") {
    return t("tableau.phase1");
  }
  return phase === "phase2" ? t("tableau.phase2") : t("tableau.bigM");
}

interface TableauViewProps {
  readonly tableau: Tableau;
  readonly step: Iteration | null;
  readonly number: (f: Fraction) => string;
  readonly isMin: boolean;
}

export function TableauView({
  tableau,
  step,
  number,
  isMin,
}: TableauViewProps) {
  const entering = step?.entering ?? null;
  const pivotRow = step?.pivotRow ?? null;
  const ratios = step?.ratios ?? null;
  const zLabel = tableau.phase === "phase1" ? "W" : isMin ? "-Z" : "Z";
  return (
    <div className="table-scroll">
      <table className="data-table numeric tableau" data-testid="tableau-table">
        <thead>
          <tr>
            <th>{t("tableau.base")}</th>
            {tableau.columns.map((c, j) => (
              <th key={c.name} className={j === entering ? "col-entering" : ""}>
                {c.name}
              </th>
            ))}
            <th>{t("tableau.rhs")}</th>
            <th>{t("tableau.ratio")}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="objective-row">
            <th scope="row">{zLabel}</th>
            {tableau.objectiveRow.map((v, j) => (
              <td key={j} className={j === entering ? "col-entering" : ""}>
                {v.format(number)}
              </td>
            ))}
            <td>{tableau.objectiveValue.format(number)}</td>
            <td />
          </tr>
          {tableau.rows.map((row, i) => (
            <tr key={i} className={i === pivotRow ? "row-leaving" : ""}>
              <th scope="row">{tableau.columns[tableau.basis[i]!]!.name}</th>
              {row.map((a, j) => (
                <td
                  key={j}
                  className={`${j === entering ? "col-entering" : ""}${i === pivotRow && j === entering ? " pivot" : ""}`}
                  data-testid={
                    i === pivotRow && j === entering ? "pivot-cell" : undefined
                  }
                >
                  {number(a)}
                </td>
              ))}
              <td>{number(tableau.rhs[i]!)}</td>
              <td className={i === pivotRow ? "ratio-min" : ""}>
                {ratios ? (ratios[i] === null ? "–" : number(ratios[i]!)) : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableauTab({ solved, numberFormat }: TableauTabProps) {
  const number = makeFormatter(numberFormat);
  const { result, model } = solved;
  const trace = result.trace;
  const isMin = model.sense === "min";
  const [index, setIndex] = useState(0);
  const [guided, setGuided] = useState(false);
  const [guidedSteps, setGuidedSteps] = useState<GuidedStep[]>(() => [
    {
      tableau: initialTableau(result.standardForm, result.method),
      step: null,
      message: null,
      kind: "info",
    },
  ]);
  const [enteringName, setEnteringName] = useState("");
  const [leavingName, setLeavingName] = useState("");

  const current = trace[Math.min(index, trace.length - 1)]!;
  const guidedCurrent = guidedSteps[guidedSteps.length - 1]!;
  const guidedTableau = guidedCurrent.tableau;
  const candidates = useMemo(
    () =>
      guidedTableau.columns
        .map((c, j) => ({ c, j }))
        .filter(
          ({ c, j }) => c.kind !== "artificial" && !isBasic(guidedTableau, j),
        )
        .map(({ c }) => c.name),
    [guidedTableau],
  );
  const basics = useMemo(
    () => guidedTableau.basis.map((col) => guidedTableau.columns[col]!.name),
    [guidedTableau],
  );
  const guidedOptimal =
    analyzeTableau(guidedTableau, "dantzig").kind === "optimal";

  const doPivot = () => {
    if (enteringName === "") {
      return;
    }
    const outcome = manualPivot(
      guidedTableau,
      enteringName,
      leavingName === "" ? undefined : leavingName,
    );
    if (!outcome.ok) {
      setGuidedSteps((steps) => [
        ...steps.slice(0, -1),
        { ...guidedCurrent, message: outcome.error, kind: "error" },
      ]);
      return;
    }
    setGuidedSteps((steps) => [
      ...steps.slice(0, -1),
      { ...guidedCurrent, step: outcome.step, message: null, kind: "info" },
      {
        tableau: outcome.next,
        step: null,
        message: outcome.warning
          ? `${outcome.warning} ${outcome.step.note}`
          : outcome.step.note,
        kind: outcome.warning ? "warning" : "info",
      },
    ]);
    setEnteringName("");
    setLeavingName("");
  };

  const closePhase = () => {
    const outcome = finishPhase(guidedTableau, result.standardForm);
    let message: string;
    let kind: GuidedStep["kind"] = "info";
    if (outcome.kind === "phase2") {
      setGuidedSteps((steps) => [
        ...steps.slice(0, -1),
        { ...guidedCurrent, message: t("tableau.phaseDone"), kind: "info" },
        { tableau: outcome.tableau, step: null, message: null, kind: "info" },
      ]);
      return;
    }
    if (outcome.kind === "optimal") {
      message = `${t("tableau.optimalReached")} Z = ${number(outcome.objective)}.`;
    } else if (outcome.kind === "infeasible") {
      message = t("tableau.infeasible");
      kind = "warning";
    } else {
      message = t("tableau.notOptimal");
      kind = "warning";
    }
    setGuidedSteps((steps) => [
      ...steps.slice(0, -1),
      { ...guidedCurrent, message, kind },
    ]);
  };

  const resetGuided = () => {
    setGuidedSteps([
      {
        tableau: initialTableau(result.standardForm, result.method),
        step: null,
        message: null,
        kind: "info",
      },
    ]);
    setEnteringName("");
    setLeavingName("");
  };

  const exportCurrent = () => {
    const tableau = guided ? guidedTableau : current.tableau;
    void downloadText(
      reportClassicTableau(tableau),
      "tableau.txt",
      "txt",
      "Texto",
    );
  };

  return (
    <div className="tableau-tab" data-testid="tableau-tab">
      <div className="tableau-controls">
        <label className="switch">
          <input
            type="checkbox"
            checked={guided}
            onChange={(e) => setGuided(e.target.checked)}
            data-testid="guided-toggle"
          />
          {t("tableau.guided")}
        </label>
        {!guided && (
          <div className="toolbar" role="group" aria-label={t("tab.tableau")}>
            <button
              type="button"
              className="secondary"
              onClick={() => setIndex(0)}
              disabled={index === 0}
              data-testid="tableau-first"
            >
              {t("tableau.first")}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              data-testid="tableau-prev"
            >
              {t("tableau.prev")}
            </button>
            <span className="position" data-testid="tableau-position">
              {t("tableau.position")} {index} {t("tableau.of")}{" "}
              {trace.length - 1}
              {index === 0 ? ` (${t("tableau.initial")})` : ""} ·{" "}
              {phaseLabel(current.phase)}
            </span>
            <button
              type="button"
              className="secondary"
              onClick={() => setIndex((i) => Math.min(trace.length - 1, i + 1))}
              disabled={index >= trace.length - 1}
              data-testid="tableau-next"
            >
              {t("tableau.next")}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setIndex(trace.length - 1)}
              disabled={index >= trace.length - 1}
              data-testid="tableau-last"
            >
              {t("tableau.last")}
            </button>
          </div>
        )}
        <button
          type="button"
          className="secondary"
          onClick={exportCurrent}
          data-testid="tableau-export"
        >
          {t("tableau.export")}
        </button>
      </div>
      {!guided ? (
        <>
          <TableauView
            tableau={current.tableau}
            step={current}
            number={number}
            isMin={isMin}
          />
          <p className="note" data-testid="tableau-note">
            {current.note}
          </p>
        </>
      ) : (
        <div className="guided">
          <p className="hint">{t("tableau.guidedHelp")}</p>
          <p className="position">
            {t("tableau.guidedStep")} {guidedSteps.length - 1} ·{" "}
            {phaseLabel(guidedTableau.phase)}
          </p>
          <TableauView
            tableau={guidedTableau}
            step={guidedCurrent.step}
            number={number}
            isMin={isMin}
          />
          {guidedCurrent.message !== null && (
            <p
              className={`note note-${guidedCurrent.kind}`}
              role="status"
              data-testid="guided-message"
            >
              {guidedCurrent.message}
            </p>
          )}
          <div className="options">
            <label>
              {t("tableau.entering")}
              <select
                value={enteringName}
                onChange={(e) => setEnteringName(e.target.value)}
                data-testid="guided-entering"
              >
                <option value="">–</option>
                {candidates.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("tableau.leaving")}
              <select
                value={leavingName}
                onChange={(e) => setLeavingName(e.target.value)}
                data-testid="guided-leaving"
              >
                <option value="">{t("tableau.leavingAuto")}</option>
                {basics.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="primary"
              onClick={doPivot}
              disabled={enteringName === ""}
              data-testid="guided-pivot"
            >
              {t("tableau.pivot")}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={closePhase}
              disabled={!guidedOptimal}
              data-testid="guided-finish"
            >
              {t("tableau.finishPhase")}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={resetGuided}
              data-testid="guided-reset"
            >
              {t("tableau.reset")}
            </button>
          </div>
          {guidedSteps.length > 1 && (
            <ol className="guided-history">
              {guidedSteps.slice(0, -1).map((s, i) => (
                <li key={i}>{s.step ? s.step.note : s.message}</li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
