// SPDX-License-Identifier: GPL-3.0-or-later
// Pulido: exportación de reportes en todos los módulos y Ctrl+Enter global.
import { expect, test } from "@playwright/test";

test("los módulos exportan el reporte a .md y Ctrl+Enter resuelve fuera del editor de PL", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByTestId("module-network").click();
  await page.getByTestId("network-source").selectOption("1");
  await page.getByTestId("network-target").selectOption("5");
  await page.getByTestId("network-directed").focus();
  await page.keyboard.press("Control+Enter");
  await expect(page.getByTestId("network-status")).toContainText("7");
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("network-report-md").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("red.md");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf-8");
  expect(text.startsWith("```\n")).toBe(true);
  expect(text).toContain("Distancia mínima de 1 a 5: 7");

  await page.getByTestId("module-queueing").click();
  await page.getByTestId("queue-lambda").focus();
  await page.keyboard.press("Control+Enter");
  await expect(page.getByTestId("queue-status")).toContainText("L = 2");
  await expect(page.getByTestId("queue-report-txt")).toBeVisible();
  await page.getByTestId("module-markov").click();
  await page.getByTestId("markov-solve").click();
  await expect(page.getByTestId("markov-report-md")).toBeVisible();
});
