// SPDX-License-Identifier: GPL-3.0-or-later
import type { Fraction } from "@libreio/core";
import { t } from "../i18n";
import type { Solved } from "./LPModule";

interface StatusBannerProps {
  readonly solved: Solved;
  readonly number: (f: Fraction) => string;
}

export function StatusBanner({ solved, number }: StatusBannerProps) {
  const { result, integer } = solved;
  let kind = result.status;
  let text: string;
  if (integer) {
    kind = integer.status;
    if (integer.status === "optimal") {
      text = `${t("status.integerOptimal")}. Z = ${number(integer.solution!.objective)} (${integer.nodes.length} ${t("tree.node").toLowerCase()}s, ${t("status.relaxation").toLowerCase()} Z = ${number(result.solution!.objective)})`;
    } else if (integer.status === "unbounded") {
      text = `${t("status.unbounded")} (${t("status.relaxation").toLowerCase()})`;
    } else {
      text = `${t("status.infeasible")} (${integer.nodes.length} ${t("tree.node").toLowerCase()}s)`;
    }
  } else if (kind === "optimal") {
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
