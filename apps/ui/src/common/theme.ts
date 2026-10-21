// SPDX-License-Identifier: GPL-3.0-or-later
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "libreio.theme";

function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Tema claro u oscuro, guardado en el navegador. Por defecto sigue al sistema. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(
    () => readStoredTheme() ?? systemTheme(),
  );

  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Sin almacenamiento disponible: el tema dura lo que dura la sesión.
      }
      return next;
    });
  }, []);

  return [theme, toggle];
}
