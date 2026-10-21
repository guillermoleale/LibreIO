// SPDX-License-Identifier: GPL-3.0-or-later
// Registro del service worker para funcionar sin conexión en la versión web.
// En la app de escritorio no hace falta: Tauri sirve los archivos localmente.
import { isTauri } from "./files";

export function registerOffline(): void {
  if (
    isTauri() ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    !import.meta.env.PROD
  ) {
    return;
  }
  // La ruta se resuelve con el base path de la compilación (/LibreIO/ en Pages, / en otros hosts).
  const url = `${import.meta.env.BASE_URL}sw.js`;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(url, { scope: import.meta.env.BASE_URL })
      .catch(() => {
        // Sin service worker disponible: la app sigue funcionando con conexión.
      });
  });
}
