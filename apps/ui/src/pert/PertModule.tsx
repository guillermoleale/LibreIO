// SPDX-License-Identifier: GPL-3.0-or-later
// Módulo PERT/CPM: tabla de actividades, tiempos, red de actividades en nodos, Gantt, probabilidades y compresión.
import { useMemo, useState } from "react";
import {
  Fraction,
  ParseError,
  cpm,
  crashing,
  parseProjectFile,
  pert,
  reportCpm,
  reportCrashing,
  reportPert,
  serializeProjectFile,
  type Activity,
  type CpmResult,
  type CrashingResult,
  type PertResult,
  type ProjectProblem,
} from "@libreio/core";
import { t } from "../i18n";
import { projectExamples } from "../common/examples";
import { downloadText } from "../common/download";
import { openTextFile } from "../common/files";
import {
  DECIMALS,
  makeFormatter,
  type NumberFormat,
} from "../common/numberFormat";
import { Tabs } from "../common/Tabs";
import { ActivityNetwork, CostCurve, Gantt } from "./diagrams";

type TabKey = "solution" | "times" | "network" | "gantt" | "pert" | "crashing";

interface Row {
  id: string;
  name: string;
  predecessors: string;
  duration: string;
  optimistic: string;
  mostLikely: string;
  pessimistic: string;
  crashDuration: string;
  crashCostPerUnit: string;
}

interface Solved {
  readonly problem: ProjectProblem;
  readonly cpm: CpmResult;
  readonly pert: PertResult | null;
  readonly crashing: CrashingResult | null;
}

const text = (f: Fraction | undefined) => (f === undefined ? "" : f.toString());

function toRows(p: ProjectProblem): Row[] {
  return p.activities.map((a) => ({
    id: a.id,
    name: a.name ?? "",
    predecessors: a.predecessors.join(", "),
    duration: a.duration.toString(),
    optimistic: text(a.optimistic),
    mostLikely: text(a.mostLikely),
    pessimistic: text(a.pessimistic),
    crashDuration: text(a.crashDuration),
    crashCostPerUnit: text(a.crashCostPerUnit),
  }));
}

function build(
  title: string,
  rows: Row[],
): { problem: ProjectProblem | null; invalid: Set<string> } {
  const invalid = new Set<string>();
  const ids = rows.map((r) => r.id.trim());
  const parse = (
    value: string,
    key: string,
    required: boolean,
  ): Fraction | undefined => {
    if (value.trim() === "") {
      if (required) {
        invalid.add(key);
      }
      return undefined;
    }
    try {
      const f = Fraction.parse(value.trim());
      if (f.isNegative()) {
        invalid.add(key);
      }
      return f;
    } catch {
      invalid.add(key);
      return undefined;
    }
  };
  const activities: Activity[] = rows.map((r, i) => {
    const id = r.id.trim();
    if (id === "" || ids.indexOf(id) !== i) {
      invalid.add(`id-${i}`);
    }
    const predecessors = r.predecessors
      .split(/[,;\s]+/)
      .map((p) => p.trim())
      .filter((p) => p !== "");
    for (const p of predecessors) {
      if (!ids.includes(p) || p === id) {
        invalid.add(`pred-${i}`);
      }
    }
    const optimistic = parse(r.optimistic, `opt-${i}`, false);
    const mostLikely = parse(r.mostLikely, `ml-${i}`, false);
    const pessimistic = parse(r.pessimistic, `pes-${i}`, false);
    let duration = parse(r.duration, `dur-${i}`, false);
    if (duration === undefined) {
      if (
        optimistic !== undefined &&
        mostLikely !== undefined &&
        pessimistic !== undefined
      ) {
        duration = optimistic
          .add(mostLikely.mul(Fraction.of(4)))
          .add(pessimistic)
          .div(Fraction.of(6));
      } else {
        invalid.add(`dur-${i}`);
        duration = Fraction.ZERO;
      }
    }
    const crashDuration = parse(r.crashDuration, `cd-${i}`, false);
    const crashCostPerUnit = parse(r.crashCostPerUnit, `cc-${i}`, false);
    if (crashDuration !== undefined && crashDuration.gt(duration)) {
      invalid.add(`cd-${i}`);
    }
    return {
      id,
      name: r.name.trim() === "" ? null : r.name.trim(),
      predecessors,
      duration,
      ...(optimistic !== undefined ? { optimistic } : {}),
      ...(mostLikely !== undefined ? { mostLikely } : {}),
      ...(pessimistic !== undefined ? { pessimistic } : {}),
      ...(crashDuration !== undefined ? { crashDuration } : {}),
      ...(crashCostPerUnit !== undefined ? { crashCostPerUnit } : {}),
    };
  });
  if (rows.length === 0) {
    invalid.add("empty");
  }
  return {
    problem:
      invalid.size > 0
        ? null
        : { title: title.trim() === "" ? null : title.trim(), activities },
    invalid,
  };
}

const initialExample = projectExamples.find((e) => e.id.startsWith("PERT-01"));

export function PertModule() {
  const [title, setTitle] = useState(initialExample ? "PERT-01 CPM" : "");
  const [rows, setRows] = useState<Row[]>(() => {
    try {
      return initialExample
        ? toRows(parseProjectFile(initialExample.text))
        : [];
    } catch {
      return [];
    }
  });
  const [fileName, setFileName] = useState(
    initialExample ? `${initialExample.id}.io.json` : "proyecto.io.json",
  );
  const [showEstimates, setShowEstimates] = useState(false);
  const [showCrash, setShowCrash] = useState(false);
  const [numberFormat, setNumberFormat] = useState<NumberFormat>("fraction");
  const [solved, setSolved] = useState<Solved | null>(null);
  const [tab, setTab] = useState<TabKey>("solution");
  const [notice, setNotice] = useState<string | null>(null);
  const [targetText, setTargetText] = useState("");
  const [dateText, setDateText] = useState("");
  const [probText, setProbText] = useState("0.9");
  const number = makeFormatter(numberFormat);

  const built = useMemo(() => build(title, rows), [title, rows]);
  const hasEstimates = rows.some(
    (r) => r.optimistic.trim() !== "" || r.pessimistic.trim() !== "",
  );
  const hasCrash = rows.some((r) => r.crashDuration.trim() !== "");

  const applyProblem = (p: ProjectProblem, name: string) => {
    setRows(toRows(p));
    setTitle(p.title ?? "");
    setFileName(name);
    setSolved(null);
    setNotice(null);
    setShowEstimates(p.activities.some((a) => a.optimistic !== undefined));
    setShowCrash(p.activities.some((a) => a.crashDuration !== undefined));
  };

  const loadExample = (id: string) => {
    const example = projectExamples.find((e) => e.id === id);
    if (!example) {
      return;
    }
    try {
      applyProblem(parseProjectFile(example.text), `${example.id}.io.json`);
    } catch (e) {
      setNotice(e instanceof ParseError ? e.message : String(e));
    }
  };

  const openFile = async () => {
    try {
      const file = await openTextFile(["json"], t("file.filter"));
      if (file) {
        applyProblem(parseProjectFile(file.text), file.name);
      }
    } catch (e) {
      setNotice(e instanceof ParseError ? e.message : t("file.openError"));
    }
  };

  const saveFile = async () => {
    if (!built.problem) {
      setNotice(t("pert.invalid"));
      return;
    }
    await downloadText(
      serializeProjectFile(built.problem),
      fileName,
      "json",
      t("file.filter"),
    );
  };

  const runCrashing = (
    problem: ProjectProblem,
    target: string,
  ): CrashingResult | null => {
    if (!problem.activities.some((a) => a.crashDuration !== undefined)) {
      return null;
    }
    let parsed: Fraction | undefined;
    if (target.trim() !== "") {
      try {
        parsed = Fraction.parse(target.trim());
      } catch {
        parsed = undefined;
      }
    }
    return crashing(problem, parsed);
  };

  const solve = () => {
    if (!built.problem) {
      setNotice(t("pert.invalid"));
      return;
    }
    const problem = built.problem;
    try {
      const schedule = cpm(problem);
      if (schedule.status !== "ok") {
        setNotice(t("pert.cycle"));
        setSolved(null);
        return;
      }
      setNotice(null);
      const estimates = problem.activities.some(
        (a) => a.optimistic !== undefined,
      );
      setSolved({
        problem,
        cpm: schedule,
        pert: estimates ? pert(problem) : null,
        crashing: runCrashing(problem, targetText),
      });
      setTab("solution");
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const recrash = () => {
    if (!solved) {
      return;
    }
    setSolved({ ...solved, crashing: runCrashing(solved.problem, targetText) });
  };

  const report = useMemo(() => {
    if (!solved) {
      return "";
    }
    const options = { numberFormat, decimals: DECIMALS };
    const parts = [reportCpm(solved.problem, solved.cpm, options)];
    if (solved.pert) {
      parts.push(reportPert(solved.problem, solved.pert, options));
    }
    if (solved.crashing) {
      parts.push(reportCrashing(solved.problem, solved.crashing, options));
    }
    return parts.join("\n");
  }, [solved, numberFormat]);

  const cls = (key: string) =>
    `cell${built.invalid.has(key) ? " invalid" : ""}`;
  const setRow = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const probabilityDate = Number(dateText);
  const probabilityValue = Number(probText);

  return (
    <div className="workspace" data-testid="pert-module">
      <section className="panel model-panel" aria-labelledby="pert-title">
        <header className="panel-header">
          <h2 id="pert-title">{t("module.pert")}</h2>
          <div className="toolbar">
            <select
              value=""
              onChange={(e) => loadExample(e.target.value)}
              aria-label={t("editor.examples")}
              data-testid="pert-examples"
            >
              <option value="" disabled>
                {t("editor.examplesChoose")}
              </option>
              {projectExamples.map((e) => (
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
              data-testid="pert-solve"
            >
              {t("editor.solve")}
            </button>
          </div>
        </header>
        <div className="editor-area">
          <div className="toolbar">
            <label className="switch">
              <input
                type="checkbox"
                checked={showEstimates}
                onChange={(e) => setShowEstimates(e.target.checked)}
                data-testid="pert-show-estimates"
              />
              {t("pert.showEstimates")}
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={showCrash}
                onChange={(e) => setShowCrash(e.target.checked)}
                data-testid="pert-show-crash"
              />
              {t("pert.showCrash")}
            </label>
          </div>
          <div className="table-scroll">
            <table className="data-table editor-grid">
              <thead>
                <tr>
                  <th>{t("pert.id")}</th>
                  <th>{t("pert.name")}</th>
                  <th>{t("pert.predecessors")}</th>
                  <th>{t("pert.duration")}</th>
                  {showEstimates && (
                    <>
                      <th>{t("pert.optimistic")}</th>
                      <th>{t("pert.mostLikely")}</th>
                      <th>{t("pert.pessimistic")}</th>
                    </>
                  )}
                  {showCrash && (
                    <>
                      <th>{t("pert.crashDuration")}</th>
                      <th>{t("pert.crashCost")}</th>
                    </>
                  )}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        className={`${cls(`id-${i}`)} name`}
                        value={r.id}
                        onChange={(e) => setRow(i, { id: e.target.value })}
                        data-testid={`act-id-${i}`}
                      />
                    </td>
                    <td>
                      <input
                        className="cell name"
                        value={r.name}
                        onChange={(e) => setRow(i, { name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className={`${cls(`pred-${i}`)} name`}
                        value={r.predecessors}
                        onChange={(e) =>
                          setRow(i, { predecessors: e.target.value })
                        }
                        data-testid={`act-pred-${i}`}
                      />
                    </td>
                    <td>
                      <input
                        className={cls(`dur-${i}`)}
                        value={r.duration}
                        onChange={(e) =>
                          setRow(i, { duration: e.target.value })
                        }
                        data-testid={`act-dur-${i}`}
                      />
                    </td>
                    {showEstimates && (
                      <>
                        <td>
                          <input
                            className={cls(`opt-${i}`)}
                            value={r.optimistic}
                            onChange={(e) =>
                              setRow(i, { optimistic: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className={cls(`ml-${i}`)}
                            value={r.mostLikely}
                            onChange={(e) =>
                              setRow(i, { mostLikely: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className={cls(`pes-${i}`)}
                            value={r.pessimistic}
                            onChange={(e) =>
                              setRow(i, { pessimistic: e.target.value })
                            }
                          />
                        </td>
                      </>
                    )}
                    {showCrash && (
                      <>
                        <td>
                          <input
                            className={cls(`cd-${i}`)}
                            value={r.crashDuration}
                            onChange={(e) =>
                              setRow(i, { crashDuration: e.target.value })
                            }
                            data-testid={`act-crash-${i}`}
                          />
                        </td>
                        <td>
                          <input
                            className={cls(`cc-${i}`)}
                            value={r.crashCostPerUnit}
                            onChange={(e) =>
                              setRow(i, { crashCostPerUnit: e.target.value })
                            }
                          />
                        </td>
                      </>
                    )}
                    <td>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          className="icon"
                          title={t("table.remove")}
                          onClick={() =>
                            setRows(rows.filter((_, k) => k !== i))
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
              onClick={() => {
                let k = rows.length;
                let id = String.fromCharCode(65 + (k % 26));
                while (rows.some((r) => r.id === id)) {
                  k += 1;
                  id = `${String.fromCharCode(65 + (k % 26))}${Math.floor(k / 26) || ""}`;
                }
                setRows([
                  ...rows,
                  {
                    id,
                    name: "",
                    predecessors: "",
                    duration: "1",
                    optimistic: "",
                    mostLikely: "",
                    pessimistic: "",
                    crashDuration: "",
                    crashCostPerUnit: "",
                  },
                ]);
              }}
              data-testid="pert-add-activity"
            >
              {t("pert.addActivity")}
            </button>
          </div>
        </div>
        <div className="options">
          <label>
            {t("pert.target")}
            <input
              className="short"
              value={targetText}
              onChange={(e) => setTargetText(e.target.value)}
              placeholder="–"
              data-testid="pert-target"
            />
          </label>
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
          <p className="editor-error" role="alert" data-testid="pert-notice">
            {notice}
          </p>
        )}
      </section>
      <section
        className="panel results-panel"
        aria-labelledby="pert-results-title"
      >
        <header className="panel-header">
          <h2 id="pert-results-title">{t("results.title")}</h2>
        </header>
        {solved === null ? (
          <p className="empty">{t("results.empty")}</p>
        ) : (
          <Tabs<TabKey>
            items={[
              { key: "solution", label: t("tab.solution") },
              { key: "times", label: t("pert.times") },
              { key: "network", label: t("pert.network") },
              { key: "gantt", label: t("pert.gantt") },
              {
                key: "pert",
                label: t("pert.probabilities"),
                disabled: solved.pert === null && !hasEstimates,
              },
              {
                key: "crashing",
                label: t("pert.crashing"),
                disabled: solved.crashing === null && !hasCrash,
              },
            ]}
            active={tab}
            onChange={setTab}
            idPrefix="pert"
          >
            {tab === "solution" && (
              <div>
                <p className="status status-optimal" data-testid="pert-status">
                  {t("pert.duration.project")}: {number(solved.cpm.duration)}.{" "}
                  {t("pert.critical")}:{" "}
                  {solved.cpm.criticalPaths
                    .map((p) => p.join(" -> "))
                    .join("; ")}
                </p>
                <pre className="report" data-testid="pert-report">
                  {report}
                </pre>
              </div>
            )}
            {tab === "times" && (
              <div className="table-scroll">
                <table className="data-table numeric" data-testid="pert-times">
                  <thead>
                    <tr>
                      <th>{t("pert.id")}</th>
                      <th>{t("pert.duration")}</th>
                      <th>{t("pert.es")}</th>
                      <th>{t("pert.ef")}</th>
                      <th>{t("pert.ls")}</th>
                      <th>{t("pert.lf")}</th>
                      <th>{t("pert.totalSlack")}</th>
                      <th>{t("pert.freeSlack")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solved.cpm.activities.map((a) => (
                      <tr
                        key={a.id}
                        className={a.critical ? "critical-row" : ""}
                      >
                        <th scope="row">{a.id}</th>
                        <td>{number(a.duration)}</td>
                        <td>{number(a.es)}</td>
                        <td>{number(a.ef)}</td>
                        <td>{number(a.ls)}</td>
                        <td>{number(a.lf)}</td>
                        <td>{number(a.totalSlack)}</td>
                        <td>{number(a.freeSlack)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tab === "network" && (
              <ActivityNetwork result={solved.cpm} number={number} />
            )}
            {tab === "gantt" && <Gantt result={solved.cpm} number={number} />}
            {tab === "pert" &&
              (solved.pert ? (
                <div className="pert-tab" data-testid="pert-probabilities">
                  <p>
                    {t("pert.expected")}: {number(solved.pert.expectedDuration)}
                    . {t("pert.variance")}: {number(solved.pert.variance)} (σ ={" "}
                    {solved.pert.standardDeviation.toFixed(4)}).{" "}
                    {t("pert.critical")}:{" "}
                    {solved.pert.criticalPath.join(" -> ")}
                  </p>
                  <div className="options">
                    <label>
                      {t("pert.probabilityByDate")}
                      <input
                        className="short"
                        value={dateText}
                        onChange={(e) => setDateText(e.target.value)}
                        data-testid="pert-date"
                      />
                    </label>
                    <span data-testid="pert-probability-result">
                      {Number.isFinite(probabilityDate) &&
                      dateText.trim() !== ""
                        ? `P = ${solved.pert.probabilityByDate(probabilityDate).toFixed(4)}`
                        : ""}
                    </span>
                  </div>
                  <div className="options">
                    <label>
                      {t("pert.dateForProbability")}
                      <input
                        className="short"
                        value={probText}
                        onChange={(e) => setProbText(e.target.value)}
                        data-testid="pert-prob"
                      />
                    </label>
                    <span data-testid="pert-date-result">
                      {Number.isFinite(probabilityValue) &&
                      probabilityValue > 0 &&
                      probabilityValue < 1
                        ? `T = ${solved.pert.dateForProbability(probabilityValue).toFixed(4)}`
                        : ""}
                    </span>
                  </div>
                  <div className="table-scroll">
                    <table className="data-table numeric">
                      <thead>
                        <tr>
                          <th>{t("pert.id")}</th>
                          <th>{t("pert.optimistic")}</th>
                          <th>{t("pert.mostLikely")}</th>
                          <th>{t("pert.pessimistic")}</th>
                          <th>{t("pert.expected")}</th>
                          <th>{t("pert.variance")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {solved.pert.activities.map((a) => (
                          <tr key={a.id}>
                            <th scope="row">{a.id}</th>
                            <td>{number(a.optimistic)}</td>
                            <td>{number(a.mostLikely)}</td>
                            <td>{number(a.pessimistic)}</td>
                            <td>{number(a.expected)}</td>
                            <td>{number(a.variance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="hint">{t("pert.noEstimates")}</p>
              ))}
            {tab === "crashing" &&
              (solved.crashing ? (
                <div className="crash-tab" data-testid="pert-crashing">
                  <div className="options">
                    <label>
                      {t("pert.target")}
                      <input
                        className="short"
                        value={targetText}
                        onChange={(e) => setTargetText(e.target.value)}
                        data-testid="crash-target"
                      />
                    </label>
                    <button
                      type="button"
                      className="primary"
                      onClick={recrash}
                      data-testid="crash-run"
                    >
                      {t("pert.analyze")}
                    </button>
                    <span>
                      {t("pert.normalDuration")}:{" "}
                      {number(solved.crashing.normalDuration)}.{" "}
                      {t("pert.minimumDuration")}:{" "}
                      {number(solved.crashing.minimumDuration)}.
                    </span>
                  </div>
                  {solved.crashing.target && (
                    <p
                      className={`note${solved.crashing.target.feasible ? "" : " note-warning"}`}
                      data-testid="crash-result"
                    >
                      {solved.crashing.target.feasible
                        ? `${t("pert.duration")} ${number(solved.crashing.target.duration)}: ${t("pert.cost").toLowerCase()} ${number(solved.crashing.target.cost)}. ${t("pert.crashed")}: ${
                            solved.crashing.target.crashed
                              .filter((c) => !c.amount.isZero())
                              .map((c) => `${c.id} ${number(c.amount)}`)
                              .join(", ") || "-"
                          }`
                        : solved.crashing.messages[
                            solved.crashing.messages.length - 1
                          ]}
                    </p>
                  )}
                  <h3>{t("pert.curve")}</h3>
                  <CostCurve result={solved.crashing} />
                  <div className="table-scroll">
                    <table
                      className="data-table numeric"
                      data-testid="crash-table"
                    >
                      <thead>
                        <tr>
                          <th>{t("pert.duration")}</th>
                          <th>{t("pert.cost")}</th>
                          <th>{t("pert.crashed")}</th>
                          <th>{t("pert.critical")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {solved.crashing.curve.map((p, i) => (
                          <tr key={i}>
                            <td>{number(p.duration)}</td>
                            <td>{number(p.cost)}</td>
                            <td className="text">
                              {p.crashed
                                .filter((c) => !c.amount.isZero())
                                .map((c) => `${c.id} ${number(c.amount)}`)
                                .join(", ") || "-"}
                            </td>
                            <td className="text">
                              {p.criticalPaths
                                .map((path) => path.join("-"))
                                .join("; ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="hint">{t("pert.noCrash")}</p>
              ))}
          </Tabs>
        )}
      </section>
    </div>
  );
}
