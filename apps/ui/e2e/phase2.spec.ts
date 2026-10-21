// SPDX-License-Identifier: GPL-3.0-or-later
// Fase 2: vista tabular (UI-04), paramétrico, programación entera y transporte sobre la versión web.
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

test("UI-04. Alternar entre texto y tabla conserva el modelo en ambos sentidos", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await page
    .getByTestId("examples-select")
    .selectOption({ label: "LP-01 Optimo unico" });
  await page.getByTestId("view-table").click();
  await expect(page.getByTestId("table-view")).toBeVisible();
  await expect(page.getByTestId("obj-coef-0")).toHaveValue("3");
  await expect(page.getByTestId("obj-coef-1")).toHaveValue("2");
  await expect(page.getByTestId("var-name-1")).toHaveValue("Y");
  await expect(page.getByTestId("cons-0-coef-0")).toHaveValue("2");
  await expect(page.getByTestId("cons-0-rhs")).toHaveValue("100");
  await expect(page.getByTestId("cons-2-rel")).toHaveValue("<=");
  await page.getByTestId("cons-0-rhs").fill("90");
  await page.getByTestId("view-text").click();
  const text = await page.getByTestId("editor").inputValue();
  expect(text).toContain("MAX 3 X + 2 Y");
  expect(text).toContain("2 X + Y <= 90");
  expect(text).toContain("X + Y <= 80");
  expect(text).toContain("TITLE LP-01 Optimo unico");
  await page.getByTestId("editor").fill(text.replace("X <= 40", "X <= 35"));
  await page.getByTestId("view-table").click();
  await expect(page.getByTestId("cons-0-rhs")).toHaveValue("90");
  await expect(page.getByTestId("cons-2-rhs")).toHaveValue("35");
  await page.getByTestId("solve-button").click();
  await expect(page.getByTestId("status")).toContainText("Z = 170");
  expect(errors).toEqual([]);
});

test("Paramétrico de LP-01: tres tramos y quiebres en 80 y 120", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByTestId("solve-button").click();
  await page.getByTestId("tab-parametric").click();
  await page.getByTestId("param-from").fill("0");
  await page.getByTestId("param-to").fill("200");
  await page.getByTestId("param-run").click();
  await expect(
    page.getByTestId("param-segments").locator("tbody tr"),
  ).toHaveCount(3);
  const breakpoints = page.getByTestId("param-breakpoints").locator("tbody tr");
  await expect(breakpoints).toHaveCount(2);
  await expect(breakpoints.nth(0)).toContainText("80");
  await expect(breakpoints.nth(1)).toContainText("120");
  await expect(page.getByTestId("param-chart")).toBeVisible();
  await page.getByTestId("param-kind").selectOption("cost");
  await page.getByTestId("param-from").fill("0");
  await page.getByTestId("param-to").fill("6");
  await page.getByTestId("param-run").click();
  await expect(
    page.getByTestId("param-segments").locator("tbody tr"),
  ).toHaveCount(3);
});

test("ILP-01 en la interfaz: óptimo entero Z = 20, árbol de cinco nodos y grilla entera en el gráfico", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await page
    .getByTestId("examples-select")
    .selectOption({ label: "ILP-01 Programacion entera" });
  await page.getByTestId("solve-button").click();
  await expect(page.getByTestId("status")).toHaveAttribute(
    "data-status",
    "optimal",
  );
  await expect(page.getByTestId("status")).toContainText("Óptimo entero");
  await expect(page.getByTestId("status")).toContainText("Z = 20");
  await expect(page.getByTestId("report")).toContainText("5 nodos");
  await page.getByTestId("report-classic").click();
  await expect(page.getByTestId("report")).toContainText(
    "ENUMERATION COMPLETE",
  );
  await page.getByTestId("tab-tree").click();
  await expect(page.locator("[data-testid^=tree-node-]")).toHaveCount(5);
  await page.getByTestId("tree-node-2").click();
  await expect(page.getByTestId("tree-details")).toContainText("Y >= 2");
  await page.getByTestId("tree-next").click();
  await page.getByTestId("tab-graph").click();
  await expect(page.getByTestId("integer-point")).toHaveCount(13);
  await expect(page.getByTestId("integer-optimum")).toContainText("(4, 0)");
  expect(errors).toEqual([]);
});

test("Transporte TR-01: Vogel 475, MODI 435 con el ciclo resaltado; asignación AS-01 cuesta 9; transbordo TR-03 cuesta 52", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await page.getByTestId("module-transport").click();
  await expect(page.getByTestId("transport-module")).toBeVisible();
  await expect(page.getByTestId("tr-cell-0-1")).toHaveValue("2");
  await page.getByTestId("transport-solve").click();
  await expect(page.getByTestId("transport-status")).toContainText("435");
  await expect(page.getByTestId("transport-report")).toContainText(
    "Costo total: 435",
  );
  await expect(page.getByTestId("transport-report")).toContainText(
    "Vogel (costo 475)",
  );
  await page.getByTestId("tab-iterations").click();
  await expect(page.getByTestId("transport-position")).toContainText(
    "Iteración 0",
  );
  await expect(page.getByTestId("cycle-cell").first()).toBeVisible();
  await page.getByTestId("transport-next").click();
  await expect(page.getByTestId("transport-position")).toContainText(
    "Iteración 1",
  );
  await page.getByTestId("tab-sensitivity").click();
  await expect(page.getByTestId("transport-sensitivity")).toBeVisible();

  await page
    .getByTestId("transport-examples")
    .selectOption({ label: "AS-01 Asignación" });
  await page.getByTestId("transport-solve").click();
  await expect(page.getByTestId("transport-status")).toContainText("9");
  await page.getByTestId("tab-iterations").click();
  await expect(page.getByTestId("hungarian-matrix")).toBeVisible();
  await page.getByTestId("hungarian-prev").click();
  await expect(page.getByTestId("hungarian-note")).toBeVisible();

  await page
    .getByTestId("transport-examples")
    .selectOption({ label: "TR-03 Transbordo" });
  await page.getByTestId("transport-solve").click();
  await expect(page.getByTestId("transport-status")).toContainText("52");
  await expect(page.getByTestId("transport-report")).toContainText(
    "Pasan 10 unidades por T",
  );

  await page
    .getByTestId("transport-examples")
    .selectOption({ label: "TR-02 Transporte desbalanceado" });
  await page.getByTestId("transport-solve").click();
  await expect(page.getByTestId("transport-messages")).toContainText(
    "ficticio",
  );
  expect(errors).toEqual([]);
});
