// SPDX-License-Identifier: GPL-3.0-or-later
// Resultados de transporte: tableau de cada iteración de MODI con el ciclo resaltado, solución inicial y rangos.
import { useState } from "react";
import {
  INITIAL_METHOD_NAMES,
  type Fraction,
  type MValue,
  type TransportIteration,
  type TransportResult,
} from "@libreio/core";
import { t } from "../i18n";
import { formatExtended } from "../common/numberFormat";

interface TransportTableauProps {
  readonly result: TransportResult;
  readonly iteration: TransportIteration;
  readonly number: (f: Fraction) => string;
}

export function TransportTableau({
  result,
  iteration,
  number,
}: TransportTableauProps) {
  const p = result.problem;
  const fmt = (v: MValue) => v.format(number);
  const cycleAt = (i: number, j: number) =>
    iteration.cycle?.find((c) => c.i === i && c.j === j) ?? null;
  const isEntering = (i: number, j: number) =>
    iteration.entering !== null &&
    iteration.entering.i === i &&
    iteration.entering.j === j;
  const isLeaving = (i: number, j: number) =>
    iteration.leaving !== null &&
    iteration.leaving.i === i &&
    iteration.leaving.j === j;
  return (
    <div className="table-scroll">
      <table
        className="data-table transport-tableau"
        data-testid="transport-tableau"
      >
        <thead>
          <tr>
            <th />
            {p.destinations.map((d, j) => (
              <th key={j}>
                {d}
                <div className="potential">v = {fmt(iteration.v[j]!)}</div>
              </th>
            ))}
            <th>{t("transport.supply")}</th>
          </tr>
        </thead>
        <tbody>
          {p.sources.map((s, i) => (
            <tr key={i}>
              <th scope="row">
                {s}
                <div className="potential">u = {fmt(iteration.u[i]!)}</div>
              </th>
              {p.destinations.map((_, j) => {
                const value = iteration.allocation[i]![j] ?? null;
                const cycle = cycleAt(i, j);
                const cost = p.costs[i]![j] ?? null;
                const classes = [
                  "tcell",
                  value !== null ? "basic" : "",
                  cycle
                    ? cycle.sign === 1
                      ? "cycle-plus"
                      : "cycle-minus"
                    : "",
                  isEntering(i, j) ? "entering" : "",
                  isLeaving(i, j) ? "leaving" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <td
                    key={j}
                    className={classes}
                    data-testid={cycle ? "cycle-cell" : undefined}
                  >
                    <span className="tcost">
                      {cost === null ? "M" : number(cost)}
                    </span>
                    {value !== null ? (
                      <span className="talloc">{number(value)}</span>
                    ) : (
                      <span className="treduced">
                        {iteration.reducedCosts[i]![j]
                          ? fmt(iteration.reducedCosts[i]![j]!)
                          : ""}
                      </span>
                    )}
                    {cycle && (
                      <span className="tsign">
                        {cycle.sign === 1 ? "+" : "−"}
                      </span>
                    )}
                  </td>
                );
              })}
              <td className="total">{number(p.supply[i]!)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">{t("transport.demand")}</th>
            {p.demand.map((d, j) => (
              <td key={j} className="total">
                {number(d)}
              </td>
            ))}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface TransportIterationsProps {
  readonly result: TransportResult;
  readonly number: (f: Fraction) => string;
}

export function TransportIterations({
  result,
  number,
}: TransportIterationsProps) {
  const [index, setIndex] = useState(0);
  const [showInitial, setShowInitial] = useState(false);
  const iterations = result.iterations;
  const it = iterations[Math.min(index, iterations.length - 1)]!;
  return (
    <div className="transport-iterations" data-testid="transport-iterations">
      <details
        open={showInitial}
        onToggle={(e) => setShowInitial((e.target as HTMLDetailsElement).open)}
      >
        <summary>
          {t("transport.initialSteps")}:{" "}
          {INITIAL_METHOD_NAMES[result.initial.method]} (
          {t("transport.total").toLowerCase()}{" "}
          {result.initial.cost.format(number)})
        </summary>
        <ol className="step-list">
          {result.initial.steps.map((s, k) => (
            <li key={k}>
              {s.note}
              {s.rowPenalties && (
                <span className="hint">
                  {" "}
                  {t("transport.penalties")}: filas (
                  {s.rowPenalties
                    .map((p) => (p === null ? "-" : p.format(number)))
                    .join(", ")}
                  ), columnas (
                  {s
                    .columnPenalties!.map((p) =>
                      p === null ? "-" : p.format(number),
                    )
                    .join(", ")}
                  )
                </span>
              )}
            </li>
          ))}
        </ol>
      </details>
      <div className="tableau-controls">
        <div className="toolbar">
          <button
            type="button"
            className="secondary"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            data-testid="transport-prev"
          >
            {t("tableau.prev")}
          </button>
          <span className="position" data-testid="transport-position">
            {t("transport.iteration")} {index} {t("tableau.of")}{" "}
            {iterations.length - 1}
          </span>
          <button
            type="button"
            className="secondary"
            disabled={index >= iterations.length - 1}
            onClick={() =>
              setIndex((i) => Math.min(iterations.length - 1, i + 1))
            }
            data-testid="transport-next"
          >
            {t("tableau.next")}
          </button>
        </div>
        <span className="hint">
          {t("transport.total")}: {it.cost.format(number)}
        </span>
      </div>
      <TransportTableau result={result} iteration={it} number={number} />
      <p className="note" data-testid="transport-note">
        {it.note}
        {it.addedZeros.length > 0 &&
          ` Celdas básicas en cero agregadas: ${it.addedZeros.map((c) => `(${result.problem.sources[c.i]}, ${result.problem.destinations[c.j]})`).join(", ")}.`}
      </p>
    </div>
  );
}

export function TransportSensitivity({
  result,
  number,
}: TransportIterationsProps) {
  const p = result.problem;
  return (
    <div className="table-scroll" data-testid="transport-sensitivity">
      <table className="data-table numeric">
        <thead>
          <tr>
            <th>{t("transport.cell")}</th>
            <th>{t("transport.cost")}</th>
            <th>{t("sens.status")}</th>
            <th>{t("sens.reducedCost")}</th>
            <th>{t("sens.costMin")}</th>
            <th>{t("sens.costMax")}</th>
          </tr>
        </thead>
        <tbody>
          {p.sources.flatMap((s, i) =>
            p.destinations.map((d, j) => {
              const cell = result.sensitivity[i]![j]!;
              const cost = p.costs[i]![j] ?? null;
              return (
                <tr key={`${i}-${j}`}>
                  <th scope="row">
                    {s}, {d}
                  </th>
                  <td>{cost === null ? "M" : number(cost)}</td>
                  <td className="text">
                    {cell.basic ? t("sens.basic") : t("sens.nonBasic")}
                  </td>
                  <td>
                    {cell.reducedCost ? cell.reducedCost.format(number) : "-"}
                  </td>
                  <td>{formatExtended(cell.min, number)}</td>
                  <td>{formatExtended(cell.max, number)}</td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}
