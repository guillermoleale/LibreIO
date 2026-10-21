// SPDX-License-Identifier: GPL-3.0-or-later
// Casos de aceptación UI-01 a UI-03 del apéndice A de SPEC.md sobre la versión web.
import { expect, test, type Page } from "@playwright/test";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") {
      errors.push(m.text());
    }
  });
  return errors;
}

async function loadExample(page: Page, label: string): Promise<void> {
  await page.goto("./");
  await page.getByTestId("examples-select").selectOption({ label });
}

test("UI-01. LP-01 con Ctrl+Enter: Z = 180 y tres tableaux navegables con el pivote resaltado", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await loadExample(page, "LP-01 Optimo unico");
  await page.getByTestId("editor").focus();
  await page.keyboard.press("Control+Enter");
  await expect(page.getByTestId("status")).toContainText("Z = 180");
  await expect(page.getByTestId("report")).toContainText(
    "Valor de la función objetivo: Z = 180",
  );

  await page.getByTestId("tab-tableau").click();
  await expect(page.getByTestId("tableau-position")).toContainText(
    "Tableau 0 de 3",
  );
  for (let i = 0; i < 3; i += 1) {
    await expect(page.getByTestId("pivot-cell")).toBeVisible();
    await expect(page.getByTestId("tableau-position")).toContainText(
      `Tableau ${i} de 3`,
    );
    await page.getByTestId("tableau-next").click();
  }
  await expect(page.getByTestId("tableau-position")).toContainText(
    "Tableau 3 de 3",
  );
  await expect(page.getByTestId("pivot-cell")).toHaveCount(0);
  await expect(page.getByTestId("tableau-note")).toContainText("óptimo");
  await page.getByTestId("tableau-prev").click();
  await expect(page.getByTestId("tableau-position")).toContainText(
    "Tableau 2 de 3",
  );
  await page.getByTestId("tableau-first").click();
  await expect(page.getByTestId("tableau-position")).toContainText(
    "Tableau 0 de 3",
  );
  expect(errors).toEqual([]);
});

test("UI-02. Gráfico de LP-01: cinco vértices, óptimo (20, 60), recta de Z desplazable y exportación SVG", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await loadExample(page, "LP-01 Optimo unico");
  await page.getByTestId("solve-button").click();
  await page.getByTestId("tab-graph").click();
  const labels = page.getByTestId("vertex-label");
  await expect(labels).toHaveCount(5);
  const texts = await labels.allTextContents();
  for (const expected of [
    "(0, 0)",
    "(40, 0)",
    "(40, 20)",
    "(20, 60)",
    "(0, 80)",
  ]) {
    expect(
      texts.some((t) => t.includes(expected)),
      expected,
    ).toBe(true);
  }
  await expect(page.getByTestId("optimum")).toContainText("(20, 60)");
  await expect(page.getByTestId("optimum")).toContainText("Z = 180");
  await expect(page.getByTestId("feasible-region")).toBeVisible();

  const zLabel = page.locator("label[for=z-slider]");
  await expect(zLabel).toContainText("Z = 180");
  await page.getByTestId("z-down").click();
  await expect(zLabel).not.toContainText("Z = 180");
  const zLineBefore = await page.getByTestId("z-line").getAttribute("y1");
  await page.getByTestId("z-slider").fill("100");
  await expect(zLabel).toContainText("Z = 100");
  const zLineAfter = await page.getByTestId("z-line").getAttribute("y1");
  expect(zLineAfter).not.toBe(zLineBefore);
  await page.getByTestId("z-up").click();
  await expect(zLabel).not.toContainText("Z = 100");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-svg").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("grafico.svg");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  const svg = Buffer.concat(chunks).toString("utf-8");
  expect(svg).toContain("<svg");
  expect(svg).toContain("(20, 60)");
  expect(svg.length).toBeGreaterThan(2000);
  expect(errors).toEqual([]);
});

test("UI-03. LP-03 muestra el estado ilimitado y LP-04 el infactible sin errores en la consola", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await loadExample(page, "LP-03 Ilimitado");
  await page.getByTestId("solve-button").click();
  await expect(page.getByTestId("status")).toHaveAttribute(
    "data-status",
    "unbounded",
  );
  await expect(page.getByTestId("status")).toContainText("ilimitado");
  await page.getByTestId("tab-graph").click();
  await expect(page.getByTestId("unbounded-arrow")).toBeVisible();
  await expect(page.getByTestId("graph-unbounded")).toBeVisible();
  await page.getByTestId("tab-solution").click();
  await page.getByTestId("report-classic").click();
  await expect(page.getByTestId("report")).toContainText("UNBOUNDED SOLUTION");

  await page
    .getByTestId("examples-select")
    .selectOption({ label: "LP-04 Infactible" });
  await page.getByTestId("solve-button").click();
  await expect(page.getByTestId("status")).toHaveAttribute(
    "data-status",
    "infeasible",
  );
  await expect(page.getByTestId("status")).toContainText("infactible");
  await page.getByTestId("tab-graph").click();
  await expect(page.getByTestId("graph-infeasible")).toBeVisible();
  await page.getByTestId("tab-solution").click();
  await expect(page.getByTestId("report")).toContainText(
    "NO FEASIBLE SOLUTION",
  );
  await page.getByTestId("tab-tableau").click();
  await expect(page.getByTestId("tableau-table")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Modo guiado: elegir Y en LP-01 avisa que no es Dantzig y pivotea igual", async ({
  page,
}) => {
  await loadExample(page, "LP-01 Optimo unico");
  await page.getByTestId("solve-button").click();
  await page.getByTestId("tab-tableau").click();
  await page.getByTestId("guided-toggle").check();
  await page.getByTestId("guided-entering").selectOption("Y");
  await page.getByTestId("guided-pivot").click();
  await expect(page.getByTestId("guided-message")).toContainText("Dantzig");
  await expect(page.getByTestId("tableau-table")).toContainText("160");
  await page.getByTestId("guided-entering").selectOption("X");
  await page.getByTestId("guided-pivot").click();
  await page.getByTestId("guided-finish").click();
  await expect(page.getByTestId("guided-message")).toContainText("Z = 180");
});
