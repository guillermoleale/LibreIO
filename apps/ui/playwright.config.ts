// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig } from "@playwright/test";

// Los tests de interfaz corren contra la versión web compilada con el base path de GitHub Pages.
const baseURL = "http://localhost:4173/LibreIO/";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm build:web && pnpm preview:web",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
