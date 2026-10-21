// SPDX-License-Identifier: GPL-3.0-or-later
// Diagramas del módulo PERT/CPM: red de actividades en nodos, Gantt y curva de costo de compresión.
import { useMemo } from "react";
import type { CpmResult, CrashingResult, Fraction } from "@libreio/core";

const BOX_W = 118;
const BOX_H = 58;
const DX = 170;
const DY = 78;

interface AonProps {
  readonly result: CpmResult;
  readonly number: (f: Fraction) => string;
}

export function ActivityNetwork({ result, number }: AonProps) {
  const layout = useMemo(() => {
    const byId = new Map(result.activities.map((a) => [a.id, a]));
    const layer = new Map<string, number>();
    for (const id of result.order) {
      const a = byId.get(id)!;
      const l = a.predecessors.reduce(
        (max, p) => Math.max(max, (layer.get(p) ?? 0) + 1),
        0,
      );
      layer.set(id, l);
    }
    const groups = new Map<number, string[]>();
    for (const id of result.order) {
      const l = layer.get(id) ?? 0;
      groups.set(l, [...(groups.get(l) ?? []), id]);
    }
    const maxPerLayer = Math.max(
      1,
      ...[...groups.values()].map((g) => g.length),
    );
    const layerCount = Math.max(1, ...[...groups.keys()].map((k) => k + 1));
    const width = 40 + layerCount * DX;
    const height = Math.max(200, 30 + maxPerLayer * DY);
    const pos = new Map<string, { x: number; y: number }>();
    for (const [l, group] of groups) {
      group.forEach((id, i) =>
        pos.set(id, {
          x: 20 + l * DX,
          y: ((i + 1) * height) / (group.length + 1) - BOX_H / 2,
        }),
      );
    }
    return { pos, width, height, byId };
  }, [result]);
  const criticalEdge = (from: string, to: string) => {
    const a = layout.byId.get(from)!;
    const b = layout.byId.get(to)!;
    return a.critical && b.critical && a.ef.eq(b.es);
  };
  return (
    <div className="graph-scroll">
      <svg
        className="aon"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        style={{ width: "100%", maxWidth: layout.width * 1.4, height: "auto" }}
        role="img"
        aria-label="Red de actividades"
        data-testid="aon-svg"
      >
        <defs>
          <marker
            id="aon-arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
          </marker>
        </defs>
        {result.activities.flatMap((a) =>
          a.successors.map((s) => {
            const p = layout.pos.get(a.id)!;
            const q = layout.pos.get(s)!;
            return (
              <line
                key={`${a.id}-${s}`}
                className={`aon-edge${criticalEdge(a.id, s) ? " critical" : ""}`}
                x1={p.x + BOX_W}
                y1={p.y + BOX_H / 2}
                x2={q.x}
                y2={q.y + BOX_H / 2}
                markerEnd="url(#aon-arrow)"
              />
            );
          }),
        )}
        {result.activities.map((a) => {
          const p = layout.pos.get(a.id)!;
          return (
            <g
              key={a.id}
              className={`aon-node${a.critical ? " critical" : ""}`}
              transform={`translate(${p.x}, ${p.y})`}
              data-testid={`aon-${a.id}`}
            >
              <rect width={BOX_W} height={BOX_H} rx={6} />
              <line x1={0} y1={20} x2={BOX_W} y2={20} />
              <line x1={BOX_W / 2} y1={20} x2={BOX_W / 2} y2={BOX_H} />
              <text x={6} y={14} fontSize={12} fontWeight={700}>
                {a.id} ({number(a.duration)})
              </text>
              <text x={BOX_W / 4} y={34} fontSize={11} textAnchor="middle">
                {number(a.es)} | {number(a.ef)}
              </text>
              <text
                x={(3 * BOX_W) / 4}
                y={34}
                fontSize={11}
                textAnchor="middle"
              >
                {number(a.ls)} | {number(a.lf)}
              </text>
              <text
                x={BOX_W / 2}
                y={50}
                fontSize={10}
                textAnchor="middle"
                className="muted"
              >
                h = {number(a.totalSlack)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Gantt({ result, number }: AonProps) {
  const total = Math.max(1, result.duration.toNumber());
  const rowH = 26;
  const left = 70;
  const width = 640;
  const scale = (width - left - 20) / total;
  const height = 30 + result.order.length * rowH;
  const byId = new Map(result.activities.map((a) => [a.id, a]));
  const ticks: number[] = [];
  const step = total <= 12 ? 1 : total <= 30 ? 2 : Math.ceil(total / 12);
  for (let v = 0; v <= total; v += step) {
    ticks.push(v);
  }
  return (
    <div className="graph-scroll">
      <svg
        className="gantt"
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", maxWidth: width * 1.5, height: "auto" }}
        role="img"
        aria-label="Gantt"
        data-testid="gantt-svg"
      >
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={left + v * scale}
              y1={16}
              x2={left + v * scale}
              y2={height}
              className="gantt-grid"
            />
            <text
              x={left + v * scale}
              y={12}
              fontSize={10}
              textAnchor="middle"
              className="muted"
            >
              {v}
            </text>
          </g>
        ))}
        {result.order.map((id, i) => {
          const a = byId.get(id)!;
          const y = 22 + i * rowH;
          return (
            <g key={id} data-testid={`gantt-${id}`}>
              <text
                x={left - 8}
                y={y + 15}
                fontSize={12}
                textAnchor="end"
                fontWeight={a.critical ? 700 : 400}
              >
                {id}
              </text>
              {!a.totalSlack.isZero() && (
                <rect
                  x={left + a.ef.toNumber() * scale}
                  y={y + 6}
                  width={a.totalSlack.toNumber() * scale}
                  height={10}
                  className="gantt-slack"
                />
              )}
              <rect
                x={left + a.es.toNumber() * scale}
                y={y + 3}
                width={Math.max(2, a.duration.toNumber() * scale)}
                height={16}
                rx={3}
                className={`gantt-bar${a.critical ? " critical" : ""}`}
              />
              <text
                x={left + a.es.toNumber() * scale + 4}
                y={y + 15}
                fontSize={10}
                className="gantt-text"
              >
                {number(a.es)}–{number(a.ef)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function CostCurve({ result }: { result: CrashingResult }) {
  const W = 520;
  const H = 260;
  const PAD = 56;
  const points = result.curve.map((p) => ({
    d: p.duration.toNumber(),
    c: p.cost.toNumber(),
  }));
  if (points.length === 0) {
    return null;
  }
  const dMin = Math.min(...points.map((p) => p.d));
  const dMax = Math.max(...points.map((p) => p.d));
  const cMax = Math.max(1, ...points.map((p) => p.c));
  const sx = (d: number) =>
    PAD + ((d - dMin) / Math.max(1e-9, dMax - dMin || 1)) * (W - 2 * PAD);
  const sy = (c: number) => H - PAD - (c / cMax) * (H - 2 * PAD);
  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Curva de costo"
      data-testid="crash-curve"
    >
      <rect x={0} y={0} width={W} height={H} fill="var(--surface)" />
      <line
        x1={PAD}
        y1={H - PAD}
        x2={W - PAD}
        y2={H - PAD}
        stroke="var(--muted)"
      />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="var(--muted)" />
      <polyline
        points={points.map((p) => `${sx(p.d)},${sy(p.c)}`).join(" ")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.5}
      />
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={sx(p.d)}
            cy={sy(p.c)}
            r={4}
            fill="var(--warn)"
            stroke="var(--text)"
          />
          <text
            x={sx(p.d)}
            y={sy(p.c) - 8}
            fontSize={11}
            textAnchor="middle"
            fill="var(--text)"
          >
            {p.c}
          </text>
          <text
            x={sx(p.d)}
            y={H - PAD + 14}
            fontSize={11}
            textAnchor="middle"
            fill="var(--muted)"
          >
            {p.d}
          </text>
        </g>
      ))}
      <text
        x={W / 2}
        y={H - 8}
        fontSize={12}
        textAnchor="middle"
        fill="var(--text)"
      >
        Duración
      </text>
      <text x={8} y={PAD - 22} fontSize={12} fill="var(--text)">
        Costo
      </text>
    </svg>
  );
}
