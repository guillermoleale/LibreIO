// SPDX-License-Identifier: GPL-3.0-or-later
// Módulo de programación lineal: editor a la izquierda, resultados a la derecha.
import { useCallback, useMemo, useState } from "react";
import { ParseError, parseLP, type LPModel } from "@libreio/core";
import { t } from "../i18n";
import { lpExamples } from "../common/examples";
import { openTextFile, saveTextFile } from "../common/files";
import { Tabs } from "../common/Tabs";
import { ModelEditor } from "./ModelEditor";
import { ModelTab } from "./ModelTab";

type TabKey = "model";

interface ParseOutcome {
  readonly model: LPModel | null;
  readonly errorLine: number | null;
  readonly errorMessage: string | null;
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
  const [fileName, setFileName] = useState("modelo.lp");
  const [submitted, setSubmitted] = useState<ParseOutcome | null>(null);
  const [tab, setTab] = useState<TabKey>("model");
  const [notice, setNotice] = useState<string | null>(null);

  const live = useMemo(() => tryParse(text), [text]);

  const solve = useCallback(() => {
    setSubmitted(tryParse(text));
  }, [text]);

  const loadExample = (id: string) => {
    const example = lpExamples.find((e) => e.id === id);
    if (example) {
      setText(example.text);
      setFileName(`${example.id}.lp`);
      setSubmitted(null);
    }
  };

  const openFile = async () => {
    try {
      const file = await openTextFile(["lp", "txt"], t("file.filter"));
      if (file) {
        setText(file.text);
        setFileName(file.name);
        setSubmitted(null);
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

  const shown = submitted ?? live;
  const errorLine = live.errorLine;
  const errorMessage = live.errorMessage;

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
          errorLine={errorLine}
          errorMessage={errorMessage}
        />
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
        {shown.model === null ? (
          <p className="empty" data-testid="results-empty">
            {t("results.empty")}
          </p>
        ) : (
          <Tabs<TabKey>
            items={[{ key: "model", label: t("tab.model") }]}
            active={tab}
            onChange={setTab}
            idPrefix="lp"
          >
            <ModelTab model={shown.model} />
          </Tabs>
        )}
      </section>
    </div>
  );
}
