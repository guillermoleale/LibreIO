// SPDX-License-Identifier: GPL-3.0-or-later
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { registerOffline } from "./common/pwa";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("No se encontró el elemento raíz");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerOffline();
