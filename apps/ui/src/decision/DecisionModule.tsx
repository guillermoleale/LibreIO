// SPDX-License-Identifier: GPL-3.0-or-later
// Módulo de decisiones: tabla de pagos, revisión bayesiana, árbol de decisión y juego de suma cero.
import { useMemo, useState } from "react";
import {
  ParseError,
  bayesAnalysis,
  parseDecisionFile,
  payoffAnalysis,
  reportBayes,
  reportDecisionTree,
  reportGame,
  reportPayoff,
  serializeDecisionFile,
  solveDecisionTree,
  solveGame,
  type BayesProblem,
  type BayesResult,
  type DecisionFile,
  type DecisionTree,
  type GameResult,
  type PayoffProblem,
  type PayoffResult,
  type TreeResult,
} from "@libreio/core";
import { t } from "../i18n";
import { decisionExamples } from "../common/examples";
import { downloadText } from "../common/download";
import { openTextFile } from "../common/files";
import {
  DECIMALS,
  makeFormatter,
  type NumberFormat,
} from "../common/numberFormat";
import { Tabs } from "../common/Tabs";
import {
  buildBayes,
  buildGame,
  buildPayoff,
  buildTree,
  emptyDrafts,
  fileToDrafts,
  type BayesDraft,
  type Drafts,
  type GameDraft,
  type GameProblem,
  type Kind,
  type PayoffDraft,
  type Sense,
  type TreeDraft,
} from "./drafts";
import { GameChart } from "./GameChart";
import { TreeView } from "./TreeView";

type TabKey = "solution" | "criteria" | "tree" | "graphical";

type Solved =
  | {
      readonly kind: "payoff";
      readonly problem: PayoffProblem;
      readonly result: PayoffResult;
    }
  | {
      readonly kind: "bayes";
      readonly problem: BayesProblem;
      readonly result: BayesResult;
    }
  | {
      readonly kind: "tree";
      readonly tree: DecisionTree;
      readonly result: TreeResult;
    }
  | {
      readonly kind: "game";
      readonly problem: GameProblem;
      readonly result: GameResult;
    };

function loadInitial(): { kind: Kind; drafts: Drafts; name: string } {
  const example = decisionExamples.find((e) => e.id.startsWith("DEC-01"));
  if (example) {
    try {
      const loaded = fileToDrafts(parseDecisionFile(example.text), emptyDrafts);
      return { ...loaded, name: `${example.id}.io.json` };
    } catch {
      // Se usa el borrador vacío
    }
  }
  return { kind: "payoff", drafts: emptyDrafts, name: "decision.io.json" };
}

const initial = loadInitial();

interface CellProps {
  readonly value: string;
  readonly invalid: boolean;
  readonly onChange: (value: string) => void;
  readonly name?: boolean;
  readonly testId?: string;
  readonly ariaLabel?: string;
}

function Cell({
  value,
  invalid,
  onChange,
  name,
  testId,
  ariaLabel,
}: CellProps) {
  return (
    <input
      className={`cell${name ? " name" : ""}${invalid ? " invalid" : ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
      aria-label={ariaLabel}
    />
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="icon"
      title={t("table.remove")}
      onClick={onClick}
    >
      ×
    </button>
  );
}

function SenseSelect({
  value,
  onChange,
  testId,
}: {
  value: Sense;
  onChange: (s: Sense) => void;
  testId: string;
}) {
  return (
    <label>
      {t("dec.sense")}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Sense)}
        data-testid={testId}
      >
        <option value="max">{t("dec.max")}</option>
        <option value="min">{t("dec.min")}</option>
      </select>
    </label>
  );
}

function PayoffEditor({
  draft,
  invalid,
  onChange,
}: {
  draft: PayoffDraft;
  invalid: Set<string>;
  onChange: (d: PayoffDraft) => void;
}) {
  const replace = <T,>(list: T[], i: number, value: T) =>
    list.map((x, k) => (k === i ? value : x));
  return (
    <div>
      <div className="options">
        <SenseSelect
          value={draft.sense}
          onChange={(sense) => onChange({ ...draft, sense })}
          testId="payoff-sense"
        />
        <label className="switch">
          <input
            type="checkbox"
            checked={draft.useProbabilities}
            onChange={(e) =>
              onChange({ ...draft, useProbabilities: e.target.checked })
            }
            data-testid="payoff-use-probabilities"
          />
          {t("dec.useProbabilities")}
        </label>
        <label>
          {t("dec.alpha")}
          <input
            className={`short${invalid.has("alpha") ? " invalid" : ""}`}
            value={draft.alpha}
            onChange={(e) => onChange({ ...draft, alpha: e.target.value })}
            data-testid="payoff-alpha"
          />
        </label>
      </div>
      <div className="table-scroll">
        <table className="data-table editor-grid">
          <thead>
            <tr>
              <th>
                {t("dec.alternatives")} \ {t("dec.states")}
              </th>
              {draft.states.map((s, j) => (
                <th key={j}>
                  <Cell
                    value={s}
                    invalid={invalid.has(`state-${j}`)}
                    name
                    onChange={(v) =>
                      onChange({
                        ...draft,
                        states: replace(draft.states, j, v),
                      })
                    }
                    testId={`payoff-state-${j}`}
                    ariaLabel={`${t("dec.states")} ${j + 1}`}
                  />
                  {draft.states.length > 1 && (
                    <RemoveButton
                      onClick={() =>
                        onChange({
                          ...draft,
                          states: draft.states.filter((_, k) => k !== j),
                          probabilities: draft.probabilities.filter(
                            (_, k) => k !== j,
                          ),
                          payoffs: draft.payoffs.map((row) =>
                            row.filter((_, k) => k !== j),
                          ),
                        })
                      }
                    />
                  )}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {draft.useProbabilities && (
              <tr>
                <th scope="row">{t("dec.probabilities")}</th>
                {draft.probabilities.map((p, j) => (
                  <td key={j}>
                    <Cell
                      value={p}
                      invalid={invalid.has(`prob-${j}`)}
                      onChange={(v) =>
                        onChange({
                          ...draft,
                          probabilities: replace(draft.probabilities, j, v),
                        })
                      }
                      testId={`payoff-prob-${j}`}
                    />
                  </td>
                ))}
                <td />
              </tr>
            )}
            {draft.alternatives.map((a, i) => (
              <tr key={i}>
                <th scope="row">
                  <Cell
                    value={a}
                    invalid={invalid.has(`alt-${i}`)}
                    name
                    onChange={(v) =>
                      onChange({
                        ...draft,
                        alternatives: replace(draft.alternatives, i, v),
                      })
                    }
                    testId={`payoff-alt-${i}`}
                    ariaLabel={`${t("dec.alternatives")} ${i + 1}`}
                  />
                </th>
                {draft.payoffs[i]!.map((c, j) => (
                  <td key={j}>
                    <Cell
                      value={c}
                      invalid={invalid.has(`pay-${i}-${j}`)}
                      onChange={(v) =>
                        onChange({
                          ...draft,
                          payoffs: draft.payoffs.map((row, k) =>
                            k === i ? replace(row, j, v) : row,
                          ),
                        })
                      }
                      testId={`payoff-cell-${i}-${j}`}
                    />
                  </td>
                ))}
                <td>
                  {draft.alternatives.length > 1 && (
                    <RemoveButton
                      onClick={() =>
                        onChange({
                          ...draft,
                          alternatives: draft.alternatives.filter(
                            (_, k) => k !== i,
                          ),
                          payoffs: draft.payoffs.filter((_, k) => k !== i),
                        })
                      }
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onChange({
              ...draft,
              alternatives: [
                ...draft.alternatives,
                `A${draft.alternatives.length + 1}`,
              ],
              payoffs: [...draft.payoffs, draft.states.map(() => "0")],
            })
          }
          data-testid="payoff-add-alternative"
        >
          {t("dec.addAlternative")}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onChange({
              ...draft,
              states: [...draft.states, `S${draft.states.length + 1}`],
              probabilities: [...draft.probabilities, "0"],
              payoffs: draft.payoffs.map((row) => [...row, "0"]),
            })
          }
          data-testid="payoff-add-state"
        >
          {t("dec.addState")}
        </button>
      </div>
    </div>
  );
}

function BayesEditor({
  draft,
  invalid,
  onChange,
}: {
  draft: BayesDraft;
  invalid: Set<string>;
  onChange: (d: BayesDraft) => void;
}) {
  const replace = <T,>(list: T[], i: number, value: T) =>
    list.map((x, k) => (k === i ? value : x));
  return (
    <div>
      <div className="options">
        <SenseSelect
          value={draft.sense}
          onChange={(sense) => onChange({ ...draft, sense })}
          testId="bayes-sense"
        />
      </div>
      <h3>{t("dec.payoff")}</h3>
      <div className="table-scroll">
        <table className="data-table editor-grid">
          <thead>
            <tr>
              <th>
                {t("dec.alternatives")} \ {t("dec.states")}
              </th>
              {draft.states.map((s, j) => (
                <th key={j}>
                  <Cell
                    value={s}
                    invalid={invalid.has(`state-${j}`)}
                    name
                    onChange={(v) =>
                      onChange({
                        ...draft,
                        states: replace(draft.states, j, v),
                      })
                    }
                    testId={`bayes-state-${j}`}
                    ariaLabel={`${t("dec.states")} ${j + 1}`}
                  />
                  {draft.states.length > 1 && (
                    <RemoveButton
                      onClick={() =>
                        onChange({
                          ...draft,
                          states: draft.states.filter((_, k) => k !== j),
                          priors: draft.priors.filter((_, k) => k !== j),
                          payoffs: draft.payoffs.map((row) =>
                            row.filter((_, k) => k !== j),
                          ),
                          likelihoods: draft.likelihoods.filter(
                            (_, k) => k !== j,
                          ),
                        })
                      }
                    />
                  )}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{t("dec.priors")}</th>
              {draft.priors.map((p, j) => (
                <td key={j}>
                  <Cell
                    value={p}
                    invalid={invalid.has(`prior-${j}`)}
                    onChange={(v) =>
                      onChange({
                        ...draft,
                        priors: replace(draft.priors, j, v),
                      })
                    }
                    testId={`bayes-prior-${j}`}
                  />
                </td>
              ))}
              <td />
            </tr>
            {draft.alternatives.map((a, i) => (
              <tr key={i}>
                <th scope="row">
                  <Cell
                    value={a}
                    invalid={invalid.has(`alt-${i}`)}
                    name
                    onChange={(v) =>
                      onChange({
                        ...draft,
                        alternatives: replace(draft.alternatives, i, v),
                      })
                    }
                    testId={`bayes-alt-${i}`}
                    ariaLabel={`${t("dec.alternatives")} ${i + 1}`}
                  />
                </th>
                {draft.payoffs[i]!.map((c, j) => (
                  <td key={j}>
                    <Cell
                      value={c}
                      invalid={invalid.has(`pay-${i}-${j}`)}
                      onChange={(v) =>
                        onChange({
                          ...draft,
                          payoffs: draft.payoffs.map((row, k) =>
                            k === i ? replace(row, j, v) : row,
                          ),
                        })
                      }
                      testId={`bayes-cell-${i}-${j}`}
                    />
                  </td>
                ))}
                <td>
                  {draft.alternatives.length > 1 && (
                    <RemoveButton
                      onClick={() =>
                        onChange({
                          ...draft,
                          alternatives: draft.alternatives.filter(
                            (_, k) => k !== i,
                          ),
                          payoffs: draft.payoffs.filter((_, k) => k !== i),
                        })
                      }
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onChange({
              ...draft,
              alternatives: [
                ...draft.alternatives,
                `A${draft.alternatives.length + 1}`,
              ],
              payoffs: [...draft.payoffs, draft.states.map(() => "0")],
            })
          }
        >
          {t("dec.addAlternative")}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onChange({
              ...draft,
              states: [...draft.states, `S${draft.states.length + 1}`],
              priors: [...draft.priors, "0"],
              payoffs: draft.payoffs.map((row) => [...row, "0"]),
              likelihoods: [
                ...draft.likelihoods,
                draft.indicators.map(() => "0"),
              ],
            })
          }
        >
          {t("dec.addState")}
        </button>
      </div>
      <h3>{t("dec.likelihoods")}</h3>
      <div className="table-scroll">
        <table className="data-table editor-grid">
          <thead>
            <tr>
              <th>
                {t("dec.states")} \ {t("dec.indicators")}
              </th>
              {draft.indicators.map((name, k) => (
                <th key={k}>
                  <Cell
                    value={name}
                    invalid={invalid.has(`ind-${k}`)}
                    name
                    onChange={(v) =>
                      onChange({
                        ...draft,
                        indicators: replace(draft.indicators, k, v),
                      })
                    }
                    testId={`bayes-indicator-${k}`}
                    ariaLabel={`${t("dec.indicators")} ${k + 1}`}
                  />
                  {draft.indicators.length > 1 && (
                    <RemoveButton
                      onClick={() =>
                        onChange({
                          ...draft,
                          indicators: draft.indicators.filter(
                            (_, m) => m !== k,
                          ),
                          likelihoods: draft.likelihoods.map((row) =>
                            row.filter((_, m) => m !== k),
                          ),
                        })
                      }
                    />
                  )}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {draft.states.map((s, j) => (
              <tr key={j}>
                <th scope="row">{s}</th>
                {draft.likelihoods[j]!.map((c, k) => (
                  <td key={k}>
                    <Cell
                      value={c}
                      invalid={invalid.has(`lik-${j}-${k}`)}
                      onChange={(v) =>
                        onChange({
                          ...draft,
                          likelihoods: draft.likelihoods.map((row, m) =>
                            m === j ? replace(row, k, v) : row,
                          ),
                        })
                      }
                      testId={`bayes-lik-${j}-${k}`}
                    />
                  </td>
                ))}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onChange({
              ...draft,
              indicators: [
                ...draft.indicators,
                `I${draft.indicators.length + 1}`,
              ],
              likelihoods: draft.likelihoods.map((row) => [...row, "0"]),
            })
          }
        >
          {t("dec.addIndicator")}
        </button>
      </div>
    </div>
  );
}

function TreeEditor({
  draft,
  invalid,
  onChange,
}: {
  draft: TreeDraft;
  invalid: Set<string>;
  onChange: (d: TreeDraft) => void;
}) {
  const ids = draft.nodes.map((n) => n.id);
  const setNode = (i: number, patch: Partial<TreeDraft["nodes"][number]>) =>
    onChange({
      ...draft,
      nodes: draft.nodes.map((n, k) => (k === i ? { ...n, ...patch } : n)),
    });
  const setBranch = (
    k: number,
    patch: Partial<TreeDraft["branches"][number]>,
  ) =>
    onChange({
      ...draft,
      branches: draft.branches.map((b, m) =>
        m === k ? { ...b, ...patch } : b,
      ),
    });
  const cls = (key: string) => `cell${invalid.has(key) ? " invalid" : ""}`;
  return (
    <div>
      <div className="options">
        <SenseSelect
          value={draft.sense}
          onChange={(sense) => onChange({ ...draft, sense })}
          testId="tree-sense"
        />
        <label>
          {t("dec.root")}
          <select
            className={invalid.has("root") ? "invalid" : ""}
            value={draft.root}
            onChange={(e) => onChange({ ...draft, root: e.target.value })}
            data-testid="tree-root"
          >
            {ids.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      </div>
      <h3>{t("dec.nodes")}</h3>
      <div className="table-scroll">
        <table className="data-table editor-grid">
          <thead>
            <tr>
              <th>{t("dec.node")}</th>
              <th>{t("dec.nodeKind")}</th>
              <th>{t("dec.label")}</th>
              <th>{t("dec.payoffValue")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {draft.nodes.map((n, i) => (
              <tr key={i}>
                <td>
                  <input
                    className={`${cls(`node-id-${i}`)} name`}
                    value={n.id}
                    onChange={(e) => setNode(i, { id: e.target.value })}
                    data-testid={`tree-node-id-${i}`}
                  />
                </td>
                <td>
                  <select
                    value={n.kind}
                    onChange={(e) =>
                      setNode(i, {
                        kind: e.target
                          .value as TreeDraft["nodes"][number]["kind"],
                      })
                    }
                    data-testid={`tree-node-kind-${i}`}
                  >
                    <option value="decision">{t("dec.decision")}</option>
                    <option value="chance">{t("dec.chance")}</option>
                    <option value="terminal">{t("dec.terminal")}</option>
                  </select>
                </td>
                <td>
                  <input
                    className="cell name"
                    value={n.label}
                    onChange={(e) => setNode(i, { label: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className={cls(`node-payoff-${i}`)}
                    value={n.payoff}
                    disabled={n.kind !== "terminal"}
                    onChange={(e) => setNode(i, { payoff: e.target.value })}
                    data-testid={`tree-node-payoff-${i}`}
                  />
                </td>
                <td>
                  {draft.nodes.length > 1 && (
                    <RemoveButton
                      onClick={() =>
                        onChange({
                          ...draft,
                          nodes: draft.nodes.filter((_, k) => k !== i),
                        })
                      }
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button
          type="button"
          className="secondary"
          onClick={() => {
            let k = draft.nodes.length + 1;
            while (ids.includes(`n${k}`)) {
              k += 1;
            }
            onChange({
              ...draft,
              nodes: [
                ...draft.nodes,
                { id: `n${k}`, kind: "terminal", label: "", payoff: "0" },
              ],
            });
          }}
          data-testid="tree-add-node"
        >
          {t("dec.addNode")}
        </button>
      </div>
      <h3>{t("dec.branches")}</h3>
      <div className="table-scroll">
        <table className="data-table editor-grid">
          <thead>
            <tr>
              <th>{t("dec.from")}</th>
              <th>{t("dec.to")}</th>
              <th>{t("dec.label")}</th>
              <th>{t("dec.probability")}</th>
              <th>{t("dec.branchPayoff")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {draft.branches.map((b, k) => (
              <tr key={k}>
                <td>
                  <select
                    className={invalid.has(`branch-from-${k}`) ? "invalid" : ""}
                    value={b.from}
                    onChange={(e) => setBranch(k, { from: e.target.value })}
                    data-testid={`tree-branch-from-${k}`}
                  >
                    {ids.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className={invalid.has(`branch-to-${k}`) ? "invalid" : ""}
                    value={b.to}
                    onChange={(e) => setBranch(k, { to: e.target.value })}
                    data-testid={`tree-branch-to-${k}`}
                  >
                    {ids.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="cell name"
                    value={b.label}
                    onChange={(e) => setBranch(k, { label: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className={cls(`branch-prob-${k}`)}
                    value={b.probability}
                    onChange={(e) =>
                      setBranch(k, { probability: e.target.value })
                    }
                    data-testid={`tree-branch-prob-${k}`}
                  />
                </td>
                <td>
                  <input
                    className={cls(`branch-payoff-${k}`)}
                    value={b.payoff}
                    onChange={(e) => setBranch(k, { payoff: e.target.value })}
                  />
                </td>
                <td>
                  {draft.branches.length > 1 && (
                    <RemoveButton
                      onClick={() =>
                        onChange({
                          ...draft,
                          branches: draft.branches.filter((_, m) => m !== k),
                        })
                      }
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onChange({
              ...draft,
              branches: [
                ...draft.branches,
                {
                  from: ids[0] ?? "",
                  to: ids[ids.length - 1] ?? "",
                  label: "",
                  probability: "",
                  payoff: "",
                },
              ],
            })
          }
          data-testid="tree-add-branch"
        >
          {t("dec.addBranch")}
        </button>
      </div>
    </div>
  );
}

function GameEditor({
  draft,
  invalid,
  onChange,
}: {
  draft: GameDraft;
  invalid: Set<string>;
  onChange: (d: GameDraft) => void;
}) {
  const replace = <T,>(list: T[], i: number, value: T) =>
    list.map((x, k) => (k === i ? value : x));
  return (
    <div>
      <div className="table-scroll">
        <table className="data-table editor-grid">
          <thead>
            <tr>
              <th>
                {t("dec.rows")} \ {t("dec.columns")}
              </th>
              {draft.columns.map((c, j) => (
                <th key={j}>
                  <Cell
                    value={c}
                    invalid={invalid.has(`col-${j}`)}
                    name
                    onChange={(v) =>
                      onChange({
                        ...draft,
                        columns: replace(draft.columns, j, v),
                      })
                    }
                    testId={`game-column-${j}`}
                    ariaLabel={`${t("dec.columns")} ${j + 1}`}
                  />
                  {draft.columns.length > 1 && (
                    <RemoveButton
                      onClick={() =>
                        onChange({
                          ...draft,
                          columns: draft.columns.filter((_, k) => k !== j),
                          matrix: draft.matrix.map((row) =>
                            row.filter((_, k) => k !== j),
                          ),
                        })
                      }
                    />
                  )}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((r, i) => (
              <tr key={i}>
                <th scope="row">
                  <Cell
                    value={r}
                    invalid={invalid.has(`row-${i}`)}
                    name
                    onChange={(v) =>
                      onChange({ ...draft, rows: replace(draft.rows, i, v) })
                    }
                    testId={`game-row-${i}`}
                    ariaLabel={`${t("dec.rows")} ${i + 1}`}
                  />
                </th>
                {draft.matrix[i]!.map((c, j) => (
                  <td key={j}>
                    <Cell
                      value={c}
                      invalid={invalid.has(`cell-${i}-${j}`)}
                      onChange={(v) =>
                        onChange({
                          ...draft,
                          matrix: draft.matrix.map((row, k) =>
                            k === i ? replace(row, j, v) : row,
                          ),
                        })
                      }
                      testId={`game-cell-${i}-${j}`}
                    />
                  </td>
                ))}
                <td>
                  {draft.rows.length > 1 && (
                    <RemoveButton
                      onClick={() =>
                        onChange({
                          ...draft,
                          rows: draft.rows.filter((_, k) => k !== i),
                          matrix: draft.matrix.filter((_, k) => k !== i),
                        })
                      }
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onChange({
              ...draft,
              rows: [...draft.rows, `F${draft.rows.length + 1}`],
              matrix: [...draft.matrix, draft.columns.map(() => "0")],
            })
          }
          data-testid="game-add-row"
        >
          {t("dec.addRow")}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onChange({
              ...draft,
              columns: [...draft.columns, `C${draft.columns.length + 1}`],
              matrix: draft.matrix.map((row) => [...row, "0"]),
            })
          }
          data-testid="game-add-column"
        >
          {t("dec.addColumn")}
        </button>
      </div>
    </div>
  );
}

export function DecisionModule() {
  const [kind, setKind] = useState<Kind>(initial.kind);
  const [drafts, setDrafts] = useState<Drafts>(initial.drafts);
  const [fileName, setFileName] = useState(initial.name);
  const [numberFormat, setNumberFormat] = useState<NumberFormat>("fraction");
  const [solved, setSolved] = useState<Solved | null>(null);
  const [tab, setTab] = useState<TabKey>("solution");
  const [notice, setNotice] = useState<string | null>(null);
  const number = makeFormatter(numberFormat);

  const built = useMemo(() => {
    if (kind === "payoff") {
      return buildPayoff(drafts.payoff);
    }
    if (kind === "bayes") {
      return buildBayes(drafts.bayes);
    }
    if (kind === "tree") {
      return buildTree(drafts.tree);
    }
    return buildGame(drafts.game);
  }, [kind, drafts]);

  const toFile = (): DecisionFile | null => {
    if (kind === "payoff") {
      const p = buildPayoff(drafts.payoff).value;
      return p ? { type: "payoff", problem: p } : null;
    }
    if (kind === "bayes") {
      const p = buildBayes(drafts.bayes).value;
      return p ? { type: "bayes", problem: p } : null;
    }
    if (kind === "tree") {
      const tree = buildTree(drafts.tree).value;
      return tree ? { type: "tree", tree } : null;
    }
    const g = buildGame(drafts.game).value;
    return g
      ? {
          type: "game",
          title: g.title,
          rows: g.rows,
          columns: g.columns,
          matrix: g.matrix,
        }
      : null;
  };

  const solve = () => {
    const file = toFile();
    if (!file) {
      setNotice(t("dec.invalid"));
      return;
    }
    try {
      if (file.type === "payoff") {
        setSolved({
          kind: "payoff",
          problem: file.problem,
          result: payoffAnalysis(file.problem),
        });
      } else if (file.type === "bayes") {
        setSolved({
          kind: "bayes",
          problem: file.problem,
          result: bayesAnalysis(file.problem),
        });
      } else if (file.type === "tree") {
        setSolved({
          kind: "tree",
          tree: file.tree,
          result: solveDecisionTree(file.tree),
        });
      } else {
        setSolved({
          kind: "game",
          problem: {
            title: file.title,
            rows: file.rows,
            columns: file.columns,
            matrix: file.matrix,
          },
          result: solveGame(file.matrix, {
            rows: file.rows,
            columns: file.columns,
          }),
        });
      }
      setNotice(null);
      setTab("solution");
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const applyFile = (file: DecisionFile, name: string) => {
    const loaded = fileToDrafts(file, drafts);
    setKind(loaded.kind);
    setDrafts(loaded.drafts);
    setFileName(name);
    setSolved(null);
    setNotice(null);
  };

  const loadExample = (id: string) => {
    const example = decisionExamples.find((e) => e.id === id);
    if (!example) {
      return;
    }
    try {
      applyFile(parseDecisionFile(example.text), `${example.id}.io.json`);
    } catch (e) {
      setNotice(e instanceof ParseError ? e.message : String(e));
    }
  };

  const openFile = async () => {
    try {
      const file = await openTextFile(["json"], t("file.filter"));
      if (file) {
        applyFile(parseDecisionFile(file.text), file.name);
      }
    } catch (e) {
      setNotice(e instanceof ParseError ? e.message : t("file.openError"));
    }
  };

  const saveFile = async () => {
    const file = toFile();
    if (!file) {
      setNotice(t("dec.invalid"));
      return;
    }
    try {
      await downloadText(
        serializeDecisionFile(file),
        fileName,
        "json",
        t("file.filter"),
      );
    } catch {
      setNotice(t("file.saveError"));
    }
  };

  const report = useMemo(() => {
    if (!solved) {
      return "";
    }
    const options = { numberFormat, decimals: DECIMALS };
    if (solved.kind === "payoff") {
      return reportPayoff(solved.problem, solved.result, options);
    }
    if (solved.kind === "bayes") {
      return reportBayes(solved.problem, solved.result, options);
    }
    if (solved.kind === "tree") {
      return reportDecisionTree(solved.tree, solved.result, options);
    }
    return reportGame(solved.result, options);
  }, [solved, numberFormat]);

  const status = useMemo(() => {
    if (!solved) {
      return "";
    }
    if (solved.kind === "payoff") {
      const r = solved.result;
      const p = solved.problem;
      if (r.expectedValue && r.evpi) {
        return `Valor esperado: ${p.alternatives[r.expectedValue.alternative]} con ${number(r.expectedValue.value)}. VEIP ${number(r.evpi)}`;
      }
      const optimistic = p.sense === "max" ? "Maximax" : "Minimin";
      const pessimistic = p.sense === "max" ? "Maximin" : "Minimax";
      return `${optimistic}: ${p.alternatives[r.maximax.alternative]} con ${number(r.maximax.value)}. ${pessimistic}: ${p.alternatives[r.maximin.alternative]} con ${number(r.maximin.value)}`;
    }
    if (solved.kind === "bayes") {
      return `VEIM ${number(solved.result.evsi)}, eficiencia ${number(solved.result.efficiency)}`;
    }
    if (solved.kind === "tree") {
      return solved.result.status === "ok"
        ? `Valor del árbol: ${number(solved.result.rootValue)}`
        : solved.result.messages.join(" ");
    }
    return `Valor del juego: ${number(solved.result.value)}`;
  }, [solved, number]);

  const invalid = built.invalid;
  const items: Array<{ key: TabKey; label: string; disabled?: boolean }> = [
    { key: "solution", label: t("tab.solution") },
    {
      key: "criteria",
      label: t("dec.criteria"),
      disabled: solved?.kind !== "payoff",
    },
    {
      key: "tree",
      label: t("dec.tree"),
      disabled: solved?.kind !== "tree" || solved.result.status !== "ok",
    },
    {
      key: "graphical",
      label: t("dec.graphical"),
      disabled: solved?.kind !== "game" || solved.result.graphical === null,
    },
  ];
  const activeTab: TabKey = items.find((i) => i.key === tab)?.disabled
    ? "solution"
    : tab;
  const statusClass =
    solved?.kind === "tree" && solved.result.status !== "ok"
      ? "status-infeasible"
      : "status-optimal";

  return (
    <div className="workspace" data-testid="decision-module">
      <section className="panel model-panel" aria-labelledby="decision-title">
        <header className="panel-header">
          <h2 id="decision-title">{t("module.decision")}</h2>
          <div className="toolbar">
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as Kind);
                setSolved(null);
                setNotice(null);
              }}
              aria-label={t("dec.kind")}
              data-testid="decision-kind"
            >
              <option value="payoff">{t("dec.payoff")}</option>
              <option value="bayes">{t("dec.bayes")}</option>
              <option value="tree">{t("dec.tree")}</option>
              <option value="game">{t("dec.game")}</option>
            </select>
            <select
              value=""
              onChange={(e) => loadExample(e.target.value)}
              aria-label={t("editor.examples")}
              data-testid="decision-examples"
            >
              <option value="" disabled>
                {t("editor.examplesChoose")}
              </option>
              {decisionExamples.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="secondary"
              onClick={() => void openFile()}
            >
              {t("editor.open")}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void saveFile()}
            >
              {t("editor.save")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={solve}
              data-testid="decision-solve"
            >
              {t("editor.solve")}
            </button>
          </div>
        </header>
        <div className="editor-area">
          {kind === "payoff" && (
            <PayoffEditor
              draft={drafts.payoff}
              invalid={invalid}
              onChange={(d) => setDrafts({ ...drafts, payoff: d })}
            />
          )}
          {kind === "bayes" && (
            <BayesEditor
              draft={drafts.bayes}
              invalid={invalid}
              onChange={(d) => setDrafts({ ...drafts, bayes: d })}
            />
          )}
          {kind === "tree" && (
            <TreeEditor
              draft={drafts.tree}
              invalid={invalid}
              onChange={(d) => setDrafts({ ...drafts, tree: d })}
            />
          )}
          {kind === "game" && (
            <GameEditor
              draft={drafts.game}
              invalid={invalid}
              onChange={(d) => setDrafts({ ...drafts, game: d })}
            />
          )}
        </div>
        <div className="options">
          <label>
            {t("options.numbers")}
            <select
              value={numberFormat}
              onChange={(e) => setNumberFormat(e.target.value as NumberFormat)}
            >
              <option value="fraction">{t("options.fraction")}</option>
              <option value="decimal">{t("options.decimal")}</option>
            </select>
          </label>
        </div>
        {notice !== null && (
          <p
            className="editor-error"
            role="alert"
            data-testid="decision-notice"
          >
            {notice}
          </p>
        )}
      </section>
      <section
        className="panel results-panel"
        aria-labelledby="decision-results-title"
      >
        <header className="panel-header">
          <h2 id="decision-results-title">{t("results.title")}</h2>
        </header>
        {solved === null ? (
          <p className="empty">{t("results.empty")}</p>
        ) : (
          <Tabs<TabKey>
            items={items}
            active={activeTab}
            onChange={setTab}
            idPrefix="decision"
          >
            {activeTab === "solution" && (
              <div>
                <p
                  className={`status ${statusClass}`}
                  data-testid="decision-status"
                >
                  {status}
                </p>
                <pre className="report" data-testid="decision-report">
                  {report}
                </pre>
              </div>
            )}
            {activeTab === "criteria" && solved.kind === "payoff" && (
              <div>
                <h3>{t("dec.criteria")}</h3>
                <div className="table-scroll">
                  <table
                    className="data-table numeric"
                    data-testid="decision-criteria"
                  >
                    <thead>
                      <tr>
                        <th>{t("dec.criteria")}</th>
                        <th>{t("dec.alternatives")}</th>
                        <th>{t("sens.value")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          [
                            solved.problem.sense === "max"
                              ? "Maximax"
                              : "Minimin",
                            solved.result.maximax,
                          ],
                          [
                            solved.problem.sense === "max"
                              ? "Maximin"
                              : "Minimax",
                            solved.result.maximin,
                          ],
                          ["Laplace", solved.result.laplace],
                          [
                            `Hurwicz (α = ${number(solved.problem.alpha)})`,
                            solved.result.hurwicz,
                          ],
                          ["Savage", solved.result.savage],
                          ...(solved.result.expectedValue
                            ? [
                                [
                                  "Valor esperado",
                                  solved.result.expectedValue,
                                ] as const,
                              ]
                            : []),
                          ...(solved.result.expectedRegret
                            ? [
                                [
                                  "Arrepentimiento esperado",
                                  solved.result.expectedRegret,
                                ] as const,
                              ]
                            : []),
                        ] as Array<
                          [
                            string,
                            {
                              alternative: number;
                              value: import("@libreio/core").Fraction;
                            },
                          ]
                        >
                      ).map(([label, choice]) => (
                        <tr key={label}>
                          <th scope="row">{label}</th>
                          <td className="text">
                            {solved.problem.alternatives[choice.alternative]}
                          </td>
                          <td>{number(choice.value)}</td>
                        </tr>
                      ))}
                      {solved.result.evwpi && solved.result.evpi && (
                        <>
                          <tr>
                            <th scope="row">
                              Valor esperado con información perfecta
                            </th>
                            <td className="text" />
                            <td>{number(solved.result.evwpi)}</td>
                          </tr>
                          <tr>
                            <th scope="row">VEIP</th>
                            <td className="text" />
                            <td data-testid="decision-evpi">
                              {number(solved.result.evpi)}
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
                <h3>{t("dec.regrets")}</h3>
                <div className="table-scroll">
                  <table
                    className="data-table numeric"
                    data-testid="decision-regrets"
                  >
                    <thead>
                      <tr>
                        <th />
                        {solved.problem.states.map((s) => (
                          <th key={s}>{s}</th>
                        ))}
                        <th>Máximo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {solved.problem.alternatives.map((a, i) => (
                        <tr
                          key={a}
                          className={
                            i === solved.result.savage.alternative
                              ? "critical-row"
                              : ""
                          }
                        >
                          <th scope="row">{a}</th>
                          {solved.result.savage.regrets[i]!.map((v, j) => (
                            <td key={j}>{number(v)}</td>
                          ))}
                          <td>{number(solved.result.savage.values[i]!)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === "tree" && solved.kind === "tree" && (
              <TreeView
                tree={solved.tree}
                result={solved.result}
                number={number}
              />
            )}
            {activeTab === "graphical" && solved.kind === "game" && (
              <GameChart result={solved.result} number={number} />
            )}
          </Tabs>
        )}
      </section>
    </div>
  );
}
