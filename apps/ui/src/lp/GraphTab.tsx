// SPDX-License-Identifier: GPL-3.0-or-later
// Método gráfico (reemplazo de GLP): rectas, región factible, vértices, recta de Z desplazable,
// zoom y desplazamiento, exportación y arrastre del lado derecho de una restricción.
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react";
import {
  Fraction,
  formatLP,
  formatLinearExpression,
  graphicalAnalysis,
  solveLP,
  type GraphicalAnalysis,
  type LPModel,
} from "@libreio/core";
import { t } from "../i18n";
import { downloadBinary, downloadText, svgToPng } from "../common/download";
import { makeFormatter, type NumberFormat } from "../common/numberFormat";
import type { Solved } from "./LPModule";
import {
  centroid,
  clipLine,
  clipPolygon,
  formatTick,
  niceStep,
  rectPolygon,
  type Pt,
  type Rect,
} from "./graphGeometry";

const W = 720;
const H = 520;
const PAD = 44;
const COLORS = [
  "#1f77b4",
  "#d62728",
  "#2ca02c",
  "#9467bd",
  "#ff7f0e",
  "#17becf",
  "#8c564b",
  "#e377c2",
];

interface GraphTabProps {
  readonly solved: Solved;
  readonly numberFormat: NumberFormat;
  readonly onApplyModel: (text: string) => void;
}

function initialRect(g: GraphicalAnalysis): Rect {
  const max = Math.max(g.viewBox.xMax, g.viewBox.yMax, 1);
  const margin = max * 0.08;
  return { xMin: -margin, xMax: max, yMin: -margin, yMax: max };
}

function withRhs(
  model: LPModel,
  overrides: ReadonlyMap<number, Fraction>,
): LPModel {
  if (overrides.size === 0) {
    return model;
  }
  return {
    ...model,
    constraints: model.constraints.map((c, i) =>
      overrides.has(i) ? { ...c, rhs: overrides.get(i)! } : c,
    ),
  };
}

export function GraphTab({
  solved,
  numberFormat,
  onApplyModel,
}: GraphTabProps) {
  const number = makeFormatter(numberFormat);
  const base = solved.graphical;
  const [rect, setRect] = useState<Rect>(() => initialRect(base));
  const [overrides, setOverrides] = useState<Map<number, Fraction>>(new Map());
  const [showZ, setShowZ] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<
    | { kind: "pan"; start: Pt; rect: Rect }
    | { kind: "line"; index: number }
    | null
  >(null);

  const model = useMemo(
    () => withRhs(solved.model, overrides),
    [solved.model, overrides],
  );
  const g = useMemo(
    () => (overrides.size === 0 ? base : graphicalAnalysis(model)),
    [base, model, overrides.size],
  );
  const result = useMemo(
    () => (overrides.size === 0 ? solved.result : solveLP(model)),
    [solved.result, model, overrides.size],
  );

  const [c1, c2] = g.objective.map((f) => f.toNumber()) as [number, number];
  const zMin = g.zRange ? g.zRange.min.toNumber() : 0;
  const zMaxBase = g.zRange ? g.zRange.max.toNumber() : 0;
  const zSpan = Math.max(zMaxBase - zMin, Math.abs(zMaxBase) * 0.5, 1);
  const zMax = g.bounded ? zMaxBase : zMaxBase + zSpan;
  const zStep = zSpan / 40;
  const optimumZ = g.optimum ? g.optimum.z.toNumber() : zMin;
  const [z, setZ] = useState<number>(optimumZ);
  const [lastOptimumZ, setLastOptimumZ] = useState<number>(optimumZ);
  if (lastOptimumZ !== optimumZ) {
    // La recta de Z vuelve al óptimo cuando cambia el modelo (por ejemplo al arrastrar una restricción).
    setLastOptimumZ(optimumZ);
    setZ(optimumZ);
  }

  const sx = useCallback(
    (x: number) =>
      PAD + ((x - rect.xMin) / (rect.xMax - rect.xMin)) * (W - 2 * PAD),
    [rect],
  );
  const sy = useCallback(
    (y: number) =>
      H - PAD - ((y - rect.yMin) / (rect.yMax - rect.yMin)) * (H - 2 * PAD),
    [rect],
  );
  const toData = useCallback(
    (clientX: number, clientY: number): Pt => {
      const svg = svgRef.current;
      if (!svg) {
        return { x: 0, y: 0 };
      }
      const box = svg.getBoundingClientRect();
      const px = ((clientX - box.left) / box.width) * W;
      const py = ((clientY - box.top) / box.height) * H;
      return {
        x: rect.xMin + ((px - PAD) / (W - 2 * PAD)) * (rect.xMax - rect.xMin),
        y:
          rect.yMin +
          ((H - PAD - py) / (H - 2 * PAD)) * (rect.yMax - rect.yMin),
      };
    },
    [rect],
  );

  const halfPlanes = useMemo(
    () =>
      [...g.lines, ...g.bounds].map((l) => ({
        a: l.a.toNumber(),
        b: l.b.toNumber(),
        c: l.c.toNumber(),
        relation: l.relation,
      })),
    [g.lines, g.bounds],
  );
  const region = useMemo(() => {
    if (g.status === "infeasible" || g.vertices.length === 0) {
      return [] as Pt[];
    }
    return halfPlanes.reduce(
      (poly, h) => clipPolygon(poly, h),
      rectPolygon(rect),
    );
  }, [halfPlanes, rect, g.status, g.vertices.length]);

  const zoom = (factor: number, center?: Pt) => {
    setRect((r) => {
      const cx = center?.x ?? (r.xMin + r.xMax) / 2;
      const cy = center?.y ?? (r.yMin + r.yMax) / 2;
      return {
        xMin: cx - (cx - r.xMin) * factor,
        xMax: cx + (r.xMax - cx) * factor,
        yMin: cy - (cy - r.yMin) * factor,
        yMax: cy + (r.yMax - cy) * factor,
      };
    });
  };

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    zoom(e.deltaY > 0 ? 1.2 : 1 / 1.2, toData(e.clientX, e.clientY));
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.kind === "line") {
      return;
    }
    drag.current = { kind: "pan", start: toData(e.clientX, e.clientY), rect };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) {
      return;
    }
    const p = toData(e.clientX, e.clientY);
    if (d.kind === "pan") {
      const dx = p.x - d.start.x;
      const dy = p.y - d.start.y;
      const scaleX = (d.rect.xMax - d.rect.xMin) / (rect.xMax - rect.xMin);
      const scaleY = (d.rect.yMax - d.rect.yMin) / (rect.yMax - rect.yMin);
      setRect({
        xMin: d.rect.xMin - dx * scaleX,
        xMax: d.rect.xMax - dx * scaleX,
        yMin: d.rect.yMin - dy * scaleY,
        yMax: d.rect.yMax - dy * scaleY,
      });
      return;
    }
    const line = g.lines[d.index]!;
    const raw = line.a.toNumber() * p.x + line.b.toNumber() * p.y;
    const original = solved.model.constraints[d.index]!.rhs;
    const snapped = original.isInteger()
      ? Math.round(raw)
      : Math.round(raw * 4) / 4;
    setOverrides((current) => {
      const next = new Map(current);
      next.set(d.index, Fraction.fromNumber(snapped));
      return next;
    });
  };

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const startLineDrag =
    (index: number) => (e: PointerEvent<SVGLineElement>) => {
      e.stopPropagation();
      drag.current = { kind: "line", index };
      svgRef.current?.setPointerCapture(e.pointerId);
    };

  const exportSvg = () => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(W));
    clone.setAttribute("height", String(H));
    const text = `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`;
    void downloadText(text, "grafico.svg", "svg", "SVG");
  };

  const exportPng = () => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(W));
    clone.setAttribute("height", String(H));
    const style = getComputedStyle(document.documentElement);
    const background = style.getPropertyValue("--surface").trim() || "#ffffff";
    const textColor = style.getPropertyValue("--text").trim() || "#000000";
    clone.setAttribute("style", `color:${textColor};font-family:sans-serif`);
    svgToPng(clone.outerHTML, W, H, background)
      .then((bytes) =>
        downloadBinary(bytes, "grafico.png", "png", "PNG", "image/png"),
      )
      .catch(() => undefined);
  };

  if (!g.applicable || !g.variables) {
    return <p className="empty">{t("graph.notApplicable")}</p>;
  }
  const [nameX, nameY] = g.variables;
  const stepX = niceStep(rect.xMax - rect.xMin);
  const stepY = niceStep(rect.yMax - rect.yMin);
  const ticks = (min: number, max: number, step: number): number[] => {
    const out: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
      out.push(Math.abs(v) < 1e-12 ? 0 : v);
    }
    return out;
  };
  const zLine =
    c1 === 0 && c2 === 0 ? null : clipLine({ a: c1, b: c2, c: z }, rect);
  const optimumReached =
    g.optimum !== null && Math.abs(z - g.optimum.z.toNumber()) < 1e-9;
  const regionCenter = centroid(region);
  const dir = g.unboundedDirection
    ? g.unboundedDirection.map((f) => f.toNumber())
    : null;
  const dirNorm = dir ? Math.hypot(dir[0]!, dir[1]!) || 1 : 1;
  const arrowLen = (rect.xMax - rect.xMin) * 0.25;
  const fmtPoint = (x: Fraction, y: Fraction) => `(${number(x)}, ${number(y)})`;
  const integerSolution =
    overrides.size === 0 ? (solved.integer?.solution ?? null) : null;
  const integerOptimum = integerSolution
    ? {
        x: integerSolution.variables[0]!.value,
        y: integerSolution.variables[1]!.value,
        z: integerSolution.objective,
      }
    : null;

  return (
    <div className="graph-tab" data-testid="graph-tab">
      <div className="graph-toolbar">
        <div className="toolbar">
          <button
            type="button"
            className="secondary"
            onClick={() => zoom(1 / 1.25)}
            data-testid="zoom-in"
          >
            {t("graph.zoomIn")}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => zoom(1.25)}
            data-testid="zoom-out"
          >
            {t("graph.zoomOut")}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setRect(initialRect(base))}
          >
            {t("graph.resetView")}
          </button>
          <label className="switch">
            <input
              type="checkbox"
              checked={showZ}
              onChange={(e) => setShowZ(e.target.checked)}
            />
            {t("graph.showZ")}
          </label>
        </div>
        <div className="toolbar">
          <button
            type="button"
            className="secondary"
            onClick={exportSvg}
            data-testid="export-svg"
          >
            {t("graph.exportSvg")}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={exportPng}
            data-testid="export-png"
          >
            {t("graph.exportPng")}
          </button>
        </div>
      </div>
      <svg
        ref={svgRef}
        className="graph"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t("tab.graph")}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-testid="graph-svg"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--error)" />
          </marker>
          <clipPath id="plot-area">
            <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} />
          </clipPath>
        </defs>
        <rect x={0} y={0} width={W} height={H} fill="var(--surface)" />
        <g clipPath="url(#plot-area)">
          {/* Semiplanos de cada restricción */}
          {g.lines.map((line, i) => {
            const poly = clipPolygon(rectPolygon(rect), {
              a: line.a.toNumber(),
              b: line.b.toNumber(),
              c: line.c.toNumber(),
              relation: line.relation,
            });
            if (poly.length < 3) {
              return null;
            }
            return (
              <polygon
                key={`hp-${i}`}
                points={poly.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.06}
                stroke="none"
              />
            );
          })}
          {/* Región factible */}
          {region.length >= 3 && (
            <polygon
              points={region.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
              fill="var(--accent)"
              fillOpacity={0.28}
              stroke="var(--accent)"
              strokeWidth={1.5}
              data-testid="feasible-region"
            />
          )}
          {/* Rectas de las restricciones */}
          {g.lines.map((line, i) => {
            const seg = clipLine(
              {
                a: line.a.toNumber(),
                b: line.b.toNumber(),
                c: line.c.toNumber(),
              },
              rect,
            );
            if (!seg) {
              return null;
            }
            const color = COLORS[i % COLORS.length]!;
            return (
              <g
                key={`line-${i}`}
                className="constraint-line"
                data-testid={`constraint-line-${i}`}
              >
                <line
                  x1={sx(seg[0].x)}
                  y1={sy(seg[0].y)}
                  x2={sx(seg[1].x)}
                  y2={sy(seg[1].y)}
                  stroke={color}
                  strokeWidth={2}
                />
                <line
                  x1={sx(seg[0].x)}
                  y1={sy(seg[0].y)}
                  x2={sx(seg[1].x)}
                  y2={sy(seg[1].y)}
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ cursor: "ns-resize" }}
                  onPointerDown={startLineDrag(i)}
                />
                <text
                  x={sx(seg[1].x) - 6}
                  y={sy(seg[1].y) - 6}
                  fill={color}
                  fontSize={14}
                  textAnchor="end"
                  style={{ pointerEvents: "none" }}
                >
                  {line.name}
                </text>
              </g>
            );
          })}
          {/* Segmento de óptimos alternativos */}
          {g.optimalSegment && (
            <line
              x1={sx(g.optimalSegment[0].x.toNumber())}
              y1={sy(g.optimalSegment[0].y.toNumber())}
              x2={sx(g.optimalSegment[1].x.toNumber())}
              y2={sy(g.optimalSegment[1].y.toNumber())}
              stroke="var(--ok)"
              strokeWidth={6}
              strokeLinecap="round"
              data-testid="optimal-segment"
            />
          )}
          {/* Recta de Z */}
          {showZ && zLine && (
            <line
              x1={sx(zLine[0].x)}
              y1={sy(zLine[0].y)}
              x2={sx(zLine[1].x)}
              y2={sy(zLine[1].y)}
              stroke={optimumReached ? "var(--ok)" : "var(--text)"}
              strokeWidth={2}
              strokeDasharray="8 5"
              data-testid="z-line"
            />
          )}
          {/* Flecha de dirección en región abierta */}
          {dir && region.length >= 3 && (
            <line
              x1={sx(regionCenter.x)}
              y1={sy(regionCenter.y)}
              x2={sx(regionCenter.x + (dir[0]! / dirNorm) * arrowLen)}
              y2={sy(regionCenter.y + (dir[1]! / dirNorm) * arrowLen)}
              stroke="var(--error)"
              strokeWidth={3}
              markerEnd="url(#arrow)"
              style={{ color: "var(--error)" }}
              data-testid="unbounded-arrow"
            />
          )}
          {/* Grilla de puntos enteros */}
          {g.integerPoints.map((p, i) => (
            <circle
              key={`ip-${i}`}
              cx={sx(p.x.toNumber())}
              cy={sy(p.y.toNumber())}
              r={2.5}
              fill="var(--text)"
              fillOpacity={0.6}
              data-testid="integer-point"
            />
          ))}
          {integerOptimum && (
            <g data-testid="integer-optimum">
              <rect
                x={sx(integerOptimum.x.toNumber()) - 7}
                y={sy(integerOptimum.y.toNumber()) - 7}
                width={14}
                height={14}
                fill="var(--warn)"
                stroke="var(--text)"
                strokeWidth={1.5}
              />
              <text
                x={sx(integerOptimum.x.toNumber()) + 10}
                y={sy(integerOptimum.y.toNumber()) + 18}
                fontSize={14}
                fill="var(--text)"
              >
                {t("status.integerOptimal")}{" "}
                {fmtPoint(integerOptimum.x, integerOptimum.y)} Z ={" "}
                {number(integerOptimum.z)}
              </text>
            </g>
          )}
          {/* Vértices */}
          {g.vertices.map((v, i) => {
            const isOpt =
              g.optimum !== null && v.x.eq(g.optimum.x) && v.y.eq(g.optimum.y);
            const px = sx(v.x.toNumber());
            const py = sy(v.y.toNumber());
            return (
              <g key={`v-${i}`} className="vertex" data-testid="vertex">
                <circle
                  cx={px}
                  cy={py}
                  r={isOpt ? 7 : 4.5}
                  fill={isOpt ? "var(--ok)" : "var(--surface)"}
                  stroke="var(--text)"
                  strokeWidth={1.5}
                />
                <text
                  x={px + 8}
                  y={py - 8}
                  fontSize={12}
                  fill="var(--text)"
                  data-testid="vertex-label"
                >
                  {fmtPoint(v.x, v.y)}
                  {showZ ? `  Z = ${number(v.z)}` : ""}
                </text>
              </g>
            );
          })}
        </g>
        {/* Ejes */}
        <line
          x1={PAD}
          y1={sy(0)}
          x2={W - PAD}
          y2={sy(0)}
          stroke="var(--muted)"
          strokeWidth={1}
        />
        <line
          x1={sx(0)}
          y1={PAD}
          x2={sx(0)}
          y2={H - PAD}
          stroke="var(--muted)"
          strokeWidth={1}
        />
        {ticks(rect.xMin, rect.xMax, stepX).map((v) => (
          <g key={`tx-${v}`}>
            <line
              x1={sx(v)}
              y1={H - PAD}
              x2={sx(v)}
              y2={H - PAD + 5}
              stroke="var(--muted)"
            />
            <text
              x={sx(v)}
              y={H - PAD + 17}
              fontSize={11}
              textAnchor="middle"
              fill="var(--muted)"
            >
              {formatTick(v)}
            </text>
          </g>
        ))}
        {ticks(rect.yMin, rect.yMax, stepY).map((v) => (
          <g key={`ty-${v}`}>
            <line
              x1={PAD - 5}
              y1={sy(v)}
              x2={PAD}
              y2={sy(v)}
              stroke="var(--muted)"
            />
            <text
              x={PAD - 8}
              y={sy(v) + 4}
              fontSize={11}
              textAnchor="end"
              fill="var(--muted)"
            >
              {formatTick(v)}
            </text>
          </g>
        ))}
        <text
          x={W - PAD}
          y={H - 8}
          fontSize={13}
          textAnchor="end"
          fill="var(--text)"
          fontWeight={600}
        >
          {nameX}
        </text>
        <text
          x={10}
          y={PAD - 12}
          fontSize={13}
          fill="var(--text)"
          fontWeight={600}
        >
          {nameY}
        </text>
        {g.status === "infeasible" && (
          <text
            x={W / 2}
            y={H / 2}
            fontSize={18}
            textAnchor="middle"
            fill="var(--error)"
            data-testid="graph-infeasible"
          >
            {t("graph.infeasible")}
          </text>
        )}
      </svg>
      <div className="graph-side">
        <div className="z-control">
          <label htmlFor="z-slider">
            {t("graph.z")}: Z = {formatTick(z)}
            {optimumReached ? ` · ${t("graph.optimalReached")}` : ""}
          </label>
          <div className="toolbar">
            <button
              type="button"
              className="secondary"
              onClick={() => setZ((v) => v - zStep)}
              data-testid="z-down"
              disabled={g.zRange === null}
            >
              {t("graph.zDown")}
            </button>
            <input
              id="z-slider"
              type="range"
              min={zMin - zSpan * 0.25}
              max={zMax}
              step="any"
              value={z}
              onChange={(e) => setZ(Number(e.target.value))}
              disabled={g.zRange === null}
              data-testid="z-slider"
            />
            <button
              type="button"
              className="secondary"
              onClick={() => setZ((v) => v + zStep)}
              data-testid="z-up"
              disabled={g.zRange === null}
            >
              {t("graph.zUp")}
            </button>
          </div>
        </div>
        <ul className="graph-status">
          {g.optimum && (
            <li data-testid="optimum">
              <strong>{t("graph.optimum")}:</strong>{" "}
              {fmtPoint(g.optimum.x, g.optimum.y)}, Z = {number(g.optimum.z)}
            </li>
          )}
          {g.optimalSegment && <li>{t("graph.alternative")}</li>}
          {g.status === "unbounded" && (
            <li data-testid="graph-unbounded">{t("graph.unbounded")}</li>
          )}
          {g.status === "infeasible" && <li>{t("graph.infeasible")}</li>}
          {result.status !== g.status && <li>{result.status}</li>}
        </ul>
        <div className="legend">
          <strong>{t("graph.legend")}</strong>
          <ul>
            {g.lines.map((line, i) => (
              <li key={i}>
                <span
                  className="swatch"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                {line.name}:{" "}
                {formatLinearExpression(
                  model.constraints[i]!.coefficients,
                  model.variables.map((v) => v.name),
                  number,
                )}{" "}
                {line.relation} {number(model.constraints[i]!.rhs)}
              </li>
            ))}
          </ul>
          <p className="hint">{t("graph.dragHint")}</p>
        </div>
        {overrides.size > 0 && (
          <div className="overrides" data-testid="overrides">
            <strong>{t("graph.modified")}:</strong>{" "}
            {[...overrides.entries()]
              .map(([i, v]) => `${g.lines[i]?.name ?? i} = ${number(v)}`)
              .join(", ")}
            <div className="toolbar">
              <button
                type="button"
                className="primary"
                onClick={() => onApplyModel(formatLP(model))}
              >
                {t("graph.apply")}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setOverrides(new Map())}
              >
                {t("graph.restore")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
