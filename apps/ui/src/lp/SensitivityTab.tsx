// SPDX-License-Identifier: GPL-3.0-or-later
import { formatLP } from "@libreio/core";
import { t } from "../i18n";
import {
  formatExtended,
  makeFormatter,
  type NumberFormat,
} from "../common/numberFormat";
import type { Solved } from "./LPModule";

interface SensitivityTabProps {
  readonly solved: Solved;
  readonly numberFormat: NumberFormat;
}

export function SensitivityTab({ solved, numberFormat }: SensitivityTabProps) {
  const number = makeFormatter(numberFormat);
  const ext = (x: Parameters<typeof formatExtended>[0]) =>
    formatExtended(x, number);
  const sensitivity = solved.result.sensitivity;
  const dual = solved.result.dual;
  if (!sensitivity) {
    return <p className="empty">{t("status.infeasible")}</p>;
  }
  return (
    <div className="sensitivity-tab" data-testid="sensitivity-tab">
      <h3>{t("sens.variables")}</h3>
      <div className="table-scroll">
        <table className="data-table numeric">
          <thead>
            <tr>
              <th>{t("sens.name")}</th>
              <th>{t("sens.value")}</th>
              <th>{t("sens.cost")}</th>
              <th>{t("sens.contribution")}</th>
              <th>{t("sens.reducedCost")}</th>
              <th>{t("sens.status")}</th>
              <th>{t("sens.costMin")}</th>
              <th>{t("sens.costMax")}</th>
            </tr>
          </thead>
          <tbody>
            {sensitivity.variables.map((v) => (
              <tr key={v.name}>
                <th scope="row">{v.name}</th>
                <td>{number(v.value)}</td>
                <td>{number(v.cost)}</td>
                <td>{number(v.contribution)}</td>
                <td>{number(v.reducedCost)}</td>
                <td className="text">
                  {v.basic ? t("sens.basic") : t("sens.nonBasic")}
                </td>
                <td>{ext(v.costMin)}</td>
                <td>{ext(v.costMax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>{t("sens.constraints")}</h3>
      <div className="table-scroll">
        <table className="data-table numeric">
          <thead>
            <tr>
              <th>{t("sens.name")}</th>
              <th>{t("sens.lhs")}</th>
              <th>{t("sens.dir")}</th>
              <th>{t("sens.rhs")}</th>
              <th>{t("sens.slack")}</th>
              <th>{t("sens.shadow")}</th>
              <th>{t("sens.dualPrice")}</th>
              <th>{t("sens.rhsMin")}</th>
              <th>{t("sens.rhsMax")}</th>
            </tr>
          </thead>
          <tbody>
            {sensitivity.constraints.map((c) => (
              <tr key={c.row}>
                <th scope="row">{c.label ?? c.row}</th>
                <td>{number(c.lhs)}</td>
                <td className="text">{c.relation}</td>
                <td>{number(c.rhs)}</td>
                <td>{number(c.slack)}</td>
                <td>{number(c.shadowPrice)}</td>
                <td>{number(c.dualPrice)}</td>
                <td>{ext(c.rhsMin)}</td>
                <td>{ext(c.rhsMax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">{t("sens.signs")}</p>
      {dual && (
        <>
          <h3>{t("sens.dual")}</h3>
          <pre className="report">
            {formatLP(dual.model, { number }).trimEnd()}
            {"\n\n"}
            {dual.values
              .map((v) => `${v.name} = ${number(v.value)}`)
              .join(", ")}
            ; W = {number(dual.objective)}
          </pre>
        </>
      )}
    </div>
  );
}
