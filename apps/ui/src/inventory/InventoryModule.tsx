// SPDX-License-Identifier: GPL-3.0-or-later
// Módulo de inventarios: formulario por modelo, resultados, gráfico de nivel y curvas de costo contra Q.
import { useMemo, useState } from "react";
import {
  Fraction,
  ParseError,
  continuousReview,
  eoq,
  newsvendor,
  parseInventoryFile,
  reportContinuousReview,
  reportEoq,
  reportNewsvendor,
  serializeInventoryFile,
  type ContinuousReviewResult,
  type EoqInput,
  type EoqResult,
  type InventoryFile,
  type NewsvendorResult,
} from "@libreio/core";
import { t } from "../i18n";
import { inventoryExamples } from "../common/examples";
import { downloadText } from "../common/download";
import { openTextFile } from "../common/files";
import {
  DECIMALS,
  makeFormatter,
  type NumberFormat,
} from "../common/numberFormat";
import { Tabs } from "../common/Tabs";

type Model = "eoq" | "newsvendor" | "continuousReview";
type TabKey = "solution" | "level" | "costs";

interface Form {
  title: string;
  model: Model;
  demand: string;
  orderCost: string;
  holdingCost: string;
  holdingRate: string;
  unitCost: string;
  shortageCost: string;
  productionRate: string;
  leadTime: string;
  useDiscounts: boolean;
  breaks: Array<{ minQuantity: string; unitCost: string }>;
  cost: string;
  price: string;
  salvage: string;
  demandKind: "uniform" | "normal" | "discrete";
  min: string;
  max: string;
  mean: string;
  sd: string;
  values: string;
  probabilities: string;
  orderQuantity: string;
  ltMean: string;
  ltSd: string;
  serviceLevel: string;
}

type Solved =
  | {
      readonly model: "eoq";
      readonly input: EoqInput;
      readonly result: EoqResult;
    }
  | { readonly model: "newsvendor"; readonly result: NewsvendorResult }
  | {
      readonly model: "continuousReview";
      readonly result: ContinuousReviewResult;
    };

const defaultForm: Form = {
  title: "",
  model: "eoq",
  demand: "1200",
  orderCost: "100",
  holdingCost: "6",
  holdingRate: "",
  unitCost: "",
  shortageCost: "",
  productionRate: "",
  leadTime: "",
  useDiscounts: false,
  breaks: [
    { minQuantity: "0", unitCost: "5" },
    { minQuantity: "500", unitCost: "4.5" },
  ],
  cost: "4",
  price: "10",
  salvage: "2",
  demandKind: "uniform",
  min: "100",
  max: "200",
  mean: "150",
  sd: "20",
  values: "100, 150, 200, 250",
  probabilities: "0.2, 0.4, 0.3, 0.1",
  orderQuantity: "200",
  ltMean: "100",
  ltSd: "20",
  serviceLevel: "0.95",
};

const str = (f: Fraction | undefined) => (f === undefined ? "" : f.toString());

function fromFile(text: string): Form {
  const file = parseInventoryFile(text);
  const base: Form = {
    ...defaultForm,
    title: file.title ?? "",
    model: file.model,
  };
  if (file.model === "eoq") {
    const i = file.input;
    return {
      ...base,
      demand: str(i.demand),
      orderCost: str(i.orderCost),
      holdingCost: str(i.holdingCost),
      holdingRate: str(i.holdingRate),
      unitCost: str(i.unitCost),
      shortageCost: str(i.shortageCost),
      productionRate: str(i.productionRate),
      leadTime: str(i.leadTime),
      useDiscounts: (i.priceBreaks?.length ?? 0) > 0,
      breaks:
        i.priceBreaks?.map((b) => ({
          minQuantity: str(b.minQuantity),
          unitCost: str(b.unitCost),
        })) ?? defaultForm.breaks,
    };
  }
  if (file.model === "newsvendor") {
    const i = file.input;
    const d = i.demand;
    return {
      ...base,
      cost: str(i.cost),
      price: str(i.price),
      salvage: str(i.salvage),
      demandKind: d.kind,
      ...(d.kind === "uniform" ? { min: str(d.min), max: str(d.max) } : {}),
      ...(d.kind === "normal" ? { mean: str(d.mean), sd: str(d.sd) } : {}),
      ...(d.kind === "discrete"
        ? {
            values: d.values.map(str).join(", "),
            probabilities: d.probabilities.map(str).join(", "),
          }
        : {}),
    };
  }
  const i = file.input;
  return {
    ...base,
    demand: str(i.demand),
    orderQuantity: str(i.orderQuantity),
    leadTime: str(i.leadTime),
    ltMean: str(i.leadTimeDemand.mean),
    ltSd: str(i.leadTimeDemand.sd),
    serviceLevel: String(i.serviceLevel),
  };
}

function build(f: Form): { file: InventoryFile | null; invalid: Set<string> } {
  const invalid = new Set<string>();
  const num = (text: string, key: string): Fraction => {
    try {
      return Fraction.parse(text.trim());
    } catch {
      invalid.add(key);
      return Fraction.ZERO;
    }
  };
  const opt = (text: string, key: string): Fraction | undefined =>
    text.trim() === "" ? undefined : num(text, key);
  const list = (text: string, key: string): Fraction[] =>
    text
      .split(/[,;\s]+/)
      .filter((v) => v !== "")
      .map((v) => num(v, key));
  const title = f.title.trim() === "" ? null : f.title.trim();
  if (f.model === "eoq") {
    const holdingCost = opt(f.holdingCost, "holdingCost");
    const holdingRate = opt(f.holdingRate, "holdingRate");
    const unitCost = opt(f.unitCost, "unitCost");
    const shortageCost = opt(f.shortageCost, "shortageCost");
    const productionRate = opt(f.productionRate, "productionRate");
    const leadTime = opt(f.leadTime, "leadTime");
    const input: EoqInput = {
      demand: num(f.demand, "demand"),
      orderCost: num(f.orderCost, "orderCost"),
      ...(holdingCost !== undefined ? { holdingCost } : {}),
      ...(holdingRate !== undefined ? { holdingRate } : {}),
      ...(unitCost !== undefined ? { unitCost } : {}),
      ...(shortageCost !== undefined ? { shortageCost } : {}),
      ...(productionRate !== undefined ? { productionRate } : {}),
      ...(leadTime !== undefined ? { leadTime } : {}),
      ...(f.useDiscounts
        ? {
            priceBreaks: f.breaks.map((b, k) => ({
              minQuantity: num(b.minQuantity, `break-min-${k}`),
              unitCost: num(b.unitCost, `break-cost-${k}`),
            })),
          }
        : {}),
    };
    if (
      !f.useDiscounts &&
      holdingCost === undefined &&
      (holdingRate === undefined || unitCost === undefined)
    ) {
      invalid.add("holdingCost");
    }
    if (f.useDiscounts && holdingRate === undefined) {
      invalid.add("holdingRate");
    }
    return {
      file: invalid.size > 0 ? null : { model: "eoq", title, input },
      invalid,
    };
  }
  if (f.model === "newsvendor") {
    const salvage = opt(f.salvage, "salvage");
    const demand =
      f.demandKind === "uniform"
        ? {
            kind: "uniform" as const,
            min: num(f.min, "min"),
            max: num(f.max, "max"),
          }
        : f.demandKind === "normal"
          ? {
              kind: "normal" as const,
              mean: num(f.mean, "mean"),
              sd: num(f.sd, "sd"),
            }
          : {
              kind: "discrete" as const,
              values: list(f.values, "values"),
              probabilities: list(f.probabilities, "probabilities"),
            };
    if (
      demand.kind === "discrete" &&
      (demand.values.length === 0 ||
        demand.values.length !== demand.probabilities.length)
    ) {
      invalid.add("values");
    }
    return {
      file:
        invalid.size > 0
          ? null
          : {
              model: "newsvendor",
              title,
              input: {
                cost: num(f.cost, "cost"),
                price: num(f.price, "price"),
                ...(salvage !== undefined ? { salvage } : {}),
                demand,
              },
            },
      invalid,
    };
  }
  const level = Number(f.serviceLevel);
  if (!(level > 0 && level < 1)) {
    invalid.add("serviceLevel");
  }
  return {
    file:
      invalid.size > 0
        ? null
        : {
            model: "continuousReview",
            title,
            input: {
              demand: num(f.demand, "demand"),
              orderQuantity: num(f.orderQuantity, "orderQuantity"),
              leadTime: num(f.leadTime, "leadTime"),
              leadTimeDemand: {
                mean: num(f.ltMean, "ltMean"),
                sd: num(f.ltSd, "ltSd"),
              },
              serviceLevel: level,
            },
          },
    invalid,
  };
}

function LevelChart({
  quantity,
  maxInventory,
  cycle,
  reorderPoint,
  shortage,
}: {
  quantity: number;
  maxInventory: number;
  cycle: number;
  reorderPoint: number | null;
  shortage: number | null;
}) {
  const W = 640;
  const H = 240;
  const PAD = 44;
  const cycles = 3;
  const totalTime = cycle * cycles;
  const top = Math.max(maxInventory, quantity, reorderPoint ?? 0, 1);
  const bottom = shortage ? -shortage : 0;
  const sx = (x: number) => PAD + (x / totalTime) * (W - 2 * PAD);
  const sy = (y: number) =>
    H - PAD - ((y - bottom) / (top - bottom)) * (H - 2 * PAD);
  const points: string[] = [];
  for (let k = 0; k < cycles; k += 1) {
    const start = k * cycle;
    points.push(`${sx(start)},${sy(maxInventory)}`);
    points.push(`${sx(start + cycle)},${sy(bottom)}`);
  }
  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Nivel de inventario"
      data-testid="inventory-level"
    >
      <rect x={0} y={0} width={W} height={H} fill="var(--surface)" />
      <line x1={PAD} y1={sy(0)} x2={W - PAD} y2={sy(0)} stroke="var(--muted)" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="var(--muted)" />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.5}
      />
      {reorderPoint !== null && (
        <>
          <line
            x1={PAD}
            y1={sy(reorderPoint)}
            x2={W - PAD}
            y2={sy(reorderPoint)}
            stroke="var(--warn)"
            strokeDasharray="6 4"
          />
          <text
            x={W - PAD}
            y={sy(reorderPoint) - 4}
            fontSize={11}
            textAnchor="end"
            fill="var(--warn)"
          >
            ROP = {reorderPoint.toFixed(1)}
          </text>
        </>
      )}
      <text
        x={PAD - 6}
        y={sy(maxInventory) + 4}
        fontSize={11}
        textAnchor="end"
        fill="var(--text)"
      >
        {maxInventory.toFixed(1)}
      </text>
      <text
        x={W / 2}
        y={H - 8}
        fontSize={12}
        textAnchor="middle"
        fill="var(--text)"
      >
        Tiempo (ciclo = {cycle.toFixed(3)})
      </text>
    </svg>
  );
}

function CostChart({ input, result }: { input: EoqInput; result: EoqResult }) {
  const W = 640;
  const H = 260;
  const PAD = 48;
  const q = result.quantity.toNumber();
  const h = result.holdingCost.toNumber();
  const D = input.demand.toNumber();
  const K = input.orderCost.toNumber();
  const rate = input.productionRate
    ? 1 - D / input.productionRate.toNumber()
    : 1;
  const qMax = q * 2.5;
  const steps = 60;
  const ordering = (x: number) => (D * K) / x;
  const holding = (x: number) => (h * x * rate) / 2;
  const xs = Array.from({ length: steps }, (_, i) => ((i + 1) / steps) * qMax);
  const yMax = Math.max(...xs.map((x) => ordering(x) + holding(x)).slice(5));
  const sx = (x: number) => PAD + (x / qMax) * (W - 2 * PAD);
  const sy = (y: number) =>
    H - PAD - (Math.min(y, yMax) / yMax) * (H - 2 * PAD);
  const line = (f: (x: number) => number) =>
    xs.map((x) => `${sx(x)},${sy(f(x))}`).join(" ");
  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Costos contra Q"
      data-testid="inventory-costs"
    >
      <rect x={0} y={0} width={W} height={H} fill="var(--surface)" />
      <line
        x1={PAD}
        y1={H - PAD}
        x2={W - PAD}
        y2={H - PAD}
        stroke="var(--muted)"
      />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="var(--muted)" />
      <polyline
        points={line(ordering)}
        fill="none"
        stroke="var(--warn)"
        strokeWidth={2}
      />
      <polyline
        points={line(holding)}
        fill="none"
        stroke="var(--ok)"
        strokeWidth={2}
      />
      <polyline
        points={line((x) => ordering(x) + holding(x))}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.5}
      />
      <line
        x1={sx(q)}
        y1={PAD}
        x2={sx(q)}
        y2={H - PAD}
        stroke="var(--text)"
        strokeDasharray="4 4"
      />
      <text
        x={sx(q)}
        y={H - PAD + 16}
        fontSize={11}
        textAnchor="middle"
        fill="var(--text)"
      >
        Q* = {q.toFixed(1)}
      </text>
      <text
        x={W - PAD}
        y={PAD}
        fontSize={11}
        textAnchor="end"
        fill="var(--accent)"
      >
        total
      </text>
      <text
        x={W - PAD}
        y={PAD + 14}
        fontSize={11}
        textAnchor="end"
        fill="var(--warn)"
      >
        pedir
      </text>
      <text
        x={W - PAD}
        y={PAD + 28}
        fontSize={11}
        textAnchor="end"
        fill="var(--ok)"
      >
        mantener
      </text>
    </svg>
  );
}

const initialExample = inventoryExamples.find((e) => e.id.startsWith("INV-01"));

export function InventoryModule() {
  const [form, setForm] = useState<Form>(() => {
    try {
      return initialExample ? fromFile(initialExample.text) : defaultForm;
    } catch {
      return defaultForm;
    }
  });
  const [fileName, setFileName] = useState(
    initialExample ? `${initialExample.id}.io.json` : "inventario.io.json",
  );
  const [numberFormat, setNumberFormat] = useState<NumberFormat>("fraction");
  const [solved, setSolved] = useState<Solved | null>(null);
  const [tab, setTab] = useState<TabKey>("solution");
  const [notice, setNotice] = useState<string | null>(null);
  const built = useMemo(() => build(form), [form]);
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const cls = (key: string) =>
    `short${built.invalid.has(key) ? " invalid" : ""}`;

  const solve = () => {
    if (!built.file) {
      setNotice(t("inv.invalid"));
      return;
    }
    try {
      const file = built.file;
      if (file.model === "eoq") {
        setSolved({ model: "eoq", input: file.input, result: eoq(file.input) });
      } else if (file.model === "newsvendor") {
        setSolved({ model: "newsvendor", result: newsvendor(file.input) });
      } else {
        setSolved({
          model: "continuousReview",
          result: continuousReview(file.input),
        });
      }
      setNotice(null);
      setTab("solution");
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const loadExample = (id: string) => {
    const example = inventoryExamples.find((e) => e.id === id);
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
    if (!built.file) {
      setNotice(t("inv.invalid"));
      return;
    }
    await downloadText(
      serializeInventoryFile(built.file),
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
    if (solved.model === "eoq") {
      return reportEoq(solved.input, solved.result, options);
    }
    if (solved.model === "newsvendor") {
      return reportNewsvendor(solved.result, options);
    }
    return reportContinuousReview(solved.result, options);
  }, [solved, numberFormat]);

  const number = makeFormatter(numberFormat);
  const status = useMemo(() => {
    if (!solved) {
      return "";
    }
    if (solved.model === "eoq") {
      const r = solved.result;
      return `Q* = ${r.exact ? number(r.quantity) : r.quantity.toDecimal(2)}. Costo de pedir más mantener ${r.exact ? number(r.annualCost) : r.annualCost.toDecimal(2)}. ${number(r.ordersPerPeriod)} pedidos por período.`;
    }
    if (solved.model === "newsvendor") {
      return `Razón crítica ${number(solved.result.criticalRatio)}. Q* = ${solved.result.z === null ? number(solved.result.quantity) : solved.result.quantity.toDecimal(2)}.`;
    }
    return `Stock de seguridad ${solved.result.safetyStock.toDecimal(1)}. Punto de reorden ${solved.result.reorderPoint.toDecimal(1)}.`;
  }, [solved, number]);

  const field = (label: string, key: keyof Form, testId: string) => (
    <label>
      {label}
      <input
        className={cls(key)}
        value={String(form[key])}
        onChange={(e) => set({ [key]: e.target.value } as Partial<Form>)}
        data-testid={testId}
      />
    </label>
  );

  return (
    <div className="workspace" data-testid="inventory-module">
      <section className="panel model-panel" aria-labelledby="inventory-title">
        <header className="panel-header">
          <h2 id="inventory-title">{t("module.inventory")}</h2>
          <div className="toolbar">
            <select
              value=""
              onChange={(e) => loadExample(e.target.value)}
              aria-label={t("editor.examples")}
              data-testid="inventory-examples"
            >
              <option value="" disabled>
                {t("editor.examplesChoose")}
              </option>
              {inventoryExamples.map((e) => (
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
              data-testid="inventory-solve"
            >
              {t("editor.solve")}
            </button>
          </div>
        </header>
        <div className="editor-area form-grid">
          <label>
            {t("inv.model")}
            <select
              value={form.model}
              onChange={(e) => set({ model: e.target.value as Model })}
              data-testid="inventory-model"
            >
              <option value="eoq">{t("inv.eoq")}</option>
              <option value="newsvendor">{t("inv.newsvendor")}</option>
              <option value="continuousReview">{t("inv.continuous")}</option>
            </select>
          </label>
          {form.model === "eoq" && (
            <>
              {field(t("inv.demand"), "demand", "inv-demand")}
              {field(t("inv.orderCost"), "orderCost", "inv-order-cost")}
              {!form.useDiscounts &&
                field(t("inv.holdingCost"), "holdingCost", "inv-holding-cost")}
              {(form.useDiscounts || form.holdingCost.trim() === "") &&
                field(t("inv.holdingRate"), "holdingRate", "inv-holding-rate")}
              {!form.useDiscounts &&
                field(t("inv.unitCost"), "unitCost", "inv-unit-cost")}
              {field(t("inv.shortageCost"), "shortageCost", "inv-shortage")}
              {field(
                t("inv.productionRate"),
                "productionRate",
                "inv-production",
              )}
              {field(t("inv.leadTime"), "leadTime", "inv-lead-time")}
              <label className="switch">
                <input
                  type="checkbox"
                  checked={form.useDiscounts}
                  onChange={(e) => set({ useDiscounts: e.target.checked })}
                  data-testid="inv-use-discounts"
                />
                {t("inv.discounts")}
              </label>
              {form.useDiscounts && (
                <div className="table-scroll">
                  <table className="data-table editor-grid">
                    <tbody>
                      {form.breaks.map((b, k) => (
                        <tr key={k}>
                          <td>
                            <input
                              className={`cell${built.invalid.has(`break-min-${k}`) ? " invalid" : ""}`}
                              value={b.minQuantity}
                              onChange={(e) =>
                                set({
                                  breaks: form.breaks.map((x, m) =>
                                    m === k
                                      ? { ...x, minQuantity: e.target.value }
                                      : x,
                                  ),
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              className={`cell${built.invalid.has(`break-cost-${k}`) ? " invalid" : ""}`}
                              value={b.unitCost}
                              onChange={(e) =>
                                set({
                                  breaks: form.breaks.map((x, m) =>
                                    m === k
                                      ? { ...x, unitCost: e.target.value }
                                      : x,
                                  ),
                                })
                              }
                            />
                          </td>
                          <td>
                            {form.breaks.length > 1 && (
                              <button
                                type="button"
                                className="icon"
                                onClick={() =>
                                  set({
                                    breaks: form.breaks.filter(
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
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      set({
                        breaks: [
                          ...form.breaks,
                          { minQuantity: "1000", unitCost: "4" },
                        ],
                      })
                    }
                  >
                    +
                  </button>
                </div>
              )}
            </>
          )}
          {form.model === "newsvendor" && (
            <>
              {field(t("inv.cost"), "cost", "inv-cost")}
              {field(t("inv.price"), "price", "inv-price")}
              {field(t("inv.salvage"), "salvage", "inv-salvage")}
              <label>
                {t("inv.demandKind")}
                <select
                  value={form.demandKind}
                  onChange={(e) =>
                    set({ demandKind: e.target.value as Form["demandKind"] })
                  }
                  data-testid="inv-demand-kind"
                >
                  <option value="uniform">{t("inv.uniform")}</option>
                  <option value="normal">{t("inv.normal")}</option>
                  <option value="discrete">{t("inv.discrete")}</option>
                </select>
              </label>
              {form.demandKind === "uniform" && (
                <>
                  {field(t("inv.min"), "min", "inv-min")}
                  {field(t("inv.max"), "max", "inv-max")}
                </>
              )}
              {form.demandKind === "normal" && (
                <>
                  {field(t("inv.mean"), "mean", "inv-mean")}
                  {field(t("inv.sd"), "sd", "inv-sd")}
                </>
              )}
              {form.demandKind === "discrete" && (
                <>
                  {field(t("inv.values"), "values", "inv-values")}
                  {field(
                    t("inv.probabilities"),
                    "probabilities",
                    "inv-probabilities",
                  )}
                </>
              )}
            </>
          )}
          {form.model === "continuousReview" && (
            <>
              {field(t("inv.demand"), "demand", "inv-demand")}
              {field(
                t("inv.orderQuantity"),
                "orderQuantity",
                "inv-order-quantity",
              )}
              {field(t("inv.leadTime"), "leadTime", "inv-lead-time")}
              {field(
                `${t("inv.mean")} (${t("inv.leadTime").toLowerCase()})`,
                "ltMean",
                "inv-lt-mean",
              )}
              {field(
                `${t("inv.sd")} (${t("inv.leadTime").toLowerCase()})`,
                "ltSd",
                "inv-lt-sd",
              )}
              {field(
                t("inv.serviceLevel"),
                "serviceLevel",
                "inv-service-level",
              )}
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
          <p
            className="editor-error"
            role="alert"
            data-testid="inventory-notice"
          >
            {notice}
          </p>
        )}
      </section>
      <section
        className="panel results-panel"
        aria-labelledby="inventory-results-title"
      >
        <header className="panel-header">
          <h2 id="inventory-results-title">{t("results.title")}</h2>
        </header>
        {solved === null ? (
          <p className="empty">{t("results.empty")}</p>
        ) : (
          <Tabs<TabKey>
            items={[
              { key: "solution", label: t("tab.solution") },
              {
                key: "level",
                label: t("inv.level"),
                disabled: solved.model === "newsvendor",
              },
              {
                key: "costs",
                label: t("inv.costCurve"),
                disabled: solved.model !== "eoq",
              },
            ]}
            active={tab}
            onChange={setTab}
            idPrefix="inventory"
          >
            {tab === "solution" && (
              <div>
                <p
                  className="status status-optimal"
                  data-testid="inventory-status"
                >
                  {status}
                </p>
                <pre className="report" data-testid="inventory-report">
                  {report}
                </pre>
              </div>
            )}
            {tab === "level" && solved.model === "eoq" && (
              <LevelChart
                quantity={solved.result.quantity.toNumber()}
                maxInventory={solved.result.maxInventory.toNumber()}
                cycle={solved.result.cycleTime.toNumber()}
                reorderPoint={
                  solved.result.reorderPoint
                    ? solved.result.reorderPoint.toNumber()
                    : null
                }
                shortage={
                  solved.result.shortage
                    ? solved.result.shortage.toNumber()
                    : null
                }
              />
            )}
            {tab === "level" && solved.model === "continuousReview" && (
              <LevelChart
                quantity={solved.result.input.orderQuantity.toNumber()}
                maxInventory={
                  solved.result.input.orderQuantity.toNumber() +
                  solved.result.safetyStock.toNumber()
                }
                cycle={solved.result.cycleTime.toNumber()}
                reorderPoint={solved.result.reorderPoint.toNumber()}
                shortage={null}
              />
            )}
            {tab === "costs" && solved.model === "eoq" && (
              <CostChart input={solved.input} result={solved.result} />
            )}
          </Tabs>
        )}
      </section>
    </div>
  );
}
