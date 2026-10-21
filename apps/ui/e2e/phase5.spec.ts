// SPDX-License-Identifier: GPL-3.0-or-later
// Fase 5: programación dinámica y cadenas de Markov sobre la versión web.
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

test("Programación dinámica: DP-01 mochila vale 7 con los objetos 1 y 2 y DP-02 diligencia cuesta 7 por 1-3-5-6", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await page.getByTestId("module-dp").click();
  await expect(page.getByTestId("dp-module")).toBeVisible();
  await page.getByTestId("dp-solve").click();
  await expect(page.getByTestId("dp-status")).toContainText("Valor óptimo: 7");
  await expect(page.getByTestId("dp-status")).toContainText("1, 2");
  await page.getByTestId("tab-tables").click();
  await expect(page.getByTestId("dp-tables")).toBeVisible();
  await page
    .getByTestId("dp-examples")
    .selectOption({ label: "DP-02 Diligencia" });
  await page.getByTestId("dp-solve").click();
  await expect(page.getByTestId("dp-status")).toContainText("Costo mínimo: 7");
  await expect(page.getByTestId("dp-status")).toContainText("1 -> 3 -> 5 -> 6");
  expect(errors).toEqual([]);
});

test("Markov: MK-01 estado estable (5/6, 1/6) y primer paso 10, MK-02 absorción 3/5 y cadena periódica", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await page.getByTestId("module-markov").click();
  await expect(page.getByTestId("markov-module")).toBeVisible();
  await page.getByTestId("markov-solve").click();
  await expect(page.getByTestId("markov-status")).toContainText("5/6");
  await page.getByTestId("tab-passage").click();
  await expect(page.getByTestId("markov-passage")).toContainText("10");
  await page
    .getByTestId("markov-examples")
    .selectOption({ label: "MK-02 Estados absorbentes" });
  await page.getByTestId("markov-solve").click();
  await expect(page.getByTestId("markov-status")).toContainText("absorbentes");
  await page.getByTestId("tab-absorbing").click();
  await expect(page.getByTestId("markov-absorbing")).toContainText("3/5");
  await page
    .getByTestId("markov-examples")
    .selectOption({ label: "Cadena periódica de dos estados" });
  await page.getByTestId("markov-solve").click();
  await expect(page.getByTestId("markov-status")).toContainText("periódica");
  expect(errors).toEqual([]);
});
