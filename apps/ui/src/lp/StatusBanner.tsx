// SPDX-License-Identifier: GPL-3.0-or-later
import type { Fraction } from "@libreio/core";
import { t } from "../i18n";
import type { Solved } from "./LPModule";

interface StatusBannerProps {
  readonly solved: Solved;
  readonly number: (f: Fraction) => string;
}

export function StatusBanner({ solved, number }: StatusBannerProps) {
  const { result, integer, gomory } = solved;
  let kind: string = result.status;
  let text: string;
  if (gomory) {
    kind = gomory.status === "limit" ? "infeasible" : gomory.status;
    if (gomory.status === "optimal") {
      text = `${t("status.gomoryOptimal")}. Z = ${number(gomory.solution!.objective)} (${gomory.cuts.length} ${t("cuts.count")}, ${t("status.relaxation").toLowerCase()} Z = ${number(result.solution!.objective)})`;
    } else if (gomory.status === "unbounded") {
      text = `${t("status.unbounded")} (${t("status.relaxation").toLowerCase()})`;
    } else if (gomory.status === "limit") {
      text = `${t("status.gomoryLimit")} (${gomory.cuts.length} ${t("cuts.count")})`;
    } else {
      text = `${t("status.infeasible")} (${gomory.cuts.length} ${t("cuts.count")})`;
    }
  } else if (integer) {
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
