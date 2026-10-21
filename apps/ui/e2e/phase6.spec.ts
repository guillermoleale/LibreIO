// SPDX-License-Identifier: GPL-3.0-or-later
// Fase 6: cortes de Gomory en la interfaz.
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

test("Cortes de Gomory: ILP-01 llega a Z = 20 con cortes navegables y se puede volver a ramificación", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await page
    .getByTestId("examples-select")
    .selectOption({ label: "ILP-01 Programacion entera" });
  await page.getByTestId("integer-method-select").selectOption("gomory");
  await page.getByTestId("solve-button").click();
  await expect(page.getByTestId("status")).toContainText("cortes de Gomory");
  await expect(page.getByTestId("status")).toContainText("Z = 20");
  await expect(page.getByTestId("report")).toContainText("Corte 1");
  await page.getByTestId("tab-cuts").click();
  await expect(page.getByTestId("cuts-tab")).toBeVisible();
  await expect(page.getByTestId("cuts-list")).toContainText(/<=|>=/);
  const before = await page.getByTestId("cuts-position").textContent();
  await page.getByTestId("cuts-next").click();
  await expect(page.getByTestId("cuts-position")).not.toHaveText(before ?? "");
  await page
    .getByTestId("integer-method-select")
    .selectOption("branchAndBound");
  await page.getByTestId("solve-button").click();
  await expect(page.getByTestId("tab-tree")).toBeVisible();
  expect(errors).toEqual([]);
});
