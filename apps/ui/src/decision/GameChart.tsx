// SPDX-License-Identifier: GPL-3.0-or-later
// Resolución gráfica de un juego 2 por n (o m por 2): una recta por estrategia del rival y la envolvente.
import type { Fraction, GameResult } from "@libreio/core";

interface GameChartProps {
  readonly result: GameResult;
  readonly number: (f: Fraction) => string;
}

const W = 560;
const H = 320;
const PAD = 48;
const SAMPLES = 200;

export function GameChart({ result, number }: GameChartProps) {
  const g = result.graphical;
  if (!g) {
    return null;
  }
  const names = g.player === "row" ? result.columns : result.rows;
  const own = g.player === "row" ? result.rows : result.columns;
  const lines = g.lines.map((l) => ({
    index: l.index,
    a: l.atZero.toNumber(),
    b: l.atOne.toNumber(),
  }));
  const values = lines.flatMap((l) => [l.a, l.b]);
  const vMin = Math.min(...values, g.value.toNumber());
  const vMax = Math.max(...values, g.value.toNumber());
  const span = vMax - vMin || 1;
  const yMin = vMin - span * 0.1;
  const yMax = vMax + span * 0.1;
  const sx = (p: number) => PAD + p * (W - 2 * PAD);
  const sy = (v: number) =>
    H - PAD - ((v - yMin) / (yMax - yMin)) * (H - 2 * PAD);
  const envelope: string[] = [];
  for (let i = 0; i <= SAMPLES; i += 1) {
    const p = i / SAMPLES;
    const at = lines.map((l) => l.a + (l.b - l.a) * p);
    const v = g.player === "row" ? Math.min(...at) : Math.max(...at);
    envelope.push(`${sx(p)},${sy(v)}`);
  }
  const p = g.optimum.toNumber();
  const v = g.value.toNumber();
  const [s1, s2] = g.strategies;
  return (
    <div>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Resolución gráfica"
        data-testid="game-chart"
      >
        <rect x={0} y={0} width={W} height={H} fill="var(--surface)" />
        <line
          x1={sx(0)}
          y1={PAD}
          x2={sx(0)}
          y2={H - PAD}
          stroke="var(--muted)"
        />
        <line
          x1={sx(1)}
          y1={PAD}
          x2={sx(1)}
          y2={H - PAD}
          stroke="var(--muted)"
        />
        <line
          x1={sx(0)}
          y1={sy(0)}
          x2={sx(1)}
          y2={sy(0)}
          stroke="var(--border)"
          strokeDasharray="4 4"
        />
        {lines.map((l, i) => (
          <g key={i}>
            <line
              x1={sx(0)}
              y1={sy(l.a)}
              x2={sx(1)}
              y2={sy(l.b)}
              stroke="var(--muted)"
              strokeWidth={1.5}
            />
            <text
              x={sx(1) + 6}
              y={sy(l.b) + 4}
              fontSize={11}
              fill="var(--text)"
            >
              {names[l.index]}
            </text>
          </g>
        ))}
        <polyline
          points={envelope.join(" ")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={3}
        />
        <line
          x1={sx(p)}
          y1={sy(v)}
          x2={sx(p)}
          y2={H - PAD}
          stroke="var(--warn)"
          strokeDasharray="4 4"
        />
        <circle
          cx={sx(p)}
          cy={sy(v)}
          r={5}
          fill="var(--warn)"
          stroke="var(--text)"
        />
        <text
          x={sx(p)}
          y={sy(v) - 10}
          fontSize={12}
          textAnchor="middle"
          fill="var(--text)"
          fontWeight={700}
        >
          ({number(g.optimum)}, {number(g.value)})
        </text>
        <text
          x={sx(0)}
          y={H - PAD + 16}
          fontSize={11}
          textAnchor="middle"
          fill="var(--muted)"
        >
          0
        </text>
        <text
          x={sx(1)}
          y={H - PAD + 16}
          fontSize={11}
          textAnchor="middle"
          fill="var(--muted)"
        >
          1
        </text>
        <text
          x={W / 2}
          y={H - 8}
          fontSize={12}
          textAnchor="middle"
          fill="var(--text)"
        >
          {g.player === "row" ? "p" : "q"} = probabilidad de {own[s1]} (1 -{" "}
          {g.player === "row" ? "p" : "q"} sobre {own[s2]})
        </text>
        <text
          x={PAD - 6}
          y={sy(yMax) + 4}
          fontSize={11}
          textAnchor="end"
          fill="var(--muted)"
        >
          {yMax.toFixed(1)}
        </text>
        <text
          x={PAD - 6}
          y={sy(yMin) + 4}
          fontSize={11}
          textAnchor="end"
          fill="var(--muted)"
        >
          {yMin.toFixed(1)}
        </text>
      </svg>
      <p className="hint">
        {g.player === "row"
          ? "Envolvente inferior: lo peor que puede hacer el rival para cada p; el máximo de la envolvente es el óptimo."
          : "Envolvente superior: lo mejor que puede hacer el rival para cada q; el mínimo de la envolvente es el óptimo."}
      </p>
    </div>
  );
}
