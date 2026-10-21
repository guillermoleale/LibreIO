// SPDX-License-Identifier: GPL-3.0-or-later
// Editores de matriz para transporte y asignación y de nodos y arcos para transbordo.
import { t } from "../i18n";
import type {
  AssignmentDraft,
  TransportDraft,
  TransshipmentDraft,
} from "./drafts";

interface MatrixEditorProps {
  readonly rowLabel: string;
  readonly columnLabel: string;
  readonly rows: string[];
  readonly columns: string[];
  readonly cells: string[][];
  readonly rowTotals: string[] | null;
  readonly columnTotals: string[] | null;
  readonly rowTotalLabel: string;
  readonly columnTotalLabel: string;
  readonly invalid: Set<string>;
  readonly keys: {
    row: string;
    column: string;
    cell: string;
    rowTotal: string;
    columnTotal: string;
  };
  readonly onChange: (next: {
    rows: string[];
    columns: string[];
    cells: string[][];
    rowTotals: string[] | null;
    columnTotals: string[] | null;
  }) => void;
  readonly addRowLabel: string;
  readonly addColumnLabel: string;
  readonly testPrefix: string;
}

export function MatrixEditor(props: MatrixEditorProps) {
  const {
    rows,
    columns,
    cells,
    rowTotals,
    columnTotals,
    invalid,
    keys,
    onChange,
    testPrefix,
  } = props;
  const cls = (key: string) => `cell${invalid.has(key) ? " invalid" : ""}`;
  const emit = (
    patch: Partial<{
      rows: string[];
      columns: string[];
      cells: string[][];
      rowTotals: string[] | null;
      columnTotals: string[] | null;
    }>,
  ) => onChange({ rows, columns, cells, rowTotals, columnTotals, ...patch });
  return (
    <div className="matrix-editor">
      <div className="table-scroll">
        <table className="data-table editor-grid">
          <thead>
            <tr>
              <th>
                {props.rowLabel} \ {props.columnLabel}
              </th>
              {columns.map((c, j) => (
                <th key={j}>
                  <input
                    className={`${cls(`${keys.column}-${j}`)} name`}
                    value={c}
                    onChange={(e) =>
                      emit({
                        columns: columns.map((x, k) =>
                          k === j ? e.target.value : x,
                        ),
                      })
                    }
                    aria-label={`${props.columnLabel} ${j + 1}`}
                    data-testid={`${testPrefix}-column-${j}`}
                  />
                  {columns.length > 1 && (
                    <button
                      type="button"
                      className="icon"
                      title={t("table.remove")}
                      onClick={() =>
                        emit({
                          columns: columns.filter((_, k) => k !== j),
                          cells: cells.map((row) =>
                            row.filter((_, k) => k !== j),
                          ),
                          columnTotals: columnTotals
                            ? columnTotals.filter((_, k) => k !== j)
                            : null,
                        })
                      }
                    >
                      ×
                    </button>
                  )}
                </th>
              ))}
              {rowTotals && <th>{props.rowTotalLabel}</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <th scope="row">
                  <input
                    className={`${cls(`${keys.row}-${i}`)} name`}
                    value={r}
                    onChange={(e) =>
                      emit({
                        rows: rows.map((x, k) =>
                          k === i ? e.target.value : x,
                        ),
                      })
                    }
                    aria-label={`${props.rowLabel} ${i + 1}`}
                    data-testid={`${testPrefix}-row-${i}`}
                  />
                </th>
                {cells[i]!.map((c, j) => (
                  <td key={j}>
                    <input
                      className={cls(`${keys.cell}-${i}-${j}`)}
                      value={c}
                      onChange={(e) =>
                        emit({
                          cells: cells.map((row, k) =>
                            k === i
                              ? row.map((x, m) =>
                                  m === j ? e.target.value : x,
                                )
                              : row,
                          ),
                        })
                      }
                      data-testid={`${testPrefix}-cell-${i}-${j}`}
                    />
                  </td>
                ))}
                {rowTotals && (
                  <td>
                    <input
                      className={cls(`${keys.rowTotal}-${i}`)}
                      value={rowTotals[i] ?? ""}
                      onChange={(e) =>
                        emit({
                          rowTotals: rowTotals.map((x, k) =>
                            k === i ? e.target.value : x,
                          ),
                        })
                      }
                      data-testid={`${testPrefix}-supply-${i}`}
                    />
                  </td>
                )}
                <td>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className="icon"
                      title={t("table.remove")}
                      onClick={() =>
                        emit({
                          rows: rows.filter((_, k) => k !== i),
                          cells: cells.filter((_, k) => k !== i),
                          rowTotals: rowTotals
                            ? rowTotals.filter((_, k) => k !== i)
                            : null,
                        })
                      }
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {columnTotals && (
              <tr>
                <th scope="row">{props.columnTotalLabel}</th>
                {columnTotals.map((d, j) => (
                  <td key={j}>
                    <input
                      className={cls(`${keys.columnTotal}-${j}`)}
                      value={d}
                      onChange={(e) =>
                        emit({
                          columnTotals: columnTotals.map((x, k) =>
                            k === j ? e.target.value : x,
                          ),
                        })
                      }
                      data-testid={`${testPrefix}-demand-${j}`}
                    />
                  </td>
                ))}
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            emit({
              rows: [
                ...rows,
                `${props.rowLabel.slice(0, 1)}${rows.length + 1}`,
              ],
              cells: [...cells, columns.map(() => "0")],
              rowTotals: rowTotals ? [...rowTotals, "0"] : null,
            })
          }
          data-testid={`${testPrefix}-add-row`}
        >
          {props.addRowLabel}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            emit({
              columns: [
                ...columns,
                `${props.columnLabel.slice(0, 1)}${columns.length + 1}`,
              ],
              cells: cells.map((row) => [...row, "0"]),
              columnTotals: columnTotals ? [...columnTotals, "0"] : null,
            })
          }
          data-testid={`${testPrefix}-add-column`}
        >
          {props.addColumnLabel}
        </button>
        <span className="hint">{t("transport.prohibitedHint")}</span>
      </div>
    </div>
  );
}

export function TransportEditor({
  draft,
  invalid,
  onChange,
}: {
  draft: TransportDraft;
  invalid: Set<string>;
  onChange: (d: TransportDraft) => void;
}) {
  return (
    <MatrixEditor
      rowLabel={t("transport.source")}
      columnLabel={t("transport.destination")}
      rows={draft.sources}
      columns={draft.destinations}
      cells={draft.costs}
      rowTotals={draft.supply}
      columnTotals={draft.demand}
      rowTotalLabel={t("transport.supply")}
      columnTotalLabel={t("transport.demand")}
      invalid={invalid}
      keys={{
        row: "source",
        column: "destination",
        cell: "cost",
        rowTotal: "supply",
        columnTotal: "demand",
      }}
      addRowLabel={t("transport.addSource")}
      addColumnLabel={t("transport.addDestination")}
      testPrefix="tr"
      onChange={(next) =>
        onChange({
          ...draft,
          sources: next.rows,
          destinations: next.columns,
          costs: next.cells,
          supply: next.rowTotals ?? draft.supply,
          demand: next.columnTotals ?? draft.demand,
        })
      }
    />
  );
}

export function AssignmentEditor({
  draft,
  invalid,
  onChange,
}: {
  draft: AssignmentDraft;
  invalid: Set<string>;
  onChange: (d: AssignmentDraft) => void;
}) {
  return (
    <MatrixEditor
      rowLabel={t("transport.agent")}
      columnLabel={t("transport.task")}
      rows={draft.agents}
      columns={draft.tasks}
      cells={draft.costs}
      rowTotals={null}
      columnTotals={null}
      rowTotalLabel=""
      columnTotalLabel=""
      invalid={invalid}
      keys={{
        row: "agent",
        column: "task",
        cell: "cost",
        rowTotal: "",
        columnTotal: "",
      }}
      addRowLabel={t("transport.addAgent")}
      addColumnLabel={t("transport.addTask")}
      testPrefix="as"
      onChange={(next) =>
        onChange({
          ...draft,
          agents: next.rows,
          tasks: next.columns,
          costs: next.cells,
        })
      }
    />
  );
}

export function TransshipmentEditor({
  draft,
  invalid,
  onChange,
}: {
  draft: TransshipmentDraft;
  invalid: Set<string>;
  onChange: (d: TransshipmentDraft) => void;
}) {
  const cls = (key: string) => `cell${invalid.has(key) ? " invalid" : ""}`;
  const names = draft.nodes.map((n) => n.name);
  return (
    <div className="transshipment-editor">
      <h3>{t("transport.nodes")}</h3>
      <div className="table-scroll">
        <table className="data-table editor-grid">
          <thead>
            <tr>
              <th>{t("transport.node")}</th>
              <th>{t("transport.supply")}</th>
              <th>{t("transport.demand")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {draft.nodes.map((n, i) => (
              <tr key={i}>
                <td>
                  <input
                    className={`${cls(`node-${i}`)} name`}
                    value={n.name}
                    onChange={(e) => {
                      const oldName = n.name;
                      onChange({
                        ...draft,
                        nodes: draft.nodes.map((x, k) =>
                          k === i ? { ...x, name: e.target.value } : x,
                        ),
                        arcs: draft.arcs.map((a) => ({
                          ...a,
                          from: a.from === oldName ? e.target.value : a.from,
                          to: a.to === oldName ? e.target.value : a.to,
                        })),
                      });
                    }}
                    data-testid={`ts-node-${i}`}
                  />
                </td>
                <td>
                  <input
                    className={cls(`node-supply-${i}`)}
                    value={n.supply}
                    onChange={(e) =>
                      onChange({
                        ...draft,
                        nodes: draft.nodes.map((x, k) =>
                          k === i ? { ...x, supply: e.target.value } : x,
                        ),
                      })
                    }
                    data-testid={`ts-supply-${i}`}
                  />
                </td>
                <td>
                  <input
                    className={cls(`node-demand-${i}`)}
                    value={n.demand}
                    onChange={(e) =>
                      onChange({
                        ...draft,
                        nodes: draft.nodes.map((x, k) =>
                          k === i ? { ...x, demand: e.target.value } : x,
                        ),
                      })
                    }
                    data-testid={`ts-demand-${i}`}
                  />
                </td>
                <td>
                  {draft.nodes.length > 2 && (
                    <button
                      type="button"
                      className="icon"
                      title={t("table.remove")}
                      onClick={() =>
                        onChange({
                          ...draft,
                          nodes: draft.nodes.filter((_, k) => k !== i),
                        })
                      }
                    >
                      ×
                    </button>
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
              nodes: [
                ...draft.nodes,
                { name: `N${draft.nodes.length + 1}`, supply: "", demand: "" },
              ],
            })
          }
          data-testid="ts-add-node"
        >
          {t("transport.addNode")}
        </button>
      </div>
      <h3>{t("transport.arcs")}</h3>
      <div className="table-scroll">
        <table className="data-table editor-grid">
          <thead>
            <tr>
              <th>{t("transport.from")}</th>
              <th>{t("transport.to")}</th>
              <th>{t("transport.cost")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {draft.arcs.map((a, k) => (
              <tr key={k}>
                <td>
                  <select
                    className={cls(`arc-from-${k}`)}
                    value={a.from}
                    onChange={(e) =>
                      onChange({
                        ...draft,
                        arcs: draft.arcs.map((x, m) =>
                          m === k ? { ...x, from: e.target.value } : x,
                        ),
                      })
                    }
                    data-testid={`ts-arc-from-${k}`}
                  >
                    {names.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className={cls(`arc-to-${k}`)}
                    value={a.to}
                    onChange={(e) =>
                      onChange({
                        ...draft,
                        arcs: draft.arcs.map((x, m) =>
                          m === k ? { ...x, to: e.target.value } : x,
                        ),
                      })
                    }
                    data-testid={`ts-arc-to-${k}`}
                  >
                    {names.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className={cls(`arc-cost-${k}`)}
                    value={a.cost}
                    onChange={(e) =>
                      onChange({
                        ...draft,
                        arcs: draft.arcs.map((x, m) =>
                          m === k ? { ...x, cost: e.target.value } : x,
                        ),
                      })
                    }
                    data-testid={`ts-arc-cost-${k}`}
                  />
                </td>
                <td>
                  {draft.arcs.length > 1 && (
                    <button
                      type="button"
                      className="icon"
                      title={t("table.remove")}
                      onClick={() =>
                        onChange({
                          ...draft,
                          arcs: draft.arcs.filter((_, m) => m !== k),
                        })
                      }
                    >
                      ×
                    </button>
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
              arcs: [
                ...draft.arcs,
                {
                  from: names[0] ?? "",
                  to: names[1] ?? names[0] ?? "",
                  cost: "1",
                },
              ],
            })
          }
          data-testid="ts-add-arc"
        >
          {t("transport.addArc")}
        </button>
      </div>
    </div>
  );
}
