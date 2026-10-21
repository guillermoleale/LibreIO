// SPDX-License-Identifier: GPL-3.0-or-later
// Módulo de programación lineal: editor a la izquierda, resultados a la derecha.
import { useCallback, useMemo, useState } from "react";
import {
  ParseError,
  graphicalAnalysis,
  parseLP,
  solveLP,
  type EnteringRule,
  type GraphicalAnalysis,
  type LPModel,
  type LPResult,
  type SimplexMethod,
} from "@libreio/core";
import { t } from "../i18n";
import { lpExamples } from "../common/examples";
import { openTextFile, saveTextFile } from "../common/files";
import type { NumberFormat } from "../common/numberFormat";
import { Tabs } from "../common/Tabs";
import { GraphTab } from "./GraphTab";
import { ModelEditor } from "./ModelEditor";
import { ModelTab } from "./ModelTab";
import { SensitivityTab } from "./SensitivityTab";
import { SolutionTab, type ReportFormat } from "./SolutionTab";
import { TableauTab } from "./TableauTab";

type TabKey = "model" | "solution" | "tableau" | "graph" | "sensitivity";

interface ParseOutcome {
  readonly model: LPModel | null;
  readonly errorLine: number | null;
  readonly errorMessage: string | null;
}

export interface Solved {
  readonly model: LPModel;
  readonly result: LPResult;
  readonly graphical: GraphicalAnalysis;
}

function tryParse(text: string): ParseOutcome {
  if (text.trim() === "") {
    return { model: null, errorLine: null, errorMessage: null };
  }
  try {
    return { model: parseLP(text), errorLine: null, errorMessage: null };
  } catch (e) {
    if (e instanceof ParseError) {
      return { model: null, errorLine: e.line, errorMessage: e.message };
    }
    return { model: null, errorLine: null, errorMessage: String(e) };
  }
}

const defaultText =
  lpExamples.find((e) => e.id.startsWith("LP-01"))?.text ?? "";

export function LPModule() {
  const [text, setText] = useState(defaultText);
  const [fileName, setFileName] = useState("LP-01-optimo-unico.lp");
  const [method, setMethod] = useState<SimplexMethod>("twoPhase");
  const [rule, setRule] = useState<EnteringRule>("dantzig");
  const [numberFormat, setNumberFormat] = useState<NumberFormat>("fraction");
  const [reportFormat, setReportFormat] = useState<ReportFormat>("combined");
  const [solved, setSolved] = useState<Solved | null>(null);
  const [solveCount, setSolveCount] = useState(0);
  const [tab, setTab] = useState<TabKey>("solution");
  const [notice, setNotice] = useState<string | null>(null);

  const live = useMemo(() => tryParse(text), [text]);

  const solveModel = useCallback(
    (model: LPModel) => {
      const result = solveLP(model, { method, rule });
      const graphical = graphicalAnalysis(model);
      setSolved({ model, result, graphical });
      setSolveCount((n) => n + 1);
    },
    [method, rule],
  );

  const solve = useCallback(() => {
    const parsed = tryParse(text);
    if (parsed.model === null) {
      setSolved(null);
      return;
    }
    solveModel(parsed.model);
    setTab((current) => (current === "model" ? "solution" : current));
  }, [text, solveModel]);

  const loadExample = (id: string) => {
    const example = lpExamples.find((e) => e.id === id);
    if (example) {
      setText(example.text);
      setFileName(`${example.id}.lp`);
      setSolved(null);
    }
  };

  const openFile = async () => {
    try {
      const file = await openTextFile(["lp", "txt"], t("file.filter"));
      if (file) {
        setText(file.text);
        setFileName(file.name);
        setSolved(null);
        setNotice(null);
      }
    } catch {
      setNotice(t("file.openError"));
    }
  };

  const saveFile = async () => {
    try {
      await saveTextFile(text, fileName, ["lp"], t("file.filter"));
    } catch {
      setNotice(t("file.saveError"));
    }
  };

  const applyModelText = (newText: string) => {
    setText(newText);
    const parsed = tryParse(newText);
    if (parsed.model) {
      solveModel(parsed.model);
    }
  };

  const graphDisabled = solved === null || !solved.graphical.applicable;
  const sensitivityDisabled =
    solved === null || solved.result.status !== "optimal";
  const activeTab: TabKey =
    (tab === "graph" && graphDisabled) ||
    (tab === "sensitivity" && sensitivityDisabled)
      ? "solution"
      : tab;

  return (
    <div className="workspace" data-testid="lp-module">
      <section className="panel model-panel" aria-labelledby="model-title">
        <header className="panel-header">
          <h2 id="model-title">{t("editor.title")}</h2>
          <div className="toolbar">
            <label className="select-label">
              <span className="visually-hidden">{t("editor.examples")}</span>
              <select
                value=""
                onChange={(e) => loadExample(e.target.value)}
                aria-label={t("editor.examples")}
                data-testid="examples-select"
              >
                <option value="" disabled>
                  {t("editor.examplesChoose")}
                </option>
                {lpExamples.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary"
              onClick={openFile}
              data-testid="open-button"
            >
              {t("editor.open")}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={saveFile}
              data-testid="save-button"
            >
              {t("editor.save")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={solve}
              title={t("editor.solveHint")}
              data-testid="solve-button"
            >
              {t("editor.solve")}
            </button>
          </div>
        </header>
        <ModelEditor
          value={text}
          onChange={setText}
          onSolve={solve}
          errorLine={live.errorLine}
          errorMessage={live.errorMessage}
        />
        <div className="options" data-testid="options">
          <label>
            {t("options.method")}
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as SimplexMethod)}
              data-testid="method-select"
            >
              <option value="twoPhase">{t("options.twoPhase")}</option>
              <option value="bigM">{t("options.bigM")}</option>
            </select>
          </label>
          <label>
            {t("options.rule")}
            <select
              value={rule}
              onChange={(e) => setRule(e.target.value as EnteringRule)}
              data-testid="rule-select"
            >
              <option value="dantzig">{t("options.dantzig")}</option>
              <option value="bland">{t("options.bland")}</option>
            </select>
          </label>
          <label>
            {t("options.numbers")}
            <select
              value={numberFormat}
              onChange={(e) => setNumberFormat(e.target.value as NumberFormat)}
              data-testid="numbers-select"
            >
              <option value="fraction">{t("options.fraction")}</option>
              <option value="decimal">{t("options.decimal")}</option>
            </select>
          </label>
        </div>
        {notice !== null && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
      </section>
      <section className="panel results-panel" aria-labelledby="results-title">
        <header className="panel-header">
          <h2 id="results-title">{t("results.title")}</h2>
        </header>
        {solved === null ? (
          <p className="empty" data-testid="results-empty">
            {live.errorMessage !== null
              ? t("results.fixErrors")
              : t("results.empty")}
          </p>
        ) : (
          <Tabs<TabKey>
            items={[
              { key: "model", label: t("tab.model") },
              { key: "solution", label: t("tab.solution") },
              { key: "tableau", label: t("tab.tableau") },
              { key: "graph", label: t("tab.graph"), disabled: graphDisabled },
              {
                key: "sensitivity",
                label: t("tab.sensitivity"),
                disabled: sensitivityDisabled,
              },
            ]}
            active={activeTab}
            onChange={setTab}
            idPrefix="lp"
          >
            {activeTab === "model" && (
              <ModelTab solved={solved} numberFormat={numberFormat} />
            )}
            {activeTab === "solution" && (
              <SolutionTab
                solved={solved}
                numberFormat={numberFormat}
                format={reportFormat}
                onFormatChange={setReportFormat}
              />
            )}
            {activeTab === "tableau" && (
              <TableauTab
                key={solveCount}
                solved={solved}
                numberFormat={numberFormat}
              />
            )}
            {activeTab === "graph" && (
              <GraphTab
                key={solveCount}
                solved={solved}
                numberFormat={numberFormat}
                onApplyModel={applyModelText}
              />
            )}
            {activeTab === "sensitivity" && (
              <SensitivityTab solved={solved} numberFormat={numberFormat} />
            )}
          </Tabs>
        )}
      </section>
    </div>
  );
}
