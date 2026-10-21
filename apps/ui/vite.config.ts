// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as { version: string };

// TAURI_DEV_HOST lo define el CLI de Tauri cuando se desarrolla contra un dispositivo externo.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    strictPort: true,
    host: host ?? false,
    ...(host ? { hmr: { protocol: "ws", host, port: 5174 } } : {}),
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
});
