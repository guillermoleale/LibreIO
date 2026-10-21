// SPDX-License-Identifier: GPL-3.0-or-later
import type { Fraction, LPResult } from "@libreio/core";
import { t } from "../i18n";

interface StatusBannerProps {
  readonly result: LPResult;
  readonly number: (f: Fraction) => string;
}

export function StatusBanner({ result, number }: StatusBannerProps) {
  const kind = result.status;
  let text: string;
  if (kind === "optimal") {
    text = `${t("status.optimal")}. Z = ${number(result.solution!.objective)} (${result.iterations} ${t("status.iterations")})`;
  } else if (kind === "unbounded") {
    text = `${t("status.unbounded")} (${result.iterations} ${t("status.iterations")})`;
  } else {
    text = `${t("status.infeasible")} (${result.iterations} ${t("status.iterations")})`;
  }
  return (
    <p
      className={`status status-${kind}`}
      data-testid="status"
      data-status={kind}
    >
      {text}
    </p>
  );
}
