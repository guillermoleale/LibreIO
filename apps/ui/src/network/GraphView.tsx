// SPDX-License-Identifier: GPL-3.0-or-later
// Dibujo del grafo en SVG con layout por capas (anchura desde un nodo raíz) y resaltado de la solución.
import { useMemo } from "react";
import type { NetworkProblem } from "@libreio/core";
import { arcKey } from "./arcKey";

export interface GraphViewProps {
  readonly problem: NetworkProblem;
  readonly nodes: string[];
  readonly root?: string;
  /** Claves "from|to" de los arcos a resaltar, con la clase CSS a aplicar. */
  readonly arcClasses?: Map<string, string>;
  readonly arcLabels?: Map<string, string>;
  readonly nodeClasses?: Map<string, string>;
  readonly nodeLabels?: Map<string, string>;
}

const DX = 150;
const DY = 84;
const R = 20;

function layers(
  problem: NetworkProblem,
  nodes: string[],
  root: string | undefined,
): Map<string, number> {
  const adjacency = new Map<string, string[]>(nodes.map((n) => [n, []]));
  for (const a of problem.arcs) {
    adjacency.get(a.from)?.push(a.to);
    if (!problem.directed) {
      adjacency.get(a.to)?.push(a.from);
    }
  }
  const layer = new Map<string, number>();
  const order =
    root && nodes.includes(root)
      ? [root, ...nodes.filter((n) => n !== root)]
      : nodes;
  let offset = 0;
  for (const start of order) {
    if (layer.has(start)) {
      continue;
    }
    const queue = [start];
    layer.set(start, offset);
    let maxLayer = offset;
    while (queue.length > 0) {
      const u = queue.shift()!;
      for (const v of adjacency.get(u) ?? []) {
        if (!layer.has(v)) {
          layer.set(v, layer.get(u)! + 1);
          maxLayer = Math.max(maxLayer, layer.get(v)!);
          queue.push(v);
        }
      }
    }
    // En redes dirigidas, los nodos sin camino desde la raíz van en capas nuevas
    offset = maxLayer + 1;
  }
  return layer;
}

export function GraphView({
  problem,
  nodes,
  root,
  arcClasses,
  arcLabels,
  nodeClasses,
  nodeLabels,
}: GraphViewProps) {
  const positions = useMemo(() => {
    const layer = layers(problem, nodes, root);
    const groups = new Map<number, string[]>();
    for (const n of nodes) {
      const l = layer.get(n) ?? 0;
      groups.set(l, [...(groups.get(l) ?? []), n]);
    }
    const maxPerLayer = Math.max(
      1,
      ...[...groups.values()].map((g) => g.length),
    );
    const height = Math.max(240, maxPerLayer * DY + 60);
    const layerCount = Math.max(1, ...[...groups.keys()].map((k) => k + 1));
    const width = Math.max(360, layerCount * DX + 60);
    const pos = new Map<string, { x: number; y: number }>();
    for (const [l, group] of groups) {
      group.forEach((n, i) => {
        pos.set(n, {
          x: 60 + l * DX,
          y: ((i + 1) * height) / (group.length + 1),
        });
      });
    }
    return { pos, width, height };
  }, [problem, nodes, root]);

  const reverseExists = (from: string, to: string) =>
    problem.directed &&
    problem.arcs.some((a) => a.from === to && a.to === from);

  return (
    <div className="graph-scroll">
      <svg
        className="network"
        viewBox={`0 0 ${positions.width} ${positions.height}`}
        style={{
          width: "100%",
          maxWidth: positions.width * 1.6,
          height: "auto",
        }}
        role="img"
        aria-label="Grafo"
        data-testid="network-svg"
      >
        <defs>
          <marker
            id="net-arrow"
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
        {problem.arcs.map((a, k) => {
          const p = positions.pos.get(a.from);
          const q = positions.pos.get(a.to);
          if (!p || !q) {
            return null;
          }
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const x1 = p.x + ux * R;
          const y1 = p.y + uy * R;
          const x2 = q.x - ux * R;
          const y2 = q.y - uy * R;
          const curve = reverseExists(a.from, a.to);
          const nx = -uy;
          const ny = ux;
          const bend = curve ? 22 : 0;
          const mx = (x1 + x2) / 2 + nx * bend;
          const my = (y1 + y2) / 2 + ny * bend;
          const key = arcKey(a.from, a.to);
          const cls =
            arcClasses?.get(key) ??
            (problem.directed
              ? ""
              : (arcClasses?.get(arcKey(a.to, a.from)) ?? ""));
          const label =
            arcLabels?.get(key) ??
            (problem.directed
              ? undefined
              : arcLabels?.get(arcKey(a.to, a.from))) ??
            a.weight.toString();
          const lx = (x1 + x2) / 2 + nx * (bend + 12);
          const ly = (y1 + y2) / 2 + ny * (bend + 12);
          return (
            <g
              key={k}
              className={`net-arc ${cls}`}
              data-testid={`net-arc-${a.from}-${a.to}`}
            >
              <path
                d={
                  curve
                    ? `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`
                    : `M ${x1} ${y1} L ${x2} ${y2}`
                }
                fill="none"
                markerEnd={problem.directed ? "url(#net-arrow)" : undefined}
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                fontSize={12}
                className="net-arc-label"
              >
                {label}
              </text>
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = positions.pos.get(n)!;
          const cls = nodeClasses?.get(n) ?? "";
          const label = nodeLabels?.get(n);
          return (
            <g
              key={n}
              className={`net-node ${cls}`}
              transform={`translate(${p.x}, ${p.y})`}
              data-testid={`net-node-${n}`}
            >
              <circle r={R} />
              <text
                textAnchor="middle"
                dy="0.35em"
                fontSize={13}
                fontWeight={700}
              >
                {n}
              </text>
              {label !== undefined && (
                <text
                  y={-R - 6}
                  textAnchor="middle"
                  fontSize={12}
                  className="net-node-label"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
