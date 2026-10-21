// SPDX-License-Identifier: GPL-3.0-or-later
// Análisis paramétrico: lado derecho de una fila o coeficiente de una variable, con tramos, quiebres y gráfico de Z.
import { useMemo, useState } from "react";
import {
  Fraction,
  parametricCost,
  parametricRhs,
  reportClassicParametric,
  reportParametric,
  type ParametricResult,
} from "@libreio/core";
import { t } from "../i18n";
import {
  DECIMALS,
  makeFormatter,
  type NumberFormat,
} from "../common/numberFormat";
import type { Solved } from "./LPModule";

interface ParametricTabProps {
  readonly solved: Solved;
  readonly numberFormat: NumberFormat;
}

const W = 640;
const H = 300;
const PAD = 48;

function parseOr(text: string, fallback: Fraction): Fraction {
  try {
    return Fraction.parse(text);
  } catch {
    return fallback;
  }
}

export function ParametricTab({ solved, numberFormat }: ParametricTabProps) {
  const number = makeFormatter(numberFormat);
  const { model } = solved;
  const [kind, setKind] = useState<"rhs" | "cost">("rhs");
  const [target, setTarget] = useState(0);
  const current =
    kind === "rhs"
      ? (model.constraints[target]?.rhs ?? Fraction.ZERO)
      : (model.objective[target] ?? Fraction.ZERO);
  const [from, setFrom] = useState(() => "0");
  const [to, setTo] = useState(() => current.mul(Fraction.of(2)).toString());
  const [classic, setClassic] = useState(false);
  const [result, setResult] = useState<ParametricResult | null>(null);

  const select = (nextKind: "rhs" | "cost", nextTarget: number) => {
    setKind(nextKind);
    setTarget(nextTarget);
    const value =
      nextKind === "rhs"
        ? (model.constraints[nextTarget]?.rhs ?? Fraction.ZERO)
        : (model.objective[nextTarget] ?? Fraction.ZERO);
    setFrom(value.isNegative() ? value.mul(Fraction.of(2)).toString() : "0");
    setTo(value.isZero() ? "10" : value.abs().mul(Fraction.of(2)).toString());
    setResult(null);
  };

  const run = () => {
    const a = parseOr(from, Fraction.ZERO);
    const b = parseOr(to, current);
    const lo = Fraction.min(a, b);
    const hi = Fraction.max(a, b);
    setResult(
      kind === "rhs"
        ? parametricRhs(model, target, lo, hi, {
            method: solved.result.method,
            rule: solved.result.rule,
          })
        : parametricCost(model, target, lo, hi, {
            method: solved.result.method,
            rule: solved.result.rule,
          }),
    );
  };

  const chart = useMemo(() => {
    if (!result || result.segments.length === 0) {
      return null;
    }
    const xs = [result.from.toNumber(), result.to.toNumber()];
    const zs = result.segments.flatMap((s) => [
      s.zFrom.toNumber(),
      s.zTo.toNumber(),
    ]);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const zMin = Math.min(...zs);
    const zMax = Math.max(...zs);
    const spanX = xMax - xMin || 1;
    const spanZ = zMax - zMin || 1;
    const sx = (x: number) => PAD + ((x - xMin) / spanX) * (W - 2 * PAD);
    const sy = (z: number) => H - PAD - ((z - zMin) / spanZ) * (H - 2 * PAD);
    return { xMin, xMax, zMin, zMax, sx, sy };
  }, [result]);

  const report = useMemo(() => {
    if (!result) {
      return "";
    }
    return classic
      ? reportClassicParametric(model, result)
      : reportParametric(model, result, { numberFormat, decimals: DECIMALS });
  }, [result, classic, model, numberFormat]);

  return (
    <div className="parametric-tab" data-testid="parametric-tab">
      <div className="options">
        <label>
          {t("param.kind")}
          <select
            value={kind}
            onChange={(e) => select(e.target.value as "rhs" | "cost", 0)}
            data-testid="param-kind"
          >
            <option value="rhs">{t("param.rhs")}</option>
            <option value="cost">{t("param.cost")}</option>
          </select>
        </label>
        <label>
          <select
            value={target}
            onChange={(e) => select(kind, Number(e.target.value))}
            data-testid="param-target"
          >
            {kind === "rhs"
              ? model.constraints.map((c, i) => (
                  <option key={i} value={i}>
                    {c.label ?? c.row}
                  </option>
                ))
              : model.variables.map((v, i) => (
                  <option key={i} value={i}>
                    {v.name}
                  </option>
                ))}
          </select>
        </label>
        <label>
          {t("param.from")}
          <input
            className="short"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            data-testid="param-from"
          />
        </label>
        <label>
          {t("param.to")}
          <input
            className="short"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            data-testid="param-to"
          />
        </label>
        <button
          type="button"
          className="primary"
          onClick={run}
          data-testid="param-run"
        >
          {t("param.run")}
        </button>
      </div>
      {result && result.status !== "ok" && (
        <p className="note note-warning">{result.messages.join(" ")}</p>
      )}
      {result && result.status === "ok" && (
        <>
          {chart && (
            <svg
              className="chart"
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={t("param.chart")}
              data-testid="param-chart"
            >
              <rect x={0} y={0} width={W} height={H} fill="var(--surface)" />
              <line
                x1={PAD}
                y1={H - PAD}
                x2={W - PAD}
                y2={H - PAD}
                stroke="var(--muted)"
              />
              <line
                x1={PAD}
                y1={PAD}
                x2={PAD}
                y2={H - PAD}
                stroke="var(--muted)"
              />
              {result.segments.map((s, i) => (
                <line
                  key={i}
                  x1={chart.sx(s.from.toNumber())}
                  y1={chart.sy(s.zFrom.toNumber())}
                  x2={chart.sx(s.to.toNumber())}
                  y2={chart.sy(s.zTo.toNumber())}
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                />
              ))}
              {result.breakpoints.map((b, i) => (
                <g key={i}>
                  <circle
                    cx={chart.sx(b.value.toNumber())}
                    cy={chart.sy(b.z.toNumber())}
                    r={5}
                    fill="var(--warn)"
                    stroke="var(--text)"
                  />
                  <text
                    x={chart.sx(b.value.toNumber())}
                    y={chart.sy(b.z.toNumber()) - 10}
                    fontSize={12}
                    textAnchor="middle"
                    fill="var(--text)"
                  >
                    ({number(b.value)}, {number(b.z)})
                  </text>
                </g>
              ))}
              <line
                x1={chart.sx(result.current.toNumber())}
                y1={PAD}
                x2={chart.sx(result.current.toNumber())}
                y2={H - PAD}
                stroke="var(--muted)"
                strokeDasharray="4 4"
              />
              <text x={PAD} y={H - PAD + 18} fontSize={12} fill="var(--muted)">
                {number(result.from)}
              </text>
              <text
                x={W - PAD}
                y={H - PAD + 18}
                fontSize={12}
                textAnchor="end"
                fill="var(--muted)"
              >
                {number(result.to)}
              </text>
              <text
                x={PAD - 6}
                y={H - PAD}
                fontSize={12}
                textAnchor="end"
                fill="var(--muted)"
              >
                {chart.zMin.toFixed(2).replace(/\.00$/, "")}
              </text>
              <text
                x={PAD - 6}
                y={PAD + 4}
                fontSize={12}
                textAnchor="end"
                fill="var(--muted)"
              >
                {chart.zMax.toFixed(2).replace(/\.00$/, "")}
              </text>
              <text
                x={W / 2}
                y={H - 8}
                fontSize={13}
                textAnchor="middle"
                fill="var(--text)"
              >
                {result.target}
              </text>
              <text x={12} y={PAD - 14} fontSize={13} fill="var(--text)">
                Z
              </text>
            </svg>
          )}
          <h3>{t("param.segments")}</h3>
          <div className="table-scroll">
            <table className="data-table numeric" data-testid="param-segments">
              <thead>
                <tr>
                  <th>{t("param.from")}</th>
                  <th>{t("param.to")}</th>
                  <th>Z</th>
                  <th>Base</th>
                  <th>{t("tree.solution")}</th>
                </tr>
              </thead>
              <tbody>
                {result.segments.map((s, i) => (
                  <tr key={i}>
                    <td>{number(s.from)}</td>
                    <td>{number(s.to)}</td>
                    <td className="text">
                      Z = {number(s.slope)} p{" "}
                      {s.intercept.isNegative() ? "-" : "+"}{" "}
                      {number(s.intercept.abs())}
                    </td>
                    <td className="text">{s.basis.join(", ")}</td>
                    <td className="text">
                      {s.solutionFrom
                        .map((v) => `${v.name} = ${number(v.value)}`)
                        .join(", ")}
                      {kind === "rhs"
                        ? ` → ${s.solutionTo.map((v) => `${v.name} = ${number(v.value)}`).join(", ")}`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>{t("param.breakpoints")}</h3>
          <div className="table-scroll">
            <table
              className="data-table numeric"
              data-testid="param-breakpoints"
            >
              <thead>
                <tr>
                  <th>
                    {result.kind === "rhs" ? t("sens.rhs") : t("sens.cost")}
                  </th>
                  <th>Z</th>
                  <th>{t("tableau.leaving")}</th>
                  <th>{t("tableau.entering")}</th>
                  <th>{kind === "rhs" ? t("sens.shadow") : t("sens.value")}</th>
                </tr>
              </thead>
              <tbody>
                {result.breakpoints.map((b, i) => (
                  <tr key={i}>
                    <td>{number(b.value)}</td>
                    <td>{number(b.z)}</td>
                    <td className="text">{b.leaving ?? "-"}</td>
                    <td className="text">{b.entering ?? "-"}</td>
                    <td>{number(b.rateBefore)}</td>
                  </tr>
                ))}
                {result.breakpoints.length === 0 && (
                  <tr>
                    <td className="text" colSpan={5}>
                      -
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="report-header">
            <label className="switch">
              <input
                type="checkbox"
                checked={classic}
                onChange={(e) => setClassic(e.target.checked)}
              />
              {t("param.classic")}
            </label>
          </div>
          <pre className="report" data-testid="param-report">
            {report}
          </pre>
        </>
      )}
    </div>
  );
}
