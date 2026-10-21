// SPDX-License-Identifier: GPL-3.0-or-later
// Módulo de colas: formulario de parámetros, tabla de medidas, tabla de Pn, costos y análisis de capacidad.
import { useMemo, useState } from "react";
import {
  Fraction,
  ParseError,
  QUEUE_KIND_NAMES,
  capacityAnalysis,
  parseQueueFile,
  queueCost,
  reportCapacity,
  reportQueue,
  serializeQueueFile,
  solveQueue,
  type CapacityAnalysis,
  type QueueCostResult,
  type QueueKind,
  type QueueModel,
  type QueueResult,
} from "@libreio/core";
import { t } from "../i18n";
import { queueingExamples } from "../common/examples";
import { downloadText } from "../common/download";
import { openTextFile } from "../common/files";
import {
  DECIMALS,
  makeFormatter,
  type NumberFormat,
} from "../common/numberFormat";
import { Tabs } from "../common/Tabs";

type TabKey = "solution" | "pn" | "capacity";
type Vary = "servers" | "lambda" | "mu" | "capacity";

interface Form {
  title: string;
  kind: QueueKind;
  lambda: string;
  mu: string;
  servers: string;
  capacity: string;
  population: string;
  variance: string;
  phases: string;
  useCosts: boolean;
  serverCost: string;
  waitingCost: string;
  basis: "system" | "queue";
  vary: Vary;
  values: string;
}

interface Solved {
  readonly model: QueueModel;
  readonly result: QueueResult;
  readonly cost: QueueCostResult | null;
  readonly capacity: CapacityAnalysis | null;
}

const KINDS: QueueKind[] = [
  "MM1",
  "MMs",
  "MM1K",
  "MMsK",
  "MMsN",
  "MG1",
  "MD1",
  "MEk1",
];

const defaultForm: Form = {
  title: "",
  kind: "MM1",
  lambda: "2",
  mu: "3",
  servers: "1",
  capacity: "5",
  population: "5",
  variance: "0",
  phases: "2",
  useCosts: true,
  serverCost: "10",
  waitingCost: "30",
  basis: "system",
  vary: "servers",
  values: "1, 2, 3",
};

function fromFile(text: string): Form {
  const file = parseQueueFile(text);
  const m = file.model;
  return {
    ...defaultForm,
    title: m.title ?? "",
    kind: m.kind,
    lambda: m.lambda.toString(),
    mu: m.mu.toString(),
    servers: String(m.servers ?? 1),
    capacity: String(m.capacity ?? 5),
    population: String(m.population ?? 5),
    variance: m.serviceVariance?.toString() ?? "0",
    phases: String(m.phases ?? 2),
    useCosts: file.costs !== null,
    serverCost: file.costs?.serverCost.toString() ?? "10",
    waitingCost: file.costs?.waitingCost.toString() ?? "30",
    basis: file.costs?.basis ?? "system",
  };
}

function needs(kind: QueueKind): {
  servers: boolean;
  capacity: boolean;
  population: boolean;
  variance: boolean;
  phases: boolean;
} {
  return {
    servers: kind === "MMs" || kind === "MMsK" || kind === "MMsN",
    capacity: kind === "MM1K" || kind === "MMsK",
    population: kind === "MMsN",
    variance: kind === "MG1",
    phases: kind === "MEk1",
  };
}

function build(f: Form): { model: QueueModel | null; invalid: Set<string> } {
  const invalid = new Set<string>();
  const num = (text: string, key: string): Fraction => {
    try {
      const v = Fraction.parse(text.trim());
      if (!v.isPositive()) {
        invalid.add(key);
      }
      return v;
    } catch {
      invalid.add(key);
      return Fraction.ONE;
    }
  };
  const int = (text: string, key: string): number => {
    const v = Number(text.trim());
    if (!Number.isInteger(v) || v < 1) {
      invalid.add(key);
      return 1;
    }
    return v;
  };
  const n = needs(f.kind);
  const model: QueueModel = {
    kind: f.kind,
    title: f.title.trim() === "" ? null : f.title.trim(),
    lambda: num(f.lambda, "lambda"),
    mu: num(f.mu, "mu"),
    ...(n.servers ? { servers: int(f.servers, "servers") } : {}),
    ...(n.capacity ? { capacity: int(f.capacity, "capacity") } : {}),
    ...(n.population ? { population: int(f.population, "population") } : {}),
    ...(n.variance
      ? {
          serviceVariance: (() => {
            try {
              return Fraction.parse(f.variance.trim());
            } catch {
              invalid.add("variance");
              return Fraction.ZERO;
            }
          })(),
        }
      : {}),
    ...(n.phases ? { phases: int(f.phases, "phases") } : {}),
  };
  if (n.capacity && n.servers && (model.capacity ?? 1) < (model.servers ?? 1)) {
    invalid.add("capacity");
  }
  return { model: invalid.size > 0 ? null : model, invalid };
}

const initialExample = queueingExamples.find((e) => e.id.startsWith("Q-01"));

export function QueueModule() {
  const [form, setForm] = useState<Form>(() => {
    try {
      return initialExample ? fromFile(initialExample.text) : defaultForm;
    } catch {
      return defaultForm;
    }
  });
  const [fileName, setFileName] = useState(
    initialExample ? `${initialExample.id}.io.json` : "cola.io.json",
  );
  const [numberFormat, setNumberFormat] = useState<NumberFormat>("fraction");
  const [solved, setSolved] = useState<Solved | null>(null);
  const [tab, setTab] = useState<TabKey>("solution");
  const [notice, setNotice] = useState<string | null>(null);
  const number = makeFormatter(numberFormat);
  const built = useMemo(() => build(form), [form]);
  const n = needs(form.kind);
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const cls = (key: string) =>
    `short${built.invalid.has(key) ? " invalid" : ""}`;

  const costs = () => {
    if (!form.useCosts) {
      return null;
    }
    try {
      return {
        serverCost: Fraction.parse(form.serverCost.trim()),
        waitingCost: Fraction.parse(form.waitingCost.trim()),
        basis: form.basis,
      };
    } catch {
      return null;
    }
  };

  const solve = () => {
    if (!built.model) {
      setNotice(t("queue.invalid"));
      return;
    }
    try {
      const result = solveQueue(built.model);
      const c = costs();
      const cost = c && result.stable ? queueCost(result, c) : null;
      let capacity: CapacityAnalysis | null = null;
      const values = form.values
        .split(/[,;\s]+/)
        .map((v) => v.trim())
        .filter((v) => v !== "");
      if (values.length > 0) {
        try {
          capacity = capacityAnalysis(
            built.model,
            { vary: form.vary, values: values.map((v) => Fraction.parse(v)) },
            c ?? undefined,
          );
        } catch {
          capacity = null;
        }
      }
      setSolved({ model: built.model, result, cost, capacity });
      setNotice(null);
      setTab("solution");
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const loadExample = (id: string) => {
    const example = queueingExamples.find((e) => e.id === id);
    if (!example) {
      return;
    }
    try {
      setForm(fromFile(example.text));
      setFileName(`${example.id}.io.json`);
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
        setForm(fromFile(file.text));
        setFileName(file.name);
        setSolved(null);
      }
    } catch (e) {
      setNotice(e instanceof ParseError ? e.message : t("file.openError"));
    }
  };

  const saveFile = async () => {
    if (!built.model) {
      setNotice(t("queue.invalid"));
      return;
    }
    await downloadText(
      serializeQueueFile({ model: built.model, costs: costs() }),
      fileName,
      "json",
      t("file.filter"),
    );
  };

  const report = useMemo(() => {
    if (!solved) {
      return "";
    }
    const options = { numberFormat, decimals: DECIMALS };
    let text = reportQueue(solved.model, solved.result, options);
    if (solved.cost) {
      text += `\nCosto por unidad de tiempo con ${solved.result.servers} servidor${solved.result.servers === 1 ? "" : "es"}: servicio ${number(solved.cost.serviceCost)} + espera ${number(solved.cost.waitingCostTotal)} = ${number(solved.cost.total)}\n`;
    }
    if (solved.capacity) {
      text += `\n${reportCapacity(solved.capacity, options)}`;
    }
    return text;
  }, [solved, numberFormat, number]);

  const field = (
    label: string,
    key: keyof Form,
    invalidKey: string,
    testId: string,
  ) => (
    <label>
      {label}
      <input
        className={cls(invalidKey)}
        value={String(form[key])}
        onChange={(e) => set({ [key]: e.target.value } as Partial<Form>)}
        data-testid={testId}
      />
    </label>
  );

  return (
    <div className="workspace" data-testid="queue-module">
      <section className="panel model-panel" aria-labelledby="queue-title">
        <header className="panel-header">
          <h2 id="queue-title">{t("module.queueing")}</h2>
          <div className="toolbar">
            <select
              value=""
              onChange={(e) => loadExample(e.target.value)}
              aria-label={t("editor.examples")}
              data-testid="queue-examples"
            >
              <option value="" disabled>
                {t("editor.examplesChoose")}
              </option>
              {queueingExamples.map((e) => (
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
              data-testid="queue-solve"
            >
              {t("editor.solve")}
            </button>
          </div>
        </header>
        <div className="editor-area form-grid">
          <label>
            {t("queue.kind")}
            <select
              value={form.kind}
              onChange={(e) => set({ kind: e.target.value as QueueKind })}
              data-testid="queue-kind"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {QUEUE_KIND_NAMES[k]}
                </option>
              ))}
            </select>
          </label>
          {field(t("queue.lambda"), "lambda", "lambda", "queue-lambda")}
          {field(t("queue.mu"), "mu", "mu", "queue-mu")}
          {n.servers &&
            field(t("queue.servers"), "servers", "servers", "queue-servers")}
          {n.capacity &&
            field(
              t("queue.capacity"),
              "capacity",
              "capacity",
              "queue-capacity",
            )}
          {n.population &&
            field(
              t("queue.population"),
              "population",
              "population",
              "queue-population",
            )}
          {n.variance &&
            field(
              t("queue.variance"),
              "variance",
              "variance",
              "queue-variance",
            )}
          {n.phases &&
            field(t("queue.phases"), "phases", "phases", "queue-phases")}
          <h3>{t("queue.costs")}</h3>
          <label className="switch">
            <input
              type="checkbox"
              checked={form.useCosts}
              onChange={(e) => set({ useCosts: e.target.checked })}
              data-testid="queue-use-costs"
            />
            {t("queue.costs")}
          </label>
          {form.useCosts && (
            <>
              {field(
                t("queue.serverCost"),
                "serverCost",
                "serverCost",
                "queue-server-cost",
              )}
              {field(
                t("queue.waitingCost"),
                "waitingCost",
                "waitingCost",
                "queue-waiting-cost",
              )}
              <label>
                {t("queue.basis")}
                <select
                  value={form.basis}
                  onChange={(e) =>
                    set({ basis: e.target.value as "system" | "queue" })
                  }
                >
                  <option value="system">{t("queue.basisSystem")}</option>
                  <option value="queue">{t("queue.basisQueue")}</option>
                </select>
              </label>
            </>
          )}
          <h3>{t("queue.capacityAnalysis")}</h3>
          <label>
            {t("queue.vary")}
            <select
              value={form.vary}
              onChange={(e) => set({ vary: e.target.value as Vary })}
              data-testid="queue-vary"
            >
              <option value="servers">s</option>
              <option value="lambda">λ</option>
              <option value="mu">μ</option>
              <option value="capacity">K</option>
            </select>
          </label>
          {field(t("queue.values"), "values", "values", "queue-values")}
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
          <p className="editor-error" role="alert" data-testid="queue-notice">
            {notice}
          </p>
        )}
      </section>
      <section
        className="panel results-panel"
        aria-labelledby="queue-results-title"
      >
        <header className="panel-header">
          <h2 id="queue-results-title">{t("results.title")}</h2>
        </header>
        {solved === null ? (
          <p className="empty">{t("results.empty")}</p>
        ) : (
          <Tabs<TabKey>
            items={[
              { key: "solution", label: t("tab.solution") },
              {
                key: "pn",
                label: t("queue.pn"),
                disabled: solved.result.pnTable.length === 0,
              },
              {
                key: "capacity",
                label: t("queue.capacityAnalysis"),
                disabled: solved.capacity === null,
              },
            ]}
            active={tab}
            onChange={setTab}
            idPrefix="queue"
          >
            {tab === "solution" && (
              <div>
                <p
                  className={`status ${solved.result.stable ? "status-optimal" : "status-infeasible"}`}
                  data-testid="queue-status"
                >
                  {solved.result.stable
                    ? `L = ${number(solved.result.L)}, Lq = ${number(solved.result.Lq)}, W = ${number(solved.result.W)}, Wq = ${number(solved.result.Wq)}`
                    : t("queue.unstable")}
                </p>
                {solved.result.stable && (
                  <div className="table-scroll">
                    <table
                      className="data-table numeric"
                      data-testid="queue-measures"
                    >
                      <tbody>
                        {(
                          [
                            ["λ efectiva", solved.result.lambdaEff],
                            ["ρ", solved.result.rho],
                            ["L", solved.result.L],
                            ["Lq", solved.result.Lq],
                            ["W", solved.result.W],
                            ["Wq", solved.result.Wq],
                            ["P0", solved.result.P0],
                            ["P(esperar)", solved.result.probabilityOfWaiting],
                          ] as Array<[string, Fraction]>
                        ).map(([label, value]) => (
                          <tr key={label}>
                            <th scope="row">{label}</th>
                            <td>{number(value)}</td>
                          </tr>
                        ))}
                        {solved.cost && (
                          <tr>
                            <th scope="row">{t("transport.total")}</th>
                            <td data-testid="queue-cost">
                              {number(solved.cost.total)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                <pre className="report" data-testid="queue-report">
                  {report}
                </pre>
              </div>
            )}
            {tab === "pn" && (
              <div className="table-scroll">
                <table className="data-table numeric" data-testid="queue-pn">
                  <thead>
                    <tr>
                      <th>n</th>
                      <th>Pn</th>
                      <th>Acumulada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solved.result.pnTable.map((p) => (
                      <tr key={p.n}>
                        <td>{p.n}</td>
                        <td>{number(p.probability)}</td>
                        <td>{number(p.cumulative)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tab === "capacity" && solved.capacity && (
              <div className="table-scroll">
                <table
                  className="data-table numeric"
                  data-testid="queue-capacity"
                >
                  <thead>
                    <tr>
                      <th>
                        {
                          { servers: "s", lambda: "λ", mu: "μ", capacity: "K" }[
                            solved.capacity.vary
                          ]
                        }
                      </th>
                      <th>ρ</th>
                      <th>L</th>
                      <th>Lq</th>
                      <th>W</th>
                      <th>Wq</th>
                      <th>{t("transport.total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solved.capacity.rows.map((row, i) => (
                      <tr
                        key={i}
                        className={
                          i === solved.capacity!.best ? "critical-row" : ""
                        }
                      >
                        <td>{number(row.value)}</td>
                        <td>
                          {row.result.stable
                            ? number(row.result.rho)
                            : t("queue.unstable")}
                        </td>
                        <td>
                          {row.result.stable ? number(row.result.L) : "-"}
                        </td>
                        <td>
                          {row.result.stable ? number(row.result.Lq) : "-"}
                        </td>
                        <td>
                          {row.result.stable ? number(row.result.W) : "-"}
                        </td>
                        <td>
                          {row.result.stable ? number(row.result.Wq) : "-"}
                        </td>
                        <td>{row.cost ? number(row.cost.total) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="note">{solved.capacity.messages.join(" ")}</p>
              </div>
            )}
          </Tabs>
        )}
      </section>
    </div>
  );
}
