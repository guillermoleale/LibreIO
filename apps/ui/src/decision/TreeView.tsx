// SPDX-License-Identifier: GPL-3.0-or-later
// Árbol de decisión dibujado en SVG con los valores de la resolución hacia atrás.
// Los nodos que reciben más de una rama se duplican al dibujar, así cada rama tiene su propio subárbol.
import { useMemo } from "react";
import type { DecisionTree, Fraction, TreeResult } from "@libreio/core";

interface TreeViewProps {
  readonly tree: DecisionTree;
  readonly result: TreeResult;
  readonly number: (f: Fraction) => string;
}

interface Drawn {
  readonly key: string;
  readonly id: string;
  readonly kind: "decision" | "chance" | "terminal";
  readonly depth: number;
  readonly children: Array<{
    readonly node: Drawn;
    readonly label: string;
    readonly chosen: boolean;
    readonly rejected: boolean;
  }>;
  y: number;
}

const DX = 190;
const DY = 46;
const PAD_X = 30;
const PAD_Y = 24;
const MAX_DEPTH = 40;

function computeLayout(
  tree: DecisionTree,
  result: TreeResult,
  number: (f: Fraction) => string,
): { root: Drawn; flat: Drawn[]; width: number; height: number } {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  let leafCursor = 0;
  let counter = 0;
  let maxDepth = 0;
  const expand = (id: string, depth: number): Drawn => {
    const node = byId.get(id);
    counter += 1;
    maxDepth = Math.max(maxDepth, depth);
    const key = `${id}#${counter}`;
    if (!node || node.kind === "terminal" || depth >= MAX_DEPTH) {
      const drawn: Drawn = {
        key,
        id,
        kind: "terminal",
        depth,
        children: [],
        y: leafCursor * DY,
      };
      leafCursor += 1;
      return drawn;
    }
    const choice = result.choices[id];
    const children = node.branches.map((b, k) => {
      const child = expand(b.to, depth + 1);
      const prob = b.probability ? ` p = ${number(b.probability)}` : "";
      const pay = b.payoff ? ` (${number(b.payoff)})` : "";
      return {
        node: child,
        label: `${b.label ?? b.to}${prob}${pay}`,
        chosen: node.kind === "decision" && choice === k,
        rejected:
          node.kind === "decision" && choice !== undefined && choice !== k,
      };
    });
    const y =
      children.length === 0
        ? leafCursor * DY
        : (children[0]!.node.y + children[children.length - 1]!.node.y) / 2;
    if (children.length === 0) {
      leafCursor += 1;
    }
    return { key, id, kind: node.kind, depth, children, y };
  };
  const root = expand(tree.root, 0);
  const width = PAD_X * 2 + (maxDepth + 1) * DX;
  const height = PAD_Y * 2 + Math.max(1, leafCursor) * DY;
  const flat: Drawn[] = [];
  const collect = (d: Drawn) => {
    flat.push(d);
    d.children.forEach((c) => collect(c.node));
  };
  collect(root);
  return { root, flat, width, height };
}

export function TreeView({ tree, result, number }: TreeViewProps) {
  const layout = useMemo(
    () => computeLayout(tree, result, number),
    [tree, result, number],
  );

  const x = (d: Drawn) => PAD_X + d.depth * DX + 60;
  const y = (d: Drawn) => PAD_Y + d.y + DY / 2;
  const valueOf = (id: string) => result.values[id];

  return (
    <div className="graph-scroll">
      <svg
        className="decision-tree"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        style={{ width: "100%", maxWidth: layout.width * 1.4, height: "auto" }}
        role="img"
        aria-label="Árbol de decisión"
        data-testid="decision-tree-svg"
      >
        {layout.flat.flatMap((d) =>
          d.children.map((c) => {
            const x1 = x(d);
            const y1 = y(d);
            const x2 = x(c.node);
            const y2 = y(c.node);
            const mx = x1 + (x2 - x1) * 0.2;
            const my = y1 + (y2 - y1) * 0.2;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.hypot(dx, dy) || 1;
            const nx = (-dy / len) * 6;
            const ny = (dx / len) * 6;
            return (
              <g
                key={`${d.key}-${c.node.key}`}
                className={`tree-branch${c.chosen ? " chosen" : ""}${c.rejected ? " rejected" : ""}`}
              >
                <line x1={x1} y1={y1} x2={x2} y2={y2} />
                {c.rejected && (
                  <>
                    <line
                      x1={mx - 3 + nx}
                      y1={my + ny}
                      x2={mx - 3 - nx}
                      y2={my - ny}
                      className="tree-cut"
                    />
                    <line
                      x1={mx + 3 + nx}
                      y1={my + ny}
                      x2={mx + 3 - nx}
                      y2={my - ny}
                      className="tree-cut"
                    />
                  </>
                )}
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 5}
                  fontSize={11}
                  textAnchor="middle"
                  className="tree-branch-label"
                >
                  {c.label}
                </text>
              </g>
            );
          }),
        )}
        {layout.flat.map((d) => {
          const cx = x(d);
          const cy = y(d);
          const value = valueOf(d.id);
          return (
            <g
              key={d.key}
              className={`tree-node tree-${d.kind}`}
              transform={`translate(${cx}, ${cy})`}
              data-testid={`tree-node-${d.id}`}
            >
              {d.kind === "decision" && (
                <rect x={-11} y={-11} width={22} height={22} />
              )}
              {d.kind === "chance" && <circle r={11} />}
              {d.kind === "terminal" && (
                <path d="M -10 -10 L 10 0 L -10 10 z" />
              )}
              <text
                x={0}
                y={-16}
                fontSize={12}
                textAnchor="middle"
                fontWeight={700}
                className="tree-value"
              >
                {value ? number(value) : ""}
              </text>
              <text x={14} y={4} fontSize={11} className="tree-id">
                {d.kind === "terminal" ? "" : d.id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
