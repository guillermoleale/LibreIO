// SPDX-License-Identifier: GPL-3.0-or-later
import { t } from "../i18n";
import { appVersion, dependencies, repositoryUrl } from "./thirdParty";

export function About() {
  return (
    <section className="about" data-testid="about">
      <h1>{t("about.title")}</h1>
      <p>{t("about.description")}</p>
      <p>
        <strong>{t("about.version")}:</strong> {appVersion}
      </p>
      <p>{t("about.noNetwork")}</p>
      <h2>{t("about.license")}</h2>
      <p>{t("about.licenseText")}</p>
      <p>
        <strong>{t("about.source")}:</strong>{" "}
        <a href={repositoryUrl} target="_blank" rel="noreferrer">
          {repositoryUrl}
        </a>
      </p>
      <h2>{t("about.deps")}</h2>
      <p>{t("about.depsNote")}</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Licencia</th>
            <th>Ámbito</th>
          </tr>
        </thead>
        <tbody>
          {dependencies.map((d) => (
            <tr key={d.name}>
              <td>
                <a href={d.url} target="_blank" rel="noreferrer">
                  {d.name}
                </a>
              </td>
              <td>{d.license}</td>
              <td>{d.scope}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
