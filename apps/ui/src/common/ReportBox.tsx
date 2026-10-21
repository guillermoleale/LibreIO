// SPDX-License-Identifier: GPL-3.0-or-later
// Reporte de texto monoespaciado con copia y exportación a .txt y .md, común a todos los módulos.
import { useState } from "react";
import { t } from "../i18n";
import { downloadText } from "./download";

interface ReportBoxProps {
  readonly text: string;
  readonly baseName: string;
  readonly testId: string;
  readonly title?: string;
}

export function ReportBox({ text, baseName, testId, title }: ReportBoxProps) {
  const [copied, setCopied] = useState(false);
  const safeName = baseName.replace(/[^\w-]+/g, "_") || "reporte";
  const copy = () => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  };
  return (
    <div className="report-box">
      <div className="report-header">
        <h3>{title ?? t("tab.solution")}</h3>
        <div className="toolbar">
          <button
            type="button"
            className="secondary"
            onClick={copy}
            data-testid={`${testId}-copy`}
          >
            {copied ? t("model.copied") : t("model.copy")}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              void downloadText(text, `${safeName}.txt`, "txt", "Texto")
            }
            data-testid={`${testId}-txt`}
          >
            {t("solution.exportTxt")}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              void downloadText(
                `\`\`\`\n${text}\`\`\`\n`,
                `${safeName}.md`,
                "md",
                "Markdown",
              )
            }
            data-testid={`${testId}-md`}
          >
            {t("solution.exportMd")}
          </button>
        </div>
      </div>
      <pre className="report" data-testid={testId}>
        {text}
      </pre>
    </div>
  );
}
