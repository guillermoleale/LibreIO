// SPDX-License-Identifier: GPL-3.0-or-later
// Módulo de redes: lista de arcos editable, dibujo del grafo y paso a paso de cada algoritmo.
import { useMemo, useState } from "react";
import {
  Fraction,
  ParseError,
  allNodes,
  maxFlow,
  minimumSpanningTree,
  parseNetworkFile,
  reportMaxFlow,
  reportShortestPath,
  reportSpanningTree,
  reportTravelingSalesman,
  serializeNetworkFile,
  shortestPath,
  travelingSalesman,
  type MaxFlowResult,
  type NetworkProblem,
  type ShortestPathResult,
  type SpanningTreeResult,
  type TspResult,
} from "@libreio/core";
import { t } from "../i18n";
import { ReportBox } from "../common/ReportBox";
import { networkExamples } from "../common/examples";
import { downloadText } from "../common/download";
import { openTextFile } from "../common/files";
import {
  DECIMALS,
  makeFormatter,
  type NumberFormat,
} from "../common/numberFormat";
import { Tabs } from "../common/Tabs";
import { arcKey } from "./arcKey";
import { GraphView } from "./GraphView";

type Algorithm = "shortestPath" | "maxFlow" | "mst" | "tsp";
type TabKey = "solution" | "graph" | "steps";

interface ArcDraft {
  from: string;
  to: string;
  weight: string;
}

interface Draft {
  title: string;
  directed: boolean;
  arcs: ArcDraft[];
}

type Solved =
  | {
      readonly kind: "shortestPath";
      readonly problem: NetworkProblem;
      readonly result: ShortestPathResult;
    }
  | {
      readonly kind: "maxFlow";
      readonly problem: NetworkProblem;
      readonly result: MaxFlowResult;
    }
  | {
      readonly kind: "mst";
      readonly problem: NetworkProblem;
      readonly result: SpanningTreeResult;
    }
  | {
      readonly kind: "tsp";
      readonly problem: NetworkProblem;
      readonly result: TspResult;
    };

function toDraft(p: NetworkProblem): Draft {
  return {
    title: p.title ?? "",
    directed: p.directed,
    arcs: p.arcs.map((a) => ({
      from: a.from,
      to: a.to,
      weight: a.weight.toString(),
    })),
  };
}

function build(d: Draft): {
  problem: NetworkProblem | null;
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
    let weight = Fraction.ZERO;
    try {
      weight = Fraction.parse(a.weight.trim());
    } catch {
      invalid.add(`weight-${k}`);
    }
    return { from, to, weight };
  });
  if (arcs.length === 0) {
    invalid.add("empty");
  }
  return {
    problem:
      invalid.size > 0
        ? null
        : {
            title: d.title.trim() === "" ? null : d.title.trim(),
            directed: d.directed,
            nodes: [],
            arcs,
          },
    invalid,
  };
}

const initialExample = networkExamples.find((e) => e.id.startsWith("NET-01"));

export function NetworkModule() {
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      return initialExample
        ? toDraft(parseNetworkFile(initialExample.text))
        : {
            title: "",
            directed: false,
            arcs: [{ from: "A", to: "B", weight: "1" }],
          };
    } catch {
      return {
        title: "",
        directed: false,
        arcs: [{ from: "A", to: "B", weight: "1" }],
      };
    }
  });
  const [fileName, setFileName] = useState(
    initialExample ? `${initialExample.id}.io.json` : "red.io.json",
  );
  const [algorithm, setAlgorithm] = useState<Algorithm>("shortestPath");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [method, setMethod] = useState<"kruskal" | "prim">("kruskal");
  const [numberFormat, setNumberFormat] = useState<NumberFormat>("fraction");
  const [solved, setSolved] = useState<Solved | null>(null);
  const [tab, setTab] = useState<TabKey>("solution");
  const [step, setStep] = useState(0);
  const [tour, setTour] = useState<
    "optimal" | "nearestNeighbor" | "cheapestInsertion"
  >("optimal");
  const [notice, setNotice] = useState<string | null>(null);
  const number = makeFormatter(numberFormat);

  const built = useMemo(() => build(draft), [draft]);
  const nodes = useMemo(
    () =>
      built.problem
        ? allNodes(built.problem)
        : [
            ...new Set(
              draft.arcs
                .flatMap((a) => [a.from.trim(), a.to.trim()])
                .filter((n) => n !== ""),
            ),
          ],
    [built.problem, draft.arcs],
  );
  const effectiveSource = nodes.includes(source) ? source : (nodes[0] ?? "");
  const effectiveTarget = nodes.includes(target)
    ? target
    : (nodes[nodes.length - 1] ?? "");

  const applyProblem = (p: NetworkProblem, name: string) => {
    setDraft(toDraft(p));
    setFileName(name);
    setSolved(null);
    setNotice(null);
  };

  const loadExample = (id: string) => {
    const example = networkExamples.find((e) => e.id === id);
    if (!example) {
      return;
    }
    try {
      const p = parseNetworkFile(example.text);
      applyProblem(p, `${example.id}.io.json`);
      if (id.startsWith("NET-02") || id.includes("flujo")) {
        setAlgorithm("maxFlow");
      } else if (id.startsWith("NET-03")) {
        setAlgorithm("mst");
      } else if (id.startsWith("NET-04") || id.includes("viajante")) {
        setAlgorithm("tsp");
      } else {
        setAlgorithm("shortestPath");
      }
    } catch (e) {
      setNotice(e instanceof ParseError ? e.message : String(e));
    }
  };

  const openFile = async () => {
    try {
      const file = await openTextFile(["json"], t("file.filter"));
      if (file) {
        applyProblem(parseNetworkFile(file.text), file.name);
      }
    } catch (e) {
      setNotice(e instanceof ParseError ? e.message : t("file.openError"));
    }
  };

  const saveFile = async () => {
    if (!built.problem) {
      setNotice(t("net.invalid"));
      return;
    }
    await downloadText(
      serializeNetworkFile(built.problem),
      fileName,
      "json",
      t("file.filter"),
    );
  };

  const solve = () => {
    if (!built.problem) {
      setNotice(draft.arcs.length === 0 ? t("net.noArcs") : t("net.invalid"));
      return;
    }
    setNotice(null);
    const problem = built.problem;
    try {
      if (algorithm === "shortestPath") {
        setSolved({
          kind: "shortestPath",
          problem,
          result: shortestPath(problem, effectiveSource, effectiveTarget),
        });
      } else if (algorithm === "maxFlow") {
        setSolved({
          kind: "maxFlow",
          problem,
          result: maxFlow(problem, effectiveSource, effectiveTarget),
        });
      } else if (algorithm === "mst") {
        setSolved({
          kind: "mst",
          problem,
          result: minimumSpanningTree(problem, method, effectiveSource),
        });
      } else {
        setSolved({
          kind: "tsp",
          problem,
          result: travelingSalesman(problem, effectiveSource),
        });
      }
      setStep(0);
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
    switch (solved.kind) {
      case "shortestPath":
        return reportShortestPath(solved.problem, solved.result, options);
      case "maxFlow":
        return reportMaxFlow(solved.problem, solved.result, options);
      case "mst":
        return reportSpanningTree(solved.problem, solved.result, options);
      default:
        return reportTravelingSalesman(solved.problem, solved.result, options);
    }
  }, [solved, numberFormat]);

  // Resaltado del grafo según el algoritmo y el paso elegido
  const view = useMemo(() => {
    if (!solved) {
      return null;
    }
    const arcClasses = new Map<string, string>();
    const arcLabels = new Map<string, string>();
    const nodeClasses = new Map<string, string>();
    const nodeLabels = new Map<string, string>();
    const solvedNodes = allNodes(solved.problem);
    let stepCount: number;
    let note = "";
    let root: string | undefined;
    if (solved.kind === "shortestPath") {
      const r = solved.result;
      root = r.source;
      stepCount = r.steps.length;
      const current = r.steps[Math.min(step, r.steps.length - 1)];
      if (current) {
        note = current.note;
        for (const n of solvedNodes) {
          const l = current.labels[n];
          if (l?.distance) {
            nodeLabels.set(
              n,
              `${number(l.distance)}${l.predecessor ? ` (${l.predecessor})` : ""}`,
            );
            nodeClasses.set(n, l.permanent ? "permanent" : "temporary");
          } else {
            nodeLabels.set(n, "∞");
          }
        }
        nodeClasses.set(current.settled, "settled");
      }
      if (step >= r.steps.length - 1) {
        for (const a of r.pathArcs) {
          arcClasses.set(arcKey(a.from, a.to), "solution");
        }
      }
    } else if (solved.kind === "maxFlow") {
      const r = solved.result;
      root = r.source;
      stepCount = r.augmentingPaths.length + 1;
      for (const f of r.flows) {
        arcLabels.set(
          arcKey(f.from, f.to),
          `${number(f.flow)}/${number(f.capacity)}`,
        );
        if (f.flow.isPositive()) {
          arcClasses.set(arcKey(f.from, f.to), "flow");
        }
      }
      const current = r.augmentingPaths[step];
      if (current) {
        note = current.note;
        for (let i = 0; i + 1 < current.path.length; i += 1) {
          arcClasses.set(
            arcKey(current.path[i]!, current.path[i + 1]!),
            "solution",
          );
          arcClasses.set(
            arcKey(current.path[i + 1]!, current.path[i]!),
            "solution",
          );
        }
      } else {
        note = `${t("net.cut")}: {${r.minCut.sourceSide.join(", ")}} | {${r.minCut.sinkSide.join(", ")}}`;
        for (const n of r.minCut.sourceSide) {
          nodeClasses.set(n, "source-side");
        }
        for (const n of r.minCut.sinkSide) {
          nodeClasses.set(n, "sink-side");
        }
        for (const a of r.minCut.arcs) {
          arcClasses.set(arcKey(a.from, a.to), "cut");
        }
      }
    } else if (solved.kind === "mst") {
      const r = solved.result;
      stepCount = r.steps.length;
      const current = r.steps[Math.min(step, r.steps.length - 1)];
      note = current?.note ?? "";
      r.steps.slice(0, step + 1).forEach((s, i) => {
        if (s.accepted) {
          arcClasses.set(
            arcKey(s.edge.from, s.edge.to),
            i === step ? "solution current" : "solution",
          );
        } else if (i === step && s.edge.from !== s.edge.to) {
          arcClasses.set(arcKey(s.edge.from, s.edge.to), "rejected");
        }
      });
      for (const n of current?.treeNodes ?? []) {
        nodeClasses.set(n, "permanent");
      }
    } else {
      const r = solved.result;
      root = r.start;
      const heuristic =
        tour === "nearestNeighbor"
          ? r.nearestNeighbor
          : tour === "cheapestInsertion"
            ? r.cheapestInsertion
            : null;
      const chosen = heuristic ?? r.optimal;
      const steps = heuristic ? heuristic.steps : [];
      stepCount = steps.length;
      const current = steps[Math.min(step, steps.length - 1)];
      const path = current ? current.tour : chosen.tour;
      note =
        current?.note ??
        (chosen.tour.length > 0
          ? `${t("net.tour")}: ${chosen.tour.join(" -> ")} (${number(chosen.cost)})`
          : "");
      for (let i = 0; i + 1 < path.length; i += 1) {
        arcClasses.set(arcKey(path[i]!, path[i + 1]!), "solution");
      }
    }
    return {
      arcClasses,
      arcLabels,
      nodeClasses,
      nodeLabels,
      stepCount,
      note,
      root,
      solvedNodes,
    };
  }, [solved, step, tour, number]);

  const status = useMemo(() => {
    if (!solved) {
      return "";
    }
    if (solved.kind === "shortestPath") {
      return solved.result.status === "optimal"
        ? `${t("net.shortestPath")}: ${number(solved.result.distance!)} (${solved.result.path.join(" -> ")})`
        : solved.result.messages[0]!;
    }
    if (solved.kind === "maxFlow") {
      return `${t("net.maxFlow")}: ${number(solved.result.value)}`;
    }
    if (solved.kind === "mst") {
      return `${t("net.mst")}: ${number(solved.result.cost)}`;
    }
    return solved.result.status === "optimal"
      ? `${t("net.tsp")}: ${number(solved.result.optimal.cost)} (${solved.result.optimal.tour.join(" -> ")})`
      : solved.result.messages[0]!;
  }, [solved, number]);

  const stepNotes = useMemo(() => {
    if (!solved) {
      return [] as string[];
    }
    if (solved.kind === "shortestPath") {
      return solved.result.steps.map((s) => s.note);
    }
    if (solved.kind === "maxFlow") {
      return [
        ...solved.result.augmentingPaths.map((p) => p.note),
        ...solved.result.messages.slice(1),
      ];
    }
    if (solved.kind === "mst") {
      return solved.result.steps.map((s) => s.note);
    }
    return solved.result.optimal.nodes.map(
      (n) => `${n.path.join("-")}: ${n.note}`,
    );
  }, [solved]);

  const cls = (key: string) =>
    `cell${built.invalid.has(key) ? " invalid" : ""}`;

  return (
    <div className="workspace" data-testid="network-module">
      <section className="panel model-panel" aria-labelledby="network-title">
        <header className="panel-header">
          <h2 id="network-title">{t("module.network")}</h2>
          <div className="toolbar">
            <select
              value=""
              onChange={(e) => loadExample(e.target.value)}
              aria-label={t("editor.examples")}
              data-testid="network-examples"
            >
              <option value="" disabled>
                {t("editor.examplesChoose")}
              </option>
              {networkExamples.map((e) => (
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
              data-testid="network-solve"
            >
              {t("editor.solve")}
            </button>
          </div>
        </header>
        <div className="editor-area">
          <label className="switch">
            <input
              type="checkbox"
              checked={draft.directed}
              onChange={(e) =>
                setDraft({ ...draft, directed: e.target.checked })
              }
              data-testid="network-directed"
            />
            {t("net.directed")}
          </label>
          <div className="table-scroll">
            <table className="data-table editor-grid">
              <thead>
                <tr>
                  <th>{t("net.from")}</th>
                  <th>{t("net.to")}</th>
                  <th>{t("net.weight")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {draft.arcs.map((a, k) => (
                  <tr key={k}>
                    <td>
                      <input
                        className={`${cls(`from-${k}`)} name`}
                        value={a.from}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            arcs: draft.arcs.map((x, m) =>
                              m === k ? { ...x, from: e.target.value } : x,
                            ),
                          })
                        }
                        data-testid={`arc-from-${k}`}
                      />
                    </td>
                    <td>
                      <input
                        className={`${cls(`to-${k}`)} name`}
                        value={a.to}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            arcs: draft.arcs.map((x, m) =>
                              m === k ? { ...x, to: e.target.value } : x,
                            ),
                          })
                        }
                        data-testid={`arc-to-${k}`}
                      />
                    </td>
                    <td>
                      <input
                        className={cls(`weight-${k}`)}
                        value={a.weight}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            arcs: draft.arcs.map((x, m) =>
                              m === k ? { ...x, weight: e.target.value } : x,
                            ),
                          })
                        }
                        data-testid={`arc-weight-${k}`}
                      />
                    </td>
                    <td>
                      {draft.arcs.length > 1 && (
                        <button
                          type="button"
                          className="icon"
                          title={t("table.remove")}
                          onClick={() =>
                            setDraft({
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
                setDraft({
                  ...draft,
                  arcs: [...draft.arcs, { from: "", to: "", weight: "1" }],
                })
              }
              data-testid="network-add-arc"
            >
              {t("net.addArc")}
            </button>
          </div>
        </div>
        <div className="options">
          <label>
            {t("net.algorithm")}
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as Algorithm)}
              data-testid="network-algorithm"
            >
              <option value="shortestPath">{t("net.shortestPath")}</option>
              <option value="maxFlow">{t("net.maxFlow")}</option>
              <option value="mst">{t("net.mst")}</option>
              <option value="tsp">{t("net.tsp")}</option>
            </select>
          </label>
          <label>
            {algorithm === "maxFlow"
              ? t("net.source")
              : algorithm === "mst" || algorithm === "tsp"
                ? t("net.start")
                : t("net.source")}
            <select
              value={effectiveSource}
              onChange={(e) => setSource(e.target.value)}
              data-testid="network-source"
            >
              {nodes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {(algorithm === "shortestPath" || algorithm === "maxFlow") && (
            <label>
              {algorithm === "maxFlow" ? t("net.sink") : t("net.target")}
              <select
                value={effectiveTarget}
                onChange={(e) => setTarget(e.target.value)}
                data-testid="network-target"
              >
                {nodes.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          {algorithm === "mst" && (
            <label>
              {t("net.method")}
              <select
                value={method}
                onChange={(e) =>
                  setMethod(e.target.value as "kruskal" | "prim")
                }
                data-testid="network-method"
              >
                <option value="kruskal">{t("net.kruskal")}</option>
                <option value="prim">{t("net.prim")}</option>
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
          <p className="editor-error" role="alert" data-testid="network-notice">
            {notice}
          </p>
        )}
      </section>
      <section
        className="panel results-panel"
        aria-labelledby="network-results-title"
      >
        <header className="panel-header">
          <h2 id="network-results-title">{t("results.title")}</h2>
        </header>
        {solved === null || view === null ? (
          <p className="empty">{t("results.empty")}</p>
        ) : (
          <Tabs<TabKey>
            items={[
              { key: "solution", label: t("tab.solution") },
              { key: "graph", label: t("tab.graph") },
              { key: "steps", label: t("tab.steps") },
            ]}
            active={tab}
            onChange={setTab}
            idPrefix="network"
          >
            {tab === "solution" && (
              <div>
                <p
                  className="status status-optimal"
                  data-testid="network-status"
                >
                  {status}
                </p>
                <ReportBox
                  text={report}
                  baseName="red"
                  testId="network-report"
                />
              </div>
            )}
            {tab === "graph" && (
              <div>
                {solved.kind === "tsp" && (
                  <div className="options">
                    <label>
                      {t("net.tour")}
                      <select
                        value={tour}
                        onChange={(e) => {
                          setTour(e.target.value as typeof tour);
                          setStep(0);
                        }}
                        data-testid="network-tour"
                      >
                        <option value="optimal">{t("net.tourOptimal")}</option>
                        <option value="nearestNeighbor">
                          {t("net.tourNearest")}
                        </option>
                        <option value="cheapestInsertion">
                          {t("net.tourInsertion")}
                        </option>
                      </select>
                    </label>
                  </div>
                )}
                {view.stepCount > 0 && (
                  <div className="tableau-controls">
                    <div className="toolbar">
                      <button
                        type="button"
                        className="secondary"
                        disabled={step === 0}
                        onClick={() => setStep((s) => Math.max(0, s - 1))}
                        data-testid="network-prev"
                      >
                        {t("tableau.prev")}
                      </button>
                      <span className="position" data-testid="network-position">
                        {t("net.step")} {Math.min(step, view.stepCount - 1) + 1}{" "}
                        {t("tableau.of")} {view.stepCount}
                      </span>
                      <button
                        type="button"
                        className="secondary"
                        disabled={step >= view.stepCount - 1}
                        onClick={() =>
                          setStep((s) => Math.min(view.stepCount - 1, s + 1))
                        }
                        data-testid="network-next"
                      >
                        {t("tableau.next")}
                      </button>
                    </div>
                  </div>
                )}
                <GraphView
                  problem={solved.problem}
                  nodes={view.solvedNodes}
                  {...(view.root ? { root: view.root } : {})}
                  arcClasses={view.arcClasses}
                  arcLabels={view.arcLabels}
                  nodeClasses={view.nodeClasses}
                  nodeLabels={view.nodeLabels}
                />
                {view.note && (
                  <p className="note" data-testid="network-note">
                    {view.note}
                  </p>
                )}
              </div>
            )}
            {tab === "steps" && (
              <ol className="step-list" data-testid="network-steps">
                {stepNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ol>
            )}
          </Tabs>
        )}
      </section>
    </div>
  );
}
