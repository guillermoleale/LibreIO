// SPDX-License-Identifier: GPL-3.0-or-later
// Módulo de programación dinámica: mochila y diligencia con la tabla de cada etapa.
import { useMemo, useState } from "react";
import {
  Fraction,
  ParseError,
  knapsack,
  parseDpFile,
  reportKnapsack,
  reportStagecoach,
  serializeDpFile,
  stagecoach,
  type DpFile,
  type KnapsackProblem,
  type KnapsackResult,
  type StagecoachProblem,
  type StagecoachResult,
} from "@libreio/core";
import { t } from "../i18n";
import { dpExamples } from "../common/examples";
import { downloadText } from "../common/download";
import { openTextFile } from "../common/files";
import {
  DECIMALS,
  makeFormatter,
  type NumberFormat,
} from "../common/numberFormat";
import { Tabs } from "../common/Tabs";

type Kind = "knapsack" | "stagecoach";
type TabKey = "solution" | "tables";

interface ItemDraft {
  name: string;
  weight: string;
  value: string;
  maxUnits: string;
}

interface ArcDraft {
  from: string;
  to: string;
  cost: string;
}

interface KnapsackDraft {
  title: string;
  capacity: string;
  items: ItemDraft[];
}

interface StagecoachDraft {
  title: string;
  sense: "min" | "max";
  autoStages: boolean;
  stages: string;
  arcs: ArcDraft[];
}

type Solved =
  | {
      readonly kind: "knapsack";
      readonly problem: KnapsackProblem;
      readonly result: KnapsackResult;
    }
  | {
      readonly kind: "stagecoach";
      readonly problem: StagecoachProblem;
      readonly result: StagecoachResult;
    };

const emptyKnapsack: KnapsackDraft = {
  title: "",
  capacity: "5",
  items: [
    { name: "1", weight: "2", value: "3", maxUnits: "" },
    { name: "2", weight: "3", value: "4", maxUnits: "" },
  ],
};

const emptyStagecoach: StagecoachDraft = {
  title: "",
  sense: "min",
  autoStages: true,
  stages: "",
  arcs: [
    { from: "1", to: "2", cost: "1" },
    { from: "2", to: "3", cost: "1" },
  ],
};

function knapsackToDraft(p: KnapsackProblem): KnapsackDraft {
  return {
    title: p.title ?? "",
    capacity: p.capacity.toString(),
    items: p.items.map((i) => ({
      name: i.name,
      weight: i.weight.toString(),
      value: i.value.toString(),
      maxUnits:
        i.maxUnits === undefined || i.maxUnits === 1 ? "" : String(i.maxUnits),
    })),
  };
}

function stagecoachToDraft(p: StagecoachProblem): StagecoachDraft {
  return {
    title: p.title ?? "",
    sense: p.sense ?? "min",
    autoStages: p.stages === null,
    stages: p.stages ? p.stages.map((s) => s.join(", ")).join("\n") : "",
    arcs: p.arcs.map((a) => ({
      from: a.from,
      to: a.to,
      cost: a.cost.toString(),
    })),
  };
}

function buildKnapsack(d: KnapsackDraft): {
  problem: KnapsackProblem | null;
  invalid: Set<string>;
} {
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
  const capacity = num(d.capacity, "capacity");
  if (!capacity.isInteger()) {
    invalid.add("capacity");
  }
  const names = d.items.map((i) => i.name.trim());
  const items = d.items.map((item, i) => {
    const name = item.name.trim();
    if (name === "" || names.indexOf(name) !== i) {
      invalid.add(`name-${i}`);
    }
    const weight = num(item.weight, `weight-${i}`);
    if (!weight.isInteger() || !weight.isPositive()) {
      invalid.add(`weight-${i}`);
    }
    const value = num(item.value, `value-${i}`);
    let maxUnits: number | undefined;
    if (item.maxUnits.trim() !== "") {
      const u = Number(item.maxUnits.trim());
      if (!Number.isInteger(u) || u < 1) {
        invalid.add(`units-${i}`);
      } else {
        maxUnits = u;
      }
    }
    return {
      name,
      weight,
      value,
      ...(maxUnits !== undefined ? { maxUnits } : {}),
    };
  });
  if (items.length === 0) {
    invalid.add("items");
  }
  return {
    problem:
      invalid.size > 0
        ? null
        : {
            title: d.title.trim() === "" ? null : d.title.trim(),
            capacity,
            items,
          },
    invalid,
  };
}

function buildStagecoach(d: StagecoachDraft): {
  problem: StagecoachProblem | null;
  invalid: Set<string>;
} {
  const invalid = new Set<string>();
  const arcs = d.arcs.map((a, k) => {
    const from = a.from.trim();
    const to = a.to.trim();
    if (from === "") {
      invalid.add(`from-${k}`);
    }
    if (to === "" || to === from) {
      invalid.add(`to-${k}`);
    }
    let cost = Fraction.ZERO;
    try {
      cost = Fraction.parse(a.cost.trim());
    } catch {
      invalid.add(`cost-${k}`);
    }
    return { from, to, cost };
  });
  if (arcs.length === 0) {
    invalid.add("arcs");
  }
  let stages: string[][] | null = null;
  if (!d.autoStages) {
    stages = d.stages
      .split(/\r?\n/)
      .map((line) =>
        line
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter((s) => s !== ""),
      )
      .filter((line) => line.length > 0);
    if (stages.length < 2) {
      invalid.add("stages");
    } else {
      const known = new Set(stages.flat());
      for (const a of arcs) {
        if (!known.has(a.from) || !known.has(a.to)) {
          invalid.add("stages");
        }
      }
    }
  }
  return {
    problem:
      invalid.size > 0
        ? null
        : {
            title: d.title.trim() === "" ? null : d.title.trim(),
            stages,
            arcs,
            ...(d.sense === "max" ? { sense: "max" as const } : {}),
          },
    invalid,
  };
}

function loadExample(id: string): {
  kind: Kind;
  knapsack?: KnapsackDraft;
  stagecoach?: StagecoachDraft;
  name: string;
} | null {
  const example = dpExamples.find((e) => e.id === id);
  if (!example) {
    return null;
  }
  const file = parseDpFile(example.text);
  const name = `${example.id}.io.json`;
  if (file.type === "knapsack") {
    return { kind: "knapsack", knapsack: knapsackToDraft(file.problem), name };
  }
  return {
    kind: "stagecoach",
    stagecoach: stagecoachToDraft(file.problem),
    name,
  };
}

const initial = (() => {
  try {
    return loadExample(
      dpExamples.find((e) => e.id.startsWith("DP-01"))?.id ?? "",
    );
  } catch {
    return null;
  }
})();

export function DpModule() {
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "knapsack");
  const [knapsackDraft, setKnapsackDraft] = useState<KnapsackDraft>(
    initial?.knapsack ?? emptyKnapsack,
  );
  const [stagecoachDraft, setStagecoachDraft] = useState<StagecoachDraft>(
    initial?.stagecoach ?? emptyStagecoach,
  );
  const [fileName, setFileName] = useState(initial?.name ?? "problema.io.json");
  const [numberFormat, setNumberFormat] = useState<NumberFormat>("fraction");
  const [solved, setSolved] = useState<Solved | null>(null);
  const [tab, setTab] = useState<TabKey>("solution");
  const [notice, setNotice] = useState<string | null>(null);
  const number = makeFormatter(numberFormat);

  const built = useMemo(
    () =>
      kind === "knapsack"
        ? buildKnapsack(knapsackDraft)
        : buildStagecoach(stagecoachDraft),
    [kind, knapsackDraft, stagecoachDraft],
  );

  const applyFile = (file: DpFile, name: string) => {
    if (file.type === "knapsack") {
      setKind("knapsack");
      setKnapsackDraft(knapsackToDraft(file.problem));
    } else {
      setKind("stagecoach");
      setStagecoachDraft(stagecoachToDraft(file.problem));
    }
    setFileName(name);
    setSolved(null);
    setNotice(null);
  };

  const onExample = (id: string) => {
    try {
      const loaded = loadExample(id);
      if (!loaded) {
        return;
      }
      setKind(loaded.kind);
      if (loaded.knapsack) {
        setKnapsackDraft(loaded.knapsack);
      }
      if (loaded.stagecoach) {
        setStagecoachDraft(loaded.stagecoach);
      }
      setFileName(loaded.name);
      setSolved(null);
      setNotice(null);
    } catch (e) {
      setNotice(e instanceof ParseError ? e.message : String(e));
    }
  };

  const openFile = async () => {
    try {
      const file = await openTextFile(["json"], t("file.filter"));
      if (file) {
        applyFile(parseDpFile(file.text), file.name);
      }
    } catch (e) {
      setNotice(e instanceof ParseError ? e.message : t("file.openError"));
    }
  };

  const currentFile = (): DpFile | null => {
    if (!built.problem) {
      return null;
    }
    return kind === "knapsack"
      ? { type: "knapsack", problem: built.problem as KnapsackProblem }
      : { type: "stagecoach", problem: built.problem as StagecoachProblem };
  };

  const saveFile = async () => {
    const file = currentFile();
    if (!file) {
      setNotice(t("dp.invalid"));
      return;
    }
    try {
      await downloadText(
        serializeDpFile(file),
        fileName,
        "json",
        t("file.filter"),
      );
    } catch {
      setNotice(t("file.saveError"));
    }
  };

  const solve = () => {
    const file = currentFile();
    if (!file) {
      setNotice(t("dp.invalid"));
      return;
    }
    try {
      if (file.type === "knapsack") {
        setSolved({
          kind: "knapsack",
          problem: file.problem,
          result: knapsack(file.problem),
        });
      } else {
        setSolved({
          kind: "stagecoach",
          problem: file.problem,
          result: stagecoach(file.problem),
        });
      }
      setNotice(null);
      setTab("solution");
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const report = useMemo(() => {
    if (!solved) {
      return "";
    }
    const options = { numberFormat, decimals: DECIMALS };
    return solved.kind === "knapsack"
      ? reportKnapsack(solved.problem, solved.result, options)
      : reportStagecoach(solved.problem, solved.result, options);
  }, [solved, numberFormat]);

  const status = useMemo(() => {
    if (!solved) {
      return "";
    }
    if (solved.kind === "knapsack") {
      const names = solved.result.selected
        .map((i) => solved.problem.items[i]!.name)
        .join(", ");
      return `${t("dp.optimum")}: ${number(solved.result.value)}. ${t("dp.selected")}: ${names === "" ? "-" : names}`;
    }
    const r = solved.result;
    if (r.status !== "optimal" || r.cost === null) {
      return r.messages[0] ?? "";
    }
    return `${r.sense === "max" ? "Costo máximo" : "Costo mínimo"}: ${number(r.cost)} por ${r.path.join(" -> ")}`;
  }, [solved, number]);

  const cls = (key: string) =>
    `cell${built.invalid.has(key) ? " invalid" : ""}`;
  const setItem = (i: number, patch: Partial<ItemDraft>) =>
    setKnapsackDraft({
      ...knapsackDraft,
      items: knapsackDraft.items.map((it, k) =>
        k === i ? { ...it, ...patch } : it,
      ),
    });
  const setArc = (k: number, patch: Partial<ArcDraft>) =>
    setStagecoachDraft({
      ...stagecoachDraft,
      arcs: stagecoachDraft.arcs.map((a, m) =>
        m === k ? { ...a, ...patch } : a,
      ),
    });

  return (
    <div className="workspace" data-testid="dp-module">
      <section className="panel model-panel" aria-labelledby="dp-title">
        <header className="panel-header">
          <h2 id="dp-title">{t("module.dp")}</h2>
          <div className="toolbar">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              aria-label={t("dp.kind")}
              data-testid="dp-kind"
            >
              <option value="knapsack">{t("dp.knapsack")}</option>
              <option value="stagecoach">{t("dp.stagecoach")}</option>
            </select>
            <select
              value=""
              onChange={(e) => onExample(e.target.value)}
              aria-label={t("editor.examples")}
              data-testid="dp-examples"
            >
              <option value="" disabled>
                {t("editor.examplesChoose")}
              </option>
              {dpExamples.map((e) => (
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
              data-testid="dp-solve"
            >
              {t("editor.solve")}
            </button>
          </div>
        </header>
        <div className="editor-area">
          {kind === "knapsack" ? (
            <>
              <div className="options">
                <label>
                  {t("dp.capacity")}
                  <input
                    className={`short${built.invalid.has("capacity") ? " invalid" : ""}`}
                    value={knapsackDraft.capacity}
                    onChange={(e) =>
                      setKnapsackDraft({
                        ...knapsackDraft,
                        capacity: e.target.value,
                      })
                    }
                    data-testid="dp-capacity"
                  />
                </label>
              </div>
              <h3>{t("dp.items")}</h3>
              <div className="table-scroll">
                <table className="data-table editor-grid">
                  <thead>
                    <tr>
                      <th>{t("dp.item")}</th>
                      <th>{t("dp.weight")}</th>
                      <th>{t("dp.value")}</th>
                      <th>{t("dp.maxUnits")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {knapsackDraft.items.map((item, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            className={`${cls(`name-${i}`)} name`}
                            value={item.name}
                            onChange={(e) =>
                              setItem(i, { name: e.target.value })
                            }
                            data-testid={`dp-item-name-${i}`}
                          />
                        </td>
                        <td>
                          <input
                            className={cls(`weight-${i}`)}
                            value={item.weight}
                            onChange={(e) =>
                              setItem(i, { weight: e.target.value })
                            }
                            data-testid={`dp-item-weight-${i}`}
                          />
                        </td>
                        <td>
                          <input
                            className={cls(`value-${i}`)}
                            value={item.value}
                            onChange={(e) =>
                              setItem(i, { value: e.target.value })
                            }
                            data-testid={`dp-item-value-${i}`}
                          />
                        </td>
                        <td>
                          <input
                            className={cls(`units-${i}`)}
                            value={item.maxUnits}
                            placeholder="1"
                            onChange={(e) =>
                              setItem(i, { maxUnits: e.target.value })
                            }
                            data-testid={`dp-item-units-${i}`}
                          />
                        </td>
                        <td>
                          {knapsackDraft.items.length > 1 && (
                            <button
                              type="button"
                              className="icon"
                              title={t("table.remove")}
                              onClick={() =>
                                setKnapsackDraft({
                                  ...knapsackDraft,
                                  items: knapsackDraft.items.filter(
                                    (_, k) => k !== i,
                                  ),
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
                    setKnapsackDraft({
                      ...knapsackDraft,
                      items: [
                        ...knapsackDraft.items,
                        {
                          name: String(knapsackDraft.items.length + 1),
                          weight: "1",
                          value: "1",
                          maxUnits: "",
                        },
                      ],
                    })
                  }
                  data-testid="dp-add-item"
                >
                  {t("dp.addItem")}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="options">
                <label>
                  {t("dp.sense")}
                  <select
                    value={stagecoachDraft.sense}
                    onChange={(e) =>
                      setStagecoachDraft({
                        ...stagecoachDraft,
                        sense: e.target.value as "min" | "max",
                      })
                    }
                    data-testid="dp-sense"
                  >
                    <option value="min">{t("dp.min")}</option>
                    <option value="max">{t("dp.max")}</option>
                  </select>
                </label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={stagecoachDraft.autoStages}
                    onChange={(e) =>
                      setStagecoachDraft({
                        ...stagecoachDraft,
                        autoStages: e.target.checked,
                      })
                    }
                    data-testid="dp-auto-stages"
                  />
                  {t("dp.autoStages")}
                </label>
              </div>
              {!stagecoachDraft.autoStages && (
                <label className="block-label">
                  {t("dp.stages")}
                  <textarea
                    className={`stages-input${built.invalid.has("stages") ? " invalid" : ""}`}
                    rows={4}
                    value={stagecoachDraft.stages}
                    onChange={(e) =>
                      setStagecoachDraft({
                        ...stagecoachDraft,
                        stages: e.target.value,
                      })
                    }
                    data-testid="dp-stages"
                  />
                </label>
              )}
              <h3>{t("dp.arcs")}</h3>
              <div className="table-scroll">
                <table className="data-table editor-grid">
                  <thead>
                    <tr>
                      <th>{t("net.from")}</th>
                      <th>{t("net.to")}</th>
                      <th>{t("transport.cost")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {stagecoachDraft.arcs.map((a, k) => (
                      <tr key={k}>
                        <td>
                          <input
                            className={`${cls(`from-${k}`)} name`}
                            value={a.from}
                            onChange={(e) =>
                              setArc(k, { from: e.target.value })
                            }
                            data-testid={`dp-arc-from-${k}`}
                          />
                        </td>
                        <td>
                          <input
                            className={`${cls(`to-${k}`)} name`}
                            value={a.to}
                            onChange={(e) => setArc(k, { to: e.target.value })}
                            data-testid={`dp-arc-to-${k}`}
                          />
                        </td>
                        <td>
                          <input
                            className={cls(`cost-${k}`)}
                            value={a.cost}
                            onChange={(e) =>
                              setArc(k, { cost: e.target.value })
                            }
                            data-testid={`dp-arc-cost-${k}`}
                          />
                        </td>
                        <td>
                          {stagecoachDraft.arcs.length > 1 && (
                            <button
                              type="button"
                              className="icon"
                              title={t("table.remove")}
                              onClick={() =>
                                setStagecoachDraft({
                                  ...stagecoachDraft,
                                  arcs: stagecoachDraft.arcs.filter(
                                    (_, m) => m !== k,
                                  ),
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
                    setStagecoachDraft({
                      ...stagecoachDraft,
                      arcs: [
                        ...stagecoachDraft.arcs,
                        { from: "", to: "", cost: "1" },
                      ],
                    })
                  }
                  data-testid="dp-add-arc"
                >
                  {t("net.addArc")}
                </button>
              </div>
            </>
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
          <p className="editor-error" role="alert" data-testid="dp-notice">
            {notice}
          </p>
        )}
      </section>
      <section
        className="panel results-panel"
        aria-labelledby="dp-results-title"
      >
        <header className="panel-header">
          <h2 id="dp-results-title">{t("results.title")}</h2>
        </header>
        {solved === null ? (
          <p className="empty">{t("results.empty")}</p>
        ) : (
          <Tabs<TabKey>
            items={[
              { key: "solution", label: t("tab.solution") },
              { key: "tables", label: t("dp.tables") },
            ]}
            active={tab}
            onChange={setTab}
            idPrefix="dp"
          >
            {tab === "solution" && (
              <div>
                <p
                  className={`status ${solved.kind === "stagecoach" && solved.result.status !== "optimal" ? "status-infeasible" : "status-optimal"}`}
                  data-testid="dp-status"
                >
                  {status}
                </p>
                <pre className="report" data-testid="dp-report">
                  {report}
                </pre>
              </div>
            )}
            {tab === "tables" && solved.kind === "knapsack" && (
              <KnapsackTables
                problem={solved.problem}
                result={solved.result}
                number={number}
              />
            )}
            {tab === "tables" && solved.kind === "stagecoach" && (
              <StagecoachTables result={solved.result} number={number} />
            )}
          </Tabs>
        )}
      </section>
    </div>
  );
}

interface KnapsackTablesProps {
  readonly problem: KnapsackProblem;
  readonly result: KnapsackResult;
  readonly number: (f: Fraction) => string;
}

/** Capacidad disponible en cada etapa de la solución óptima, para resaltar la fila que se usa. */
function optimalCapacities(
  problem: KnapsackProblem,
  result: KnapsackResult,
): Map<number, Fraction> {
  const used = new Map<number, Fraction>();
  let remaining = problem.capacity;
  // Las etapas se resolvieron de la última a la primera; la solución se lee de la primera a la última.
  const forward = [...result.order].reverse();
  for (const stageIndex of forward) {
    const stage = result.stages[stageIndex]!;
    used.set(stageIndex, remaining);
    const units = result.units[stage.item] ?? 0;
    remaining = remaining.sub(
      problem.items[stage.item]!.weight.mul(Fraction.of(units)),
    );
  }
  return used;
}

function KnapsackTables({ problem, result, number }: KnapsackTablesProps) {
  const highlighted = optimalCapacities(problem, result);
  return (
    <div className="dp-tables" data-testid="dp-tables">
      {result.order.map((stageIndex, k) => {
        const stage = result.stages[stageIndex]!;
        const item = problem.items[stage.item]!;
        const maxUnits = Math.max(
          0,
          ...stage.rows.map((row) => row.decisions.length - 1),
        );
        const optimalCapacity = highlighted.get(stageIndex) ?? null;
        return (
          <div key={stageIndex}>
            <h3>
              {t("dp.stage")} {stageIndex + 1} ({k + 1}.ª resuelta):{" "}
              {t("dp.item").toLowerCase()} {item.name},{" "}
              {t("dp.weight").toLowerCase()} {number(item.weight)},{" "}
              {t("dp.value").toLowerCase()} {number(item.value)}
            </h3>
            <div className="table-scroll">
              <table className="data-table numeric">
                <thead>
                  <tr>
                    <th>{t("dp.capacity")}</th>
                    {Array.from({ length: maxUnits + 1 }, (_, u) => (
                      <th key={u}>{u} u.</th>
                    ))}
                    <th>{t("dp.optimum")}</th>
                    <th>{t("dp.decision")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stage.rows.map((row) => {
                    const onPath =
                      optimalCapacity !== null &&
                      row.capacity.eq(optimalCapacity);
                    return (
                      <tr
                        key={row.capacity.toString()}
                        className={onPath ? "critical-row" : ""}
                      >
                        <th scope="row">{number(row.capacity)}</th>
                        {Array.from({ length: maxUnits + 1 }, (_, u) => {
                          const decision = row.decisions.find(
                            (d) => d.units === u,
                          );
                          return (
                            <td
                              key={u}
                              className={
                                decision && u === row.choice ? "pivot" : ""
                              }
                            >
                              {decision ? number(decision.value) : "-"}
                            </td>
                          );
                        })}
                        <td>{number(row.best)}</td>
                        <td>{row.choice}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface StagecoachTablesProps {
  readonly result: StagecoachResult;
  readonly number: (f: Fraction) => string;
}

function StagecoachTables({ result, number }: StagecoachTablesProps) {
  const onPath = new Set(result.path);
  return (
    <div className="dp-tables" data-testid="dp-tables">
      {result.tables.map((table) => (
        <div key={table.stage}>
          <h3>
            {t("dp.stage")} {table.stage}
          </h3>
          <div className="table-scroll">
            <table className="data-table numeric">
              <thead>
                <tr>
                  <th>{t("dp.state")}</th>
                  <th>{t("dp.candidates")}</th>
                  <th>{t("dp.optimum")}</th>
                  <th>{t("dp.decision")}</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr
                    key={row.state}
                    className={
                      onPath.has(row.state) &&
                      row.decision !== null &&
                      onPath.has(row.decision)
                        ? "critical-row"
                        : ""
                    }
                  >
                    <th scope="row">{row.state}</th>
                    <td className="text">
                      {row.candidates.length === 0
                        ? "-"
                        : row.candidates.map((c) => (
                            <span
                              key={c.next}
                              className={
                                c.next === row.decision
                                  ? "chosen-candidate"
                                  : ""
                              }
                            >
                              {c.next}: {number(c.cost)} + f = {number(c.total)}
                              <br />
                            </span>
                          ))}
                    </td>
                    <td>{number(row.best)}</td>
                    <td className="text">{row.decision ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
