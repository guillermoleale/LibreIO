// SPDX-License-Identifier: GPL-3.0-or-later
import { t } from "../i18n";
import { modules, type ViewKey } from "./modules";
import type { Theme } from "./theme";

interface SidebarProps {
  readonly active: ViewKey;
  readonly onSelect: (view: ViewKey) => void;
  readonly theme: Theme;
  readonly onToggleTheme: () => void;
}

export function Sidebar({
  active,
  onSelect,
  theme,
  onToggleTheme,
}: SidebarProps) {
  return (
    <nav className="sidebar" aria-label={t("sidebar.modules")}>
      <div className="brand">
        <span className="brand-name">{t("app.title")}</span>
        <span className="brand-sub">{t("app.subtitle")}</span>
      </div>
      <ul className="module-list">
        {modules.map((m) => (
          <li key={m.key}>
            <button
              type="button"
              className={`module-link${active === m.key ? " active" : ""}`}
              disabled={!m.available}
              aria-current={active === m.key ? "page" : undefined}
              title={m.available ? undefined : t("sidebar.soon")}
              onClick={() => onSelect(m.key)}
              data-testid={`module-${m.key}`}
            >
              {t(m.label)}
              {!m.available && (
                <span className="badge">{t("sidebar.soon")}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="sidebar-footer">
        <button
          type="button"
          className={`module-link${active === "about" ? " active" : ""}`}
          onClick={() => onSelect("about")}
          data-testid="module-about"
        >
          {t("sidebar.about")}
        </button>
        <button
          type="button"
          className="module-link"
          onClick={onToggleTheme}
          aria-label={t("theme.toggle")}
          data-testid="theme-toggle"
        >
          {theme === "dark" ? t("theme.light") : t("theme.dark")}
        </button>
      </div>
    </nav>
  );
}
