// SPDX-License-Identifier: GPL-3.0-or-later
// Fase 3: redes y PERT/CPM sobre la versión web.
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

test("Redes: NET-01 camino 7, NET-02 flujo 15 con corte, NET-03 árbol 6 y NET-04 viajante 80", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await page.getByTestId("module-network").click();
  await expect(page.getByTestId("network-module")).toBeVisible();
  await page.getByTestId("network-source").selectOption("1");
  await page.getByTestId("network-target").selectOption("5");
  await page.getByTestId("network-solve").click();
  await expect(page.getByTestId("network-status")).toContainText(
    "7 (1 -> 2 -> 3 -> 4 -> 5)",
  );
  await page.getByTestId("tab-graph").click();
  await expect(page.getByTestId("network-svg")).toBeVisible();
  await expect(page.getByTestId("network-position")).toContainText("Paso 1 de");
  await page.getByTestId("network-next").click();
  await expect(page.getByTestId("network-note")).toContainText("permanente 2");
  await page.getByTestId("tab-steps").click();
  await expect(page.getByTestId("network-steps").locator("li")).toHaveCount(5);

  await page
    .getByTestId("network-examples")
    .selectOption({ label: "NET-02 Flujo máximo" });
  await expect(page.getByTestId("network-algorithm")).toHaveValue("maxFlow");
  await page.getByTestId("network-source").selectOption("s");
  await page.getByTestId("network-target").selectOption("t");
  await page.getByTestId("network-solve").click();
  await expect(page.getByTestId("network-status")).toContainText("15");
  await expect(page.getByTestId("network-report")).toContainText(
    "Corte mínimo: {s, a, b} | {t}",
  );

  await page
    .getByTestId("network-examples")
    .selectOption({ label: "NET-03 Árbol de expansión mínima" });
  await page.getByTestId("network-solve").click();
  await expect(page.getByTestId("network-status")).toContainText("6");
  await page.getByTestId("network-method").selectOption("prim");
  await page.getByTestId("network-solve").click();
  await expect(page.getByTestId("network-report")).toContainText("Prim");
  await expect(page.getByTestId("network-report")).toContainText(
    "Costo total: 6",
  );

  await page
    .getByTestId("network-examples")
    .selectOption({ label: "NET-04 Viajante" });
  await page.getByTestId("network-solve").click();
  await expect(page.getByTestId("network-status")).toContainText(
    "80 (1 -> 2 -> 4 -> 3 -> 1)",
  );
  await page.getByTestId("tab-graph").click();
  await page.getByTestId("network-tour").selectOption("nearestNeighbor");
  await expect(page.getByTestId("network-note")).toContainText("más cercano");
  expect(errors).toEqual([]);
});

test("PERT/CPM: PERT-01 dura 9 con A-C-E, PERT-02 probabilidad 0.89 y PERT-03 comprime a 7 por 80", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await page.getByTestId("module-pert").click();
  await expect(page.getByTestId("pert-module")).toBeVisible();
  await page.getByTestId("pert-solve").click();
  await expect(page.getByTestId("pert-status")).toContainText(
    "Duración del proyecto: 9",
  );
  await expect(page.getByTestId("pert-status")).toContainText("A -> C -> E");
  await page.getByTestId("tab-times").click();
  await expect(page.getByTestId("pert-times")).toContainText("B");
  await page.getByTestId("tab-network").click();
  await expect(page.getByTestId("aon-svg")).toBeVisible();
  await expect(page.getByTestId("aon-C")).toHaveClass(/critical/);
  await page.getByTestId("tab-gantt").click();
  await expect(page.getByTestId("gantt-svg")).toBeVisible();

  await page
    .getByTestId("pert-examples")
    .selectOption({ label: "PERT-02 PERT" });
  await page.getByTestId("pert-solve").click();
  await page.getByTestId("tab-pert").click();
  await page.getByTestId("pert-date").fill("10");
  await expect(page.getByTestId("pert-probability-result")).toContainText(
    "P = 0.889",
  );
  await page.getByTestId("pert-prob").fill("0.5");
  await expect(page.getByTestId("pert-date-result")).toContainText(
    "T = 9.0000",
  );

  await page
    .getByTestId("pert-examples")
    .selectOption({ label: "PERT-03 Compresión" });
  await page.getByTestId("pert-target").fill("7");
  await page.getByTestId("pert-solve").click();
  await page.getByTestId("tab-crashing").click();
  await expect(page.getByTestId("crash-result")).toContainText("costo 80");
  await expect(page.getByTestId("crash-result")).toContainText("A 1");
  await expect(page.getByTestId("crash-result")).toContainText("C 1");
  await expect(page.getByTestId("crash-table").locator("tbody tr")).toHaveCount(
    4,
  );
  await page.getByTestId("crash-target").fill("5");
  await page.getByTestId("crash-run").click();
  await expect(page.getByTestId("crash-result")).toContainText(
    "por debajo de 6",
  );
  await expect(page.getByTestId("crash-curve")).toBeVisible();
  expect(errors).toEqual([]);
});
