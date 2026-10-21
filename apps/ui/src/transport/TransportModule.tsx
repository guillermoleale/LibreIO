// SPDX-License-Identifier: GPL-3.0-or-later
// Módulo de transporte, transbordo y asignación: matriz editable a la izquierda, resultados a la derecha.
import { useMemo, useState } from "react";
import {
  ParseError,
  parseTransportFile,
  reportAssignment,
  reportTransport,
  reportTransshipment,
  serializeTransportFile,
  solveAssignment,
  solveTransport,
  solveTransshipment,
  type AssignmentResult,
  type InitialMethod,
  type TransportFile,
  type TransportResult,
  type TransshipmentResult,
} from "@libreio/core";
import { t } from "../i18n";
import { transportExamples } from "../common/examples";
import { downloadText } from "../common/download";
import { openTextFile } from "../common/files";
import {
  DECIMALS,
  makeFormatter,
  type NumberFormat,
} from "../common/numberFormat";
import { Tabs } from "../common/Tabs";
import {
  buildAssignment,
  buildTransport,
  buildTransshipment,
  emptyAssignment,
  emptyTransport,
  emptyTransshipment,
  fileToDrafts,
  type AssignmentDraft,
  type Kind,
  type Sense,
  type TransportDraft,
  type TransshipmentDraft,
} from "./drafts";
import {
  AssignmentEditor,
  TransportEditor,
  TransshipmentEditor,
} from "./Editors";
import { HungarianSteps } from "./HungarianSteps";
import { TransportIterations, TransportSensitivity } from "./TransportResults";

type TabKey = "solution" | "iterations" | "sensitivity";

type Solved =
  | { readonly kind: "transport"; readonly result: TransportResult }
  | { readonly kind: "transshipment"; readonly result: TransshipmentResult }
  | { readonly kind: "assignment"; readonly result: AssignmentResult };

const INITIAL_METHODS: InitialMethod[] = [
  "northwest",
  "matrixMinimum",
  "rowMinimum",
  "columnMinimum",
  "vogel",
  "russell",
];
const INITIAL_LABELS: Record<InitialMethod, string> = {
  northwest: "Esquina noroeste",
  matrixMinimum: "Mínimo de matriz",
  rowMinimum: "Mínimo de fila",
  columnMinimum: "Mínimo de columna",
  vogel: "Vogel",
  russell: "Russell",
};

function loadExampleDrafts(id: string) {
  const example = transportExamples.find((e) => e.id === id);
  if (!example) {
    return null;
  }
  try {
    return {
      drafts: fileToDrafts(parseTransportFile(example.text)),
      name: `${example.id}.io.json`,
    };
  } catch {
    return null;
  }
}

const initial = loadExampleDrafts("TR-01-transporte");

export function TransportModule() {
  const [kind, setKind] = useState<Kind>(initial?.drafts.kind ?? "transport");
  const [transport, setTransport] = useState<TransportDraft>(
    initial?.drafts.transport ?? emptyTransport,
  );
  const [transshipment, setTransshipment] =
    useState<TransshipmentDraft>(emptyTransshipment);
  const [assignment, setAssignment] =
    useState<AssignmentDraft>(emptyAssignment);
  const [initialMethod, setInitialMethod] = useState<InitialMethod>("vogel");
  const [numberFormat, setNumberFormat] = useState<NumberFormat>("fraction");
  const [fileName, setFileName] = useState(initial?.name ?? "problema.io.json");
  const [solved, setSolved] = useState<Solved | null>(null);
  const [solveCount, setSolveCount] = useState(0);
  const [tab, setTab] = useState<TabKey>("solution");
  const [notice, setNotice] = useState<string | null>(null);
  const number = makeFormatter(numberFormat);

  const built = useMemo(() => {
    if (kind === "transport") {
      return buildTransport(transport);
    }
    if (kind === "transshipment") {
      return buildTransshipment(transshipment);
    }
    return buildAssignment(assignment);
  }, [kind, transport, transshipment, assignment]);

  const sense: Sense =
    kind === "transport"
      ? transport.sense
      : kind === "transshipment"
        ? transshipment.sense
        : assignment.sense;
  const setSense = (s: Sense) => {
    if (kind === "transport") {
      setTransport({ ...transport, sense: s });
    } else if (kind === "transshipment") {
      setTransshipment({ ...transshipment, sense: s });
    } else {
      setAssignment({ ...assignment, sense: s });
    }
  };

  const solve = () => {
    if (!built.problem) {
      setNotice(t("transport.invalid"));
      return;
    }
    setNotice(null);
    if (kind === "transport") {
      setSolved({
        kind,
        result: solveTransport(buildTransport(transport).problem!, {
          initial: initialMethod,
        }),
      });
    } else if (kind === "transshipment") {
      setSolved({
        kind,
        result: solveTransshipment(buildTransshipment(transshipment).problem!, {
          initial: initialMethod,
        }),
      });
    } else {
      setSolved({
        kind,
        result: solveAssignment(buildAssignment(assignment).problem!),
      });
    }
    setSolveCount((n) => n + 1);
    setTab("solution");
  };

  const applyFile = (file: TransportFile, name: string) => {
    const drafts = fileToDrafts(file);
    setKind(drafts.kind);
    if (drafts.transport) {
      setTransport(drafts.transport);
    }
    if (drafts.transshipment) {
      setTransshipment(drafts.transshipment);
    }
    if (drafts.assignment) {
      setAssignment(drafts.assignment);
    }
    setFileName(name);
    setSolved(null);
    setNotice(null);
  };

  const loadExample = (id: string) => {
    const example = transportExamples.find((e) => e.id === id);
    if (!example) {
      return;
    }
    try {
      applyFile(parseTransportFile(example.text), `${example.id}.io.json`);
    } catch (e) {
      setNotice(e instanceof ParseError ? e.message : String(e));
    }
  };

  const openFile = async () => {
    try {
      const file = await openTextFile(["json"], t("file.filter"));
      if (file) {
        applyFile(parseTransportFile(file.text), file.name);
      }
    } catch (e) {
      setNotice(e instanceof ParseError ? e.message : t("file.openError"));
    }
  };

  const saveFile = async () => {
    if (!built.problem) {
      setNotice(t("transport.invalid"));
      return;
    }
    const file: TransportFile =
      kind === "transport"
        ? { type: "transport", problem: buildTransport(transport).problem! }
        : kind === "transshipment"
          ? {
              type: "transshipment",
              problem: buildTransshipment(transshipment).problem!,
            }
          : {
              type: "assignment",
              problem: buildAssignment(assignment).problem!,
            };
    try {
      await downloadText(
        serializeTransportFile(file),
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
    if (solved.kind === "transport") {
      return reportTransport(solved.result, options);
    }
    if (solved.kind === "transshipment") {
      return reportTransshipment(solved.result, options);
    }
    return reportAssignment(solved.result, options);
  }, [solved, numberFormat]);

  const transportResult: TransportResult | null =
    solved?.kind === "transport"
      ? solved.result
      : solved?.kind === "transshipment"
        ? solved.result.transport
        : null;
  const items: Array<{ key: TabKey; label: string; disabled?: boolean }> = [
    { key: "solution", label: t("tab.solution") },
    {
      key: "iterations",
      label:
        solved?.kind === "assignment" ? t("tab.steps") : t("tab.iterations"),
    },
    {
      key: "sensitivity",
      label: t("tab.sensitivity"),
      disabled: solved?.kind !== "transport",
    },
  ];
  const activeTab: TabKey =
    tab === "sensitivity" && solved?.kind !== "transport" ? "solution" : tab;

  return (
    <div className="workspace" data-testid="transport-module">
      <section className="panel model-panel" aria-labelledby="transport-title">
        <header className="panel-header">
          <h2 id="transport-title">{t("module.transport")}</h2>
          <div className="toolbar">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              aria-label={t("transport.kind")}
              data-testid="transport-kind"
            >
              <option value="transport">{t("transport.transport")}</option>
              <option value="transshipment">
                {t("transport.transshipment")}
              </option>
              <option value="assignment">{t("transport.assignment")}</option>
            </select>
            <select
              value=""
              onChange={(e) => loadExample(e.target.value)}
              aria-label={t("editor.examples")}
              data-testid="transport-examples"
            >
              <option value="" disabled>
                {t("editor.examplesChoose")}
              </option>
              {transportExamples.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <button type="button" className="secondary" onClick={openFile}>
              {t("editor.open")}
            </button>
            <button type="button" className="secondary" onClick={saveFile}>
              {t("editor.save")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={solve}
              data-testid="transport-solve"
            >
              {t("transport.solve")}
            </button>
          </div>
        </header>
        <div className="editor-area">
          {kind === "transport" && (
            <TransportEditor
              draft={transport}
              invalid={built.invalid}
              onChange={(d) => setTransport(d)}
            />
          )}
          {kind === "transshipment" && (
            <TransshipmentEditor
              draft={transshipment}
              invalid={built.invalid}
              onChange={(d) => setTransshipment(d)}
            />
          )}
          {kind === "assignment" && (
            <AssignmentEditor
              draft={assignment}
              invalid={built.invalid}
              onChange={(d) => setAssignment(d)}
            />
          )}
        </div>
        <div className="options">
          <label>
            {t("transport.sense")}
            <select
              value={sense}
              onChange={(e) => setSense(e.target.value as Sense)}
              data-testid="transport-sense"
            >
              <option value="min">{t("transport.min")}</option>
              <option value="max">{t("transport.max")}</option>
            </select>
          </label>
          {kind !== "assignment" && (
            <label>
              {t("transport.initial")}
              <select
                value={initialMethod}
                onChange={(e) =>
                  setInitialMethod(e.target.value as InitialMethod)
                }
                data-testid="transport-initial"
              >
                {INITIAL_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {INITIAL_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
          )}
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
            data-testid="transport-notice"
          >
            {notice}
          </p>
        )}
      </section>
      <section
        className="panel results-panel"
        aria-labelledby="transport-results-title"
      >
        <header className="panel-header">
          <h2 id="transport-results-title">{t("results.title")}</h2>
        </header>
        {solved === null ? (
          <p className="empty">{t("results.empty")}</p>
        ) : (
          <Tabs<TabKey>
            items={items}
            active={activeTab}
            onChange={setTab}
            idPrefix="transport"
          >
            {activeTab === "solution" && (
              <div>
                <p
                  className={`status status-${solved.result.status}`}
                  data-testid="transport-status"
                  data-status={solved.result.status}
                >
                  {solved.kind === "assignment"
                    ? `${t("transport.total")}: ${number(solved.result.objective)}`
                    : solved.kind === "transshipment"
                      ? `${t("transport.total")}: ${number(solved.result.objective)}`
                      : `${t("transport.total")}: ${solved.result.objective.format(number)}`}
                </p>
                <ul className="messages-list" data-testid="transport-messages">
                  {solved.result.messages.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
                <div className="report-header">
                  <h3>{t("tab.solution")}</h3>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      void downloadText(
                        report,
                        fileName.replace(/\.io\.json$/, "") + ".txt",
                        "txt",
                        "Texto",
                      )
                    }
                  >
                    {t("solution.exportTxt")}
                  </button>
                </div>
                <pre className="report" data-testid="transport-report">
                  {report}
                </pre>
              </div>
            )}
            {activeTab === "iterations" && transportResult && (
              <TransportIterations
                key={solveCount}
                result={transportResult}
                number={number}
              />
            )}
            {activeTab === "iterations" && solved.kind === "assignment" && (
              <HungarianSteps
                key={solveCount}
                result={solved.result}
                number={number}
              />
            )}
            {activeTab === "sensitivity" && solved.kind === "transport" && (
              <TransportSensitivity result={solved.result} number={number} />
            )}
          </Tabs>
        )}
      </section>
    </div>
  );
}
