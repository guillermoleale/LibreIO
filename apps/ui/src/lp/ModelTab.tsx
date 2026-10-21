// SPDX-License-Identifier: GPL-3.0-or-later
import { useState } from "react";
import { formatLP, type LPModel } from "@libreio/core";
import { t } from "../i18n";

interface ModelTabProps {
  readonly model: LPModel;
}

export function ModelTab({ model }: ModelTabProps) {
  const [copied, setCopied] = useState(false);
  const text = formatLP(model);
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
    <div className="model-tab" data-testid="model-tab">
      <dl className="summary">
        <dt>{t("model.summary")}</dt>
        <dd>
          {model.sense === "max" ? t("model.sense.max") : t("model.sense.min")}.{" "}
          {model.variables.length} {t("model.variables").toLowerCase()},{" "}
          {model.constraints.length} {t("model.constraints").toLowerCase()}
        </dd>
      </dl>
      <div className="report-header">
        <h3>{t("model.normalized")}</h3>
        <button type="button" className="secondary" onClick={copy}>
          {copied ? t("model.copied") : t("model.copy")}
        </button>
      </div>
      <pre className="report" data-testid="model-normalized">
        {text}
      </pre>
    </div>
  );
}
