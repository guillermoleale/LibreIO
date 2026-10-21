// SPDX-License-Identifier: GPL-3.0-or-later
import { useMemo } from "react";
import { reportClassic, reportCombined } from "@libreio/core";
import { t } from "../i18n";
import { downloadText } from "../common/download";
import {
  DECIMALS,
  makeFormatter,
  type NumberFormat,
} from "../common/numberFormat";
import type { Solved } from "./LPModule";
import { StatusBanner } from "./StatusBanner";

export type ReportFormat = "combined" | "classic";

interface SolutionTabProps {
  readonly solved: Solved;
  readonly numberFormat: NumberFormat;
  readonly format: ReportFormat;
  readonly onFormatChange: (format: ReportFormat) => void;
}

export function SolutionTab({
  solved,
  numberFormat,
  format,
  onFormatChange,
}: SolutionTabProps) {
  const setFormat = onFormatChange;
  const number = makeFormatter(numberFormat);
  const report = useMemo(
    () =>
      format === "classic"
        ? reportClassic(solved.model, solved.result)
        : reportCombined(solved.model, solved.result, {
            numberFormat,
            decimals: DECIMALS,
          }),
    [format, solved, numberFormat],
  );
  const baseName = (solved.model.title ?? "solucion").replace(/[^\w-]+/g, "_");
  return (
    <div className="solution-tab">
      <StatusBanner result={solved.result} number={number} />
      {solved.result.messages.length > 0 && (
        <details className="messages" open>
          <summary>{t("solution.messages")}</summary>
          <ul data-testid="messages">
            {solved.result.messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="report-header">
        <div
          className="segmented"
          role="group"
          aria-label="Formato del reporte"
        >
          <button
            type="button"
            className={format === "combined" ? "active" : ""}
            onClick={() => setFormat("combined")}
            data-testid="report-combined"
          >
            {t("solution.combined")}
          </button>
          <button
            type="button"
            className={format === "classic" ? "active" : ""}
            onClick={() => setFormat("classic")}
            data-testid="report-classic"
          >
            {t("solution.classic")}
          </button>
        </div>
        <div className="toolbar">
          <button
            type="button"
            className="secondary"
            onClick={() =>
              void downloadText(report, `${baseName}.txt`, "txt", "Texto")
            }
          >
            {t("solution.exportTxt")}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              void downloadText(
                `\`\`\`\n${report}\`\`\`\n`,
                `${baseName}.md`,
                "md",
                "Markdown",
              )
            }
          >
            {t("solution.exportMd")}
          </button>
        </div>
      </div>
      <pre className="report" data-testid="report">
        {report}
      </pre>
    </div>
  );
}
