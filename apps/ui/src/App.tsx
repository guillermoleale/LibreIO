// SPDX-License-Identifier: GPL-3.0-or-later
import { useState } from "react";
import { About } from "./common/About";
import type { ViewKey } from "./common/modules";
import { Sidebar } from "./common/Sidebar";
import { useTheme } from "./common/theme";
import { t } from "./i18n";
import { LPModule } from "./lp/LPModule";
import { TransportModule } from "./transport/TransportModule";

export function App() {
  const [view, setView] = useState<ViewKey>("lp");
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        {t("app.skipToContent")}
      </a>
      <Sidebar
        active={view}
        onSelect={setView}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main id="main" className="main">
        {view === "about" ? (
          <About />
        ) : view === "transport" ? (
          <TransportModule />
        ) : (
          <LPModule />
        )}
      </main>
    </div>
  );
}
