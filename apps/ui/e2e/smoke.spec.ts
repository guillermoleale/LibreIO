// SPDX-License-Identifier: GPL-3.0-or-later
// Fase 0: la versión web carga, muestra el módulo de prueba y parsea un ejemplo.
import { expect, test } from "@playwright/test";

test("carga la app, parsea el ejemplo LP-07 y marca un error con su línea", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") {
      errors.push(m.text());
    }
  });
  await page.goto("./");
  await expect(page.getByTestId("lp-module")).toBeVisible();
  await page
    .getByTestId("examples-select")
    .selectOption({ label: "LP-07 Prueba del parser" });
  await page.getByTestId("solve-button").click();
  const normalized = page.getByTestId("model-normalized");
  await expect(normalized).toContainText("MAX 3 X + 2 Y - Z + 1/3 W");
  await expect(normalized).toContainText("capacidad) 2 X + Y <= 100");
  await expect(normalized).toContainText("INT Y");

  await page.getByTestId("editor").fill("MAX X + Y\nST\nX + Y <> 4\nEND");
  await expect(page.getByTestId("editor-error")).toContainText("Línea 3");
  await page.getByTestId("module-about").click();
  await expect(page.getByTestId("about")).toContainText(
    "GNU General Public License",
  );
  expect(errors).toEqual([]);
});
