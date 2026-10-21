// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as { version: string };

// TAURI_DEV_HOST lo define el CLI de Tauri cuando se desarrolla contra un dispositivo externo.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    react(),
    // Versión web sin conexión: el service worker guarda en caché todos los assets compilados.
    // En Tauri no se registra (ver src/common/pwa.ts); el manifest usa rutas relativas para
    // funcionar con el base path /LibreIO/ de GitHub Pages y con / en escritorio.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "LibreIO",
        short_name: "LibreIO",
        description: "Software libre y didáctico de Investigación Operativa",
        lang: "es",
        start_url: "./",
        scope: "./",
        display: "standalone",
        theme_color: "#2f6f9f",
        background_color: "#f4f5f7",
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,webmanifest}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
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
