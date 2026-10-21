// SPDX-License-Identifier: GPL-3.0-or-later
// Fase 4: colas, inventarios y decisiones sobre la versión web.
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

test("Colas: Q-02 da L = 3/4 y costo 85/2, el análisis de capacidad compara s y Q-03 da Lq = 2/3", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await page.getByTestId("module-queueing").click();
  await expect(page.getByTestId("queue-module")).toBeVisible();
  await page
    .getByTestId("queue-examples")
    .selectOption({ label: "Q-02 M/M/2" });
  await page.getByTestId("queue-solve").click();
  await expect(page.getByTestId("queue-status")).toContainText("L = 3/4");
  await expect(page.getByTestId("queue-cost")).toContainText("85/2");
  await page.getByTestId("tab-capacity").click();
  await expect(page.getByTestId("queue-capacity")).toContainText("85/2");
  await expect(page.getByTestId("queue-capacity")).toContainText("70");
  await page.getByTestId("tab-pn").click();
  await expect(page.getByTestId("queue-pn")).toBeVisible();
  await page
    .getByTestId("queue-examples")
    .selectOption({ label: "Q-03 M/D/1" });
  await page.getByTestId("queue-solve").click();
  await expect(page.getByTestId("queue-status")).toContainText("Lq = 2/3");
  expect(errors).toEqual([]);
});

test("Inventarios: INV-01 da Q* = 200 con gráficos, INV-02 da Q* = 175 e INV-03 da punto de reorden 132.9", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await page.getByTestId("module-inventory").click();
  await expect(page.getByTestId("inventory-module")).toBeVisible();
  await page.getByTestId("inventory-solve").click();
  await expect(page.getByTestId("inventory-status")).toContainText("Q* = 200");
  await page.getByTestId("tab-level").click();
  await expect(page.getByTestId("inventory-level")).toBeVisible();
  await page.getByTestId("tab-costs").click();
  await expect(page.getByTestId("inventory-costs")).toBeVisible();
  await page
    .getByTestId("inventory-examples")
    .selectOption({ label: "INV-02 Una sola compra" });
  await page.getByTestId("inventory-solve").click();
  await expect(page.getByTestId("inventory-status")).toContainText("Q* = 175");
  await page
    .getByTestId("inventory-examples")
    .selectOption({ label: "INV-03 Revisión continua" });
  await page.getByTestId("inventory-solve").click();
  await expect(page.getByTestId("inventory-status")).toContainText("132.9");
  expect(errors).toEqual([]);
});

test("Decisiones: DEC-01 criterios, DEC-02 juego mixto con gráfico, DEC-03 Bayes y árbol", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await page.getByTestId("module-decision").click();
  await expect(page.getByTestId("decision-module")).toBeVisible();
  await page
    .getByTestId("decision-examples")
    .selectOption({ label: "DEC-01 Tabla de pagos" });
  await page.getByTestId("decision-solve").click();
  await expect(page.getByTestId("decision-status")).toContainText("A3");
  await expect(page.getByTestId("decision-status")).toContainText("44");
  await expect(page.getByTestId("decision-status")).toContainText("VEIP 11");
  await expect(page.getByTestId("decision-report")).toContainText("Maximax");
  await expect(page.getByTestId("decision-report")).toContainText("A2");
  await page.getByTestId("tab-criteria").click();
  await expect(page.getByTestId("panel-criteria")).toContainText("Savage");

  await page
    .getByTestId("decision-examples")
    .selectOption({ label: "DEC-02 Juego con estrategias mixtas" });
  await page.getByTestId("decision-solve").click();
  await expect(page.getByTestId("decision-status")).toContainText("1/2");
  await expect(page.getByTestId("decision-report")).toContainText("(3/8, 5/8)");
  await page.getByTestId("tab-graphical").click();
  await expect(page.getByTestId("game-chart")).toBeVisible();

  await page
    .getByTestId("decision-examples")
    .selectOption({ label: "DEC-03 Revisión bayesiana" });
  await page.getByTestId("decision-solve").click();
  await expect(page.getByTestId("decision-status")).toContainText("5/14");

  await page
    .getByTestId("decision-examples")
    .selectOption({ label: "DEC-03 como árbol de decisión" });
  await page.getByTestId("decision-solve").click();
  await expect(page.getByTestId("decision-status")).toContainText("50");
  await page.getByTestId("tab-tree").click();
  await expect(page.getByTestId("decision-tree-svg")).toBeVisible();
  expect(errors).toEqual([]);
});
