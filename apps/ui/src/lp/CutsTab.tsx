// SPDX-License-Identifier: GPL-3.0-or-later
// Pestaña Cortes: iteraciones de los cortes de Gomory, navegables, con el tableau final de cada relajación.
import { useState } from "react";
import { cutText, type GomoryResult } from "@libreio/core";
import { t } from "../i18n";
import { makeFormatter, type NumberFormat } from "../common/numberFormat";
import type { Solved } from "./LPModule";
import { TableauView } from "./TableauTab";

interface CutsTabProps {
  readonly solved: Solved;
  readonly gomory: GomoryResult;
  readonly numberFormat: NumberFormat;
}

export function CutsTab({ solved, gomory, numberFormat }: CutsTabProps) {
  const number = makeFormatter(numberFormat);
  const [index, setIndex] = useState(0);
  const iterations = gomory.iterations;
  const current = iterations[Math.min(index, iterations.length - 1)];
  const isMin = solved.model.sense === "min";
  const finalTableau = current
    ? current.lp.trace[current.lp.trace.length - 1]?.tableau
    : undefined;
  return (
    <div className="cuts-tab" data-testid="cuts-tab">
      <p className="hint">{gomory.messages.join(" ")}</p>
      <div className="table-scroll">
        <table className="data-table numeric" data-testid="cuts-iterations">
          <thead>
            <tr>
              <th>{t("cuts.iteration")}</th>
              <th>{t("cuts.relaxation")}</th>
              <th>{t("cuts.solution")}</th>
              <th>{t("cuts.integer")}</th>
              <th>{t("cuts.cut")}</th>
              <th>{t("cuts.source")}</th>
            </tr>
          </thead>
          <tbody>
            {iterations.map((it, i) => (
              <tr
                key={it.index}
                className={i === index ? "critical-row" : ""}
                onClick={() => setIndex(i)}
              >
                <td>{it.index}</td>
                <td>
                  {it.lp.solution ? number(it.lp.solution.objective) : "-"}
                </td>
                <td className="text">
                  {it.solution
                    .map((v) => `${v.name} = ${number(v.value)}`)
                    .join(", ")}
                </td>
                <td className="text">
                  {it.integer ? t("cuts.yes") : t("cuts.no")}
                </td>
                <td className="text">
                  {it.cut
                    ? `${t("cuts.one")} ${it.cut.index}: ${cutText(solved.model, it.cut, number)}`
                    : t("cuts.none")}
                </td>
                <td className="text">
                  {it.cut
                    ? `${it.cut.sourceVariable}: ${it.cut.tableauRow.names.map((name, k) => `${number(it.cut!.tableauRow.coefficients[k]!)} ${name}`).join(" + ")} >= ${number(it.cut.tableauRow.rhs)}`
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tableau-controls">
        <div className="toolbar">
          <button
            type="button"
            className="secondary"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            data-testid="cuts-prev"
          >
            {t("tableau.prev")}
          </button>
          <span className="position" data-testid="cuts-position">
            {t("cuts.iteration")} {Math.min(index, iterations.length - 1)}{" "}
            {t("tableau.of")} {Math.max(0, iterations.length - 1)}
          </span>
          <button
            type="button"
            className="secondary"
            disabled={index >= iterations.length - 1}
            onClick={() =>
              setIndex((i) => Math.min(iterations.length - 1, i + 1))
            }
            data-testid="cuts-next"
          >
            {t("tableau.next")}
          </button>
        </div>
      </div>
      {finalTableau && (
        <>
          <h3>
            {t("cuts.tableau")} {current!.index}
          </h3>
          <TableauView
            tableau={finalTableau}
            step={null}
            number={number}
            isMin={isMin}
          />
        </>
      )}
      <h3>{t("cuts.list")}</h3>
      <ol className="step-list" data-testid="cuts-list">
        {gomory.cuts.map((cut) => (
          <li key={cut.index}>
            {cutText(solved.model, cut, number)} ({cut.sourceVariable})
          </li>
        ))}
        {gomory.cuts.length === 0 && <li>{t("cuts.none")}</li>}
      </ol>
    </div>
  );
}
