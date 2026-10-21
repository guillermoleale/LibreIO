// SPDX-License-Identifier: GPL-3.0-or-later
// Módulo de cadenas de Markov: matriz de transición editable, clasificación, estado estable,
// distribución en n pasos, tiempos de primer paso y análisis de estados absorbentes.
import { useMemo, useState } from "react";
import {
  Fraction,
  ParseError,
  markovChain,
  parseMarkovFile,
  reportMarkov,
  serializeMarkovFile,
  type MarkovFile,
  type MarkovProblem,
  type MarkovResult,
} from "@libreio/core";
import { t } from "../i18n";
import { markovExamples } from "../common/examples";
import { downloadText } from "../common/download";
import { openTextFile } from "../common/files";
import {
  DECIMALS,
  makeFormatter,
  type NumberFormat,
} from "../common/numberFormat";
import { Tabs } from "../common/Tabs";

type TabKey = "solution" | "distribution" | "passage" | "absorbing";

interface Draft {
  title: string;
  states: string[];
  matrix: string[][];
  initial: string[];
  steps: string;
}

interface Solved {
  readonly problem: MarkovProblem;
  readonly result: MarkovResult;
  readonly initial: Fraction[];
  readonly steps: number;
}

const defaultDraft: Draft = {
  title: "",
  states: ["E1", "E2"],
  matrix: [
    ["1/2", "1/2"],
    ["1/2", "1/2"],
  ],
  initial: ["1", "0"],
  steps: "5",
};

function toDraft(file: MarkovFile): Draft {
  const p = file.problem;
  return {
    title: p.title ?? "",
    states: [...p.states],
    matrix: p.matrix.map((row) => row.map((v) => v.toString())),
    initial: file.initial
      ? file.initial.map((v) => v.toString())
      : p.states.map((_, i) => (i === 0 ? "1" : "0")),
    steps: String(file.steps ?? 5),
  };
}

function build(d: Draft): { file: MarkovFile | null; invalid: Set<string> } {
  const invalid = new Set<string>();
  const num = (text: string, key: string): Fraction => {
    try {
      const v = Fraction.parse(text.trim());
      if (v.isNegative()) {
        invalid.add(key);
      }
      return v;
    } catch {
      invalid.add(key);
      return Fraction.ZERO;
    }
  };
  const states = d.states.map((s, i) => {
    const name = s.trim();
    if (name === "" || d.states.findIndex((x) => x.trim() === name) !== i) {
      invalid.add(`state-${i}`);
    }
    return name;
  });
  const matrix = d.matrix.map((row, i) => {
    const values = row.map((v, j) => num(v, `cell-${i}-${j}`));
    if (!Fraction.sum(values).eq(Fraction.ONE)) {
      invalid.add(`row-${i}`);
      values.forEach((_, j) => invalid.add(`cell-${i}-${j}`));
    }
    return values;
  });
  const initial = d.initial.map((v, i) => num(v, `initial-${i}`));
  if (!Fraction.sum(initial).eq(Fraction.ONE)) {
    initial.forEach((_, i) => invalid.add(`initial-${i}`));
  }
  const steps = Number(d.steps.trim());
  if (!Number.isInteger(steps) || steps < 0 || steps > 200) {
    invalid.add("steps");
  }
  if (states.length === 0) {
    invalid.add("empty");
  }
  return {
    file:
      invalid.size > 0
        ? null
        : {
            problem: {
              title: d.title.trim() === "" ? null : d.title.trim(),
              states,
              matrix,
            },
            initial,
            steps,
          },
    invalid,
  };
}

const initialExample = markovExamples.find((e) => e.id.startsWith("MK-01"));

function MatrixTable({
  states,
  rows,
  number,
  columns,
  testId,
}: {
  states: string[];
  rows: Fraction[][];
  number: (f: Fraction) => string;
  columns?: string[];
  testId?: string;
}) {
  const cols = columns ?? states;
  return (
    <div className="table-scroll">
      <table className="data-table numeric" data-testid={testId}>
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <th scope="row">{states[i]}</th>
              {row.map((v, j) => (
                <td key={j}>{number(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarkovModule() {
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      return initialExample
        ? toDraft(parseMarkovFile(initialExample.text))
        : defaultDraft;
    } catch {
      return defaultDraft;
    }
  });
  const [fileName, setFileName] = useState(
    initialExample ? `${initialExample.id}.io.json` : "markov.io.json",
  );
  const [numberFormat, setNumberFormat] = useState<NumberFormat>("fraction");
  const [solved, setSolved] = useState<Solved | null>(null);
  const [tab, setTab] = useState<TabKey>("solution");
  const [notice, setNotice] = useState<string | null>(null);
  const number = makeFormatter(numberFormat);
  const built = useMemo(() => build(draft), [draft]);
  const cls = (key: string) =>
    `cell${built.invalid.has(key) ? " invalid" : ""}`;

  const applyFile = (file: MarkovFile, name: string) => {
    setDraft(toDraft(file));
    setFileName(name);
    setSolved(null);
    setNotice(null);
  };

  const loadExample = (id: string) => {
    const example = markovExamples.find((e) => e.id === id);
    if (!example) {
      return;
    }
    try {
      applyFile(parseMarkovFile(example.text), `${example.id}.io.json`);
    } catch (e) {
      setNotice(e instanceof ParseError ? e.message : String(e));
    }
  };

  const openFile = async () => {
    try {
      const file = await openTextFile(["json"], t("file.filter"));
      if (file) {
        applyFile(parseMarkovFile(file.text), file.name);
      }
    } catch (e) {
      setNotice(e instanceof ParseError ? e.message : t("file.openError"));
    }
  };

  const saveFile = async () => {
    if (!built.file) {
      setNotice(t("mk.invalid"));
      return;
    }
    await downloadText(
      serializeMarkovFile(built.file),
      fileName,
      "json",
      t("file.filter"),
    );
  };

  const solve = () => {
    if (!built.file) {
      setNotice(t("mk.invalid"));
      return;
    }
    try {
      const result = markovChain(built.file.problem);
      setSolved({
        problem: built.file.problem,
        result,
        initial: built.file.initial ?? [],
        steps: built.file.steps ?? 5,
      });
      setNotice(null);
      setTab("solution");
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const addState = () => {
    const n = draft.states.length + 1;
    let name = `E${n}`;
    let k = n;
    while (draft.states.includes(name)) {
      k += 1;
      name = `E${k}`;
    }
    setDraft({
      ...draft,
      states: [...draft.states, name],
      matrix: [
        ...draft.matrix.map((row) => [...row, "0"]),
        [...draft.states.map(() => "0"), "1"],
      ],
      initial: [...draft.initial, "0"],
    });
  };

  const removeState = (i: number) => {
    setDraft({
      ...draft,
      states: draft.states.filter((_, k) => k !== i),
      matrix: draft.matrix
        .filter((_, k) => k !== i)
        .map((row) => row.filter((_, k) => k !== i)),
      initial: draft.initial.filter((_, k) => k !== i),
    });
  };

  const report = useMemo(() => {
    if (!solved) {
      return "";
    }
    return reportMarkov(solved.problem, solved.result, {
      numberFormat,
      decimals: DECIMALS,
      steps: solved.steps,
      initial: solved.initial,
    });
  }, [solved, numberFormat]);

  const status = useMemo(() => {
    if (!solved) {
      return "";
    }
    const r = solved.result;
    const vector = (v: Fraction[]) => `(${v.map(number).join(", ")})`;
    if (r.regular && r.steadyState) {
      return `${t("mk.steadyState")}: ${vector(r.steadyState)}`;
    }
    if (r.periodic && r.stationary) {
      return `Cadena ${t("mk.periodic")}. ${t("mk.stationary")}: ${vector(r.stationary)}`;
    }
    if (r.absorbingStates.length > 0) {
      return `${t("mk.absorbing")}: ${r.absorbingStates.join(", ")}`;
    }
    return `Cadena ${t("mk.notIrreducible")}: ${r.classes.length} clases de comunicación`;
  }, [solved, number]);

  const distributions = useMemo(() => {
    if (!solved) {
      return [] as Array<{ n: number; values: Fraction[] }>;
    }
    const rows: Array<{ n: number; values: Fraction[] }> = [];
    for (let n = 0; n <= solved.steps; n += 1) {
      rows.push({
        n,
        values: solved.result.distributionAfter(solved.initial, n),
      });
    }
    return rows;
  }, [solved]);

  return (
    <div className="workspace" data-testid="markov-module">
      <section className="panel model-panel" aria-labelledby="markov-title">
        <header className="panel-header">
          <h2 id="markov-title">{t("module.markov")}</h2>
          <div className="toolbar">
            <select
              value=""
              onChange={(e) => loadExample(e.target.value)}
              aria-label={t("editor.examples")}
              data-testid="markov-examples"
            >
              <option value="" disabled>
                {t("editor.examplesChoose")}
              </option>
              {markovExamples.map((e) => (
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
              data-testid="markov-solve"
            >
              {t("editor.solve")}
            </button>
          </div>
        </header>
        <div className="editor-area">
          <h3>{t("mk.matrix")}</h3>
          <div className="table-scroll">
            <table className="data-table editor-grid">
              <thead>
                <tr>
                  <th>{t("mk.states")}</th>
                  {draft.states.map((s, j) => (
                    <th key={j}>{s || `E${j + 1}`}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {draft.states.map((s, i) => (
                  <tr
                    key={i}
                    className={
                      built.invalid.has(`row-${i}`) ? "invalid-row" : ""
                    }
                  >
                    <th scope="row">
                      <input
                        className={`${cls(`state-${i}`)} name`}
                        value={s}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            states: draft.states.map((x, k) =>
                              k === i ? e.target.value : x,
                            ),
                          })
                        }
                        aria-label={`${t("mk.states")} ${i + 1}`}
                        data-testid={`markov-state-${i}`}
                      />
                    </th>
                    {draft.matrix[i]!.map((v, j) => (
                      <td key={j}>
                        <input
                          className={cls(`cell-${i}-${j}`)}
                          value={v}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              matrix: draft.matrix.map((row, a) =>
                                a === i
                                  ? row.map((x, b) =>
                                      b === j ? e.target.value : x,
                                    )
                                  : row,
                              ),
                            })
                          }
                          data-testid={`markov-cell-${i}-${j}`}
                        />
                      </td>
                    ))}
                    <td>
                      {draft.states.length > 1 && (
                        <button
                          type="button"
                          className="icon"
                          title={t("table.remove")}
                          onClick={() => removeState(i)}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr>
                  <th scope="row">{t("mk.initial")}</th>
                  {draft.initial.map((v, i) => (
                    <td key={i}>
                      <input
                        className={cls(`initial-${i}`)}
                        value={v}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            initial: draft.initial.map((x, k) =>
                              k === i ? e.target.value : x,
                            ),
                          })
                        }
                        data-testid={`markov-initial-${i}`}
                      />
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="toolbar">
            <button
              type="button"
              className="secondary"
              onClick={addState}
              data-testid="markov-add-state"
            >
              {t("mk.addState")}
            </button>
            <label>
              {t("mk.steps")}
              <input
                className={`short${built.invalid.has("steps") ? " invalid" : ""}`}
                value={draft.steps}
                onChange={(e) => setDraft({ ...draft, steps: e.target.value })}
                data-testid="markov-steps"
              />
            </label>
          </div>
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
          <p className="editor-error" role="alert" data-testid="markov-notice">
            {notice}
          </p>
        )}
      </section>
      <section
        className="panel results-panel"
        aria-labelledby="markov-results-title"
      >
        <header className="panel-header">
          <h2 id="markov-results-title">{t("results.title")}</h2>
        </header>
        {solved === null ? (
          <p className="empty">{t("results.empty")}</p>
        ) : (
          <Tabs<TabKey>
            items={[
              { key: "solution", label: t("tab.solution") },
              { key: "distribution", label: t("mk.distribution") },
              {
                key: "passage",
                label: t("mk.firstPassage"),
                disabled: solved.result.meanFirstPassage === null,
              },
              {
                key: "absorbing",
                label: t("mk.absorbing"),
                disabled: solved.result.absorbing === null,
              },
            ]}
            active={tab}
            onChange={setTab}
            idPrefix="markov"
          >
            {tab === "solution" && (
              <div>
                <p
                  className="status status-optimal"
                  data-testid="markov-status"
                >
                  {status}
                </p>
                <p className="hint">
                  {t("mk.classification")}:{" "}
                  {solved.result.classes
                    .map(
                      (c) =>
                        `{${c.states.join(", ")}} ${c.recurrent ? "recurrente" : "transitoria"}`,
                    )
                    .join("; ")}
                  {solved.result.period !== null
                    ? ` · período ${solved.result.period}`
                    : ""}
                </p>
                <pre className="report" data-testid="markov-report">
                  {report}
                </pre>
              </div>
            )}
            {tab === "distribution" && (
              <div data-testid="markov-distribution">
                <h3>{t("mk.distribution")}</h3>
                <div className="table-scroll">
                  <table className="data-table numeric">
                    <thead>
                      <tr>
                        <th>n</th>
                        {solved.result.states.map((s) => (
                          <th key={s}>{s}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {distributions.map((row) => (
                        <tr key={row.n}>
                          <th scope="row">{row.n}</th>
                          {row.values.map((v, j) => (
                            <td key={j}>{number(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3>
                  P<sup>{solved.steps}</sup>
                </h3>
                <MatrixTable
                  states={solved.result.states}
                  rows={solved.result.power(solved.steps)}
                  number={number}
                />
              </div>
            )}
            {tab === "passage" && solved.result.meanFirstPassage && (
              <div>
                <h3>{t("mk.firstPassage")}</h3>
                <MatrixTable
                  states={solved.result.states}
                  rows={solved.result.meanFirstPassage}
                  number={number}
                  testId="markov-passage"
                />
                <p className="hint">
                  {t("mk.recurrence")}:{" "}
                  {solved.result.states
                    .map(
                      (s, i) =>
                        `${s} = ${number(solved.result.recurrenceTimes![i]!)}`,
                    )
                    .join(", ")}
                </p>
              </div>
            )}
            {tab === "absorbing" && solved.result.absorbing && (
              <div data-testid="markov-absorbing">
                <h3>N = (I - Q)⁻¹</h3>
                <MatrixTable
                  states={solved.result.absorbing.transient}
                  rows={solved.result.absorbing.N}
                  number={number}
                />
                <h3>B = N R</h3>
                <MatrixTable
                  states={solved.result.absorbing.transient}
                  rows={solved.result.absorbing.B}
                  number={number}
                  columns={solved.result.absorbing.absorbing}
                />
                <p className="hint">
                  Pasos esperados hasta la absorción:{" "}
                  {solved.result.absorbing.transient
                    .map(
                      (s, i) =>
                        `${s} = ${number(solved.result.absorbing!.expectedSteps[i]!)}`,
                    )
                    .join(", ")}
                </p>
              </div>
            )}
          </Tabs>
        )}
      </section>
    </div>
  );
}
