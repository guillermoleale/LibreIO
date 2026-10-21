// SPDX-License-Identifier: GPL-3.0-or-later
// Árbol de ramificación y acotamiento: dibujo en SVG y navegación nodo por nodo.
import { useMemo, useState } from "react";
import type { BBNode, BBResult, Fraction } from "@libreio/core";
import { t } from "../i18n";
import { makeFormatter, type NumberFormat } from "../common/numberFormat";
import { TableauView } from "./TableauTab";

interface TreeTabProps {
  readonly integer: BBResult;
  readonly isMin: boolean;
  readonly numberFormat: NumberFormat;
}

const NODE_W = 150;
const NODE_H = 54;
const GAP_X = 24;
const GAP_Y = 44;

interface Placed {
  readonly node: BBNode;
  readonly x: number;
  readonly y: number;
}

function layout(result: BBResult): {
  placed: Placed[];
  width: number;
  height: number;
} {
  const positions = new Map<number, number>();
  let leafCursor = 0;
  const visit = (node: BBNode): number => {
    if (node.children.length === 0) {
      const x = leafCursor;
      leafCursor += 1;
      positions.set(node.id, x);
      return x;
    }
    const xs = node.children.map((id) => visit(result.nodes[id]!));
    const x = (Math.min(...xs) + Math.max(...xs)) / 2;
    positions.set(node.id, x);
    return x;
  };
  if (result.nodes.length > 0) {
    visit(result.nodes[0]!);
  }
  const maxDepth = Math.max(0, ...result.nodes.map((n) => n.depth));
  const placed = result.nodes.map((node) => ({
    node,
    x: 16 + (positions.get(node.id) ?? 0) * (NODE_W + GAP_X),
    y: 16 + node.depth * (NODE_H + GAP_Y),
  }));
  return {
    placed,
    width: 32 + Math.max(1, leafCursor) * (NODE_W + GAP_X) - GAP_X,
    height: 32 + (maxDepth + 1) * (NODE_H + GAP_Y) - GAP_Y,
  };
}

function statusLabel(node: BBNode, result: BBResult): string {
  if (node.pruned === "integer") {
    return node.id === result.bestNode
      ? `${t("tree.pruned.integer")} (${t("tree.best")})`
      : t("tree.pruned.integer");
  }
  if (node.pruned === "infeasible") {
    return t("tree.pruned.infeasible");
  }
  if (node.pruned === "bound") {
    return t("tree.pruned.bound");
  }
  if (node.pruned === "unbounded") {
    return t("tree.pruned.unbounded");
  }
  return node.branchedOn
    ? `${t("tree.branched")} ${node.branchedOn}`
    : t("tree.open");
}

function statusClass(node: BBNode, result: BBResult): string {
  if (node.pruned === "integer") {
    return node.id === result.bestNode ? "node-best" : "node-integer";
  }
  if (node.pruned === "infeasible" || node.pruned === "unbounded") {
    return "node-infeasible";
  }
  if (node.pruned === "bound") {
    return "node-bound";
  }
  return "node-branch";
}

export function TreeTab({ integer, isMin, numberFormat }: TreeTabProps) {
  const number = makeFormatter(numberFormat);
  const [selected, setSelected] = useState(integer.bestNode ?? 0);
  const [showTableau, setShowTableau] = useState(false);
  const { placed, width, height } = useMemo(() => layout(integer), [integer]);
  const byOrder = useMemo(
    () => [...integer.nodes].sort((a, b) => a.order - b.order),
    [integer],
  );
  const node = integer.nodes[selected] ?? integer.nodes[0]!;
  const orderIndex = byOrder.findIndex((n) => n.id === node.id);
  const fmt = (f: Fraction | null) => (f === null ? "-" : number(f));
  const branchText = (n: BBNode) =>
    n.branch
      ? `${n.branch.variable} ${n.branch.direction} ${number(n.branch.value)}`
      : "raíz";

  return (
    <div className="tree-tab" data-testid="tree-tab">
      <p className="hint">
        {integer.nodes.length} {t("tree.node").toLowerCase()}s,{" "}
        {integer.branches} ramificaciones, {integer.pivots} {t("tree.pivots")}.
        {integer.solution
          ? ` ${t("status.integerOptimal")}: Z = ${number(integer.solution.objective)}.`
          : ""}
      </p>
      <div className="tree-scroll">
        <svg
          className="tree"
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={t("tab.tree")}
          data-testid="tree-svg"
        >
          {placed.map(({ node: n, x, y }) =>
            n.children.map((childId) => {
              const child = placed.find((p) => p.node.id === childId)!;
              return (
                <line
                  key={`${n.id}-${childId}`}
                  x1={x + NODE_W / 2}
                  y1={y + NODE_H}
                  x2={child.x + NODE_W / 2}
                  y2={child.y}
                  stroke="var(--muted)"
                  strokeWidth={1.5}
                />
              );
            }),
          )}
          {placed.map(({ node: n, x, y }) => (
            <g
              key={n.id}
              className={`tree-node ${statusClass(n, integer)}${n.id === node.id ? " selected" : ""}`}
              transform={`translate(${x}, ${y})`}
              onClick={() => setSelected(n.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setSelected(n.id);
                }
              }}
              data-testid={`tree-node-${n.id}`}
            >
              <rect width={NODE_W} height={NODE_H} rx={6} />
              <text x={8} y={18} fontSize={12} fontWeight={700}>
                {t("tree.node")} {n.id}: {branchText(n)}
              </text>
              <text x={8} y={34} fontSize={12}>
                {n.bound
                  ? `Z = ${number(n.bound)}`
                  : t("tree.pruned.infeasible")}
              </text>
              <text x={8} y={48} fontSize={11}>
                {statusLabel(n, integer)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="toolbar">
        <button
          type="button"
          className="secondary"
          disabled={orderIndex <= 0}
          onClick={() => setSelected(byOrder[orderIndex - 1]!.id)}
          data-testid="tree-prev"
        >
          {t("tree.prev")}
        </button>
        <span className="position">
          {t("tree.order")}: {node.order + 1} / {integer.nodes.length}
        </span>
        <button
          type="button"
          className="secondary"
          disabled={orderIndex < 0 || orderIndex >= byOrder.length - 1}
          onClick={() => setSelected(byOrder[orderIndex + 1]!.id)}
          data-testid="tree-next"
        >
          {t("tree.next")}
        </button>
      </div>
      <dl className="summary node-details" data-testid="tree-details">
        <dt>{t("tree.node")}</dt>
        <dd>
          {node.id} ({t("tree.parent").toLowerCase()}:{" "}
          {node.parent === null ? "-" : node.parent})
        </dd>
        <dt>{t("tree.branch")}</dt>
        <dd>
          {node.path.length === 0
            ? "-"
            : node.path
                .map((c) => `${c.variable} ${c.direction} ${number(c.value)}`)
                .join(", ")}
        </dd>
        <dt>{t("tree.bound")}</dt>
        <dd>{fmt(node.bound)}</dd>
        <dt>{t("tree.solution")}</dt>
        <dd>
          {node.solution
            ? node.solution
                .map((v) => `${v.name} = ${number(v.value)}`)
                .join(", ")
            : "-"}
        </dd>
        <dt>{t("tree.status")}</dt>
        <dd>{statusLabel(node, integer)}</dd>
        <dt>{t("tree.pivots")}</dt>
        <dd>{node.pivots}</dd>
      </dl>
      <label className="switch">
        <input
          type="checkbox"
          checked={showTableau}
          onChange={(e) => setShowTableau(e.target.checked)}
        />
        {t("tree.showTableau")}
      </label>
      {showTableau && node.lp.trace.length > 0 && (
        <TableauView
          tableau={node.lp.trace[node.lp.trace.length - 1]!.tableau}
          step={null}
          number={number}
          isMin={isMin}
        />
      )}
    </div>
  );
}
