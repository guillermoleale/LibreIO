// SPDX-License-Identifier: GPL-3.0-or-later
import { useState } from "react";
import { reportModel } from "@libreio/core";
import { t } from "../i18n";
import { DECIMALS, type NumberFormat } from "../common/numberFormat";
import type { Solved } from "./LPModule";

interface ModelTabProps {
  readonly solved: Solved;
  readonly numberFormat: NumberFormat;
}

export function ModelTab({ solved, numberFormat }: ModelTabProps) {
  const [copied, setCopied] = useState(false);
  const { model, result } = solved;
  const text = reportModel(model, result, { numberFormat, decimals: DECIMALS });
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
