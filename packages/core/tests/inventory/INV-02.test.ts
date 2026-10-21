// SPDX-License-Identifier: GPL-3.0-or-later
// Casos de aceptación INV-02 e INV-03: una sola compra y revisión continua.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { continuousReview, newsvendor } from "../../src/inventory";
import { reportContinuousReview, reportNewsvendor } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

describe("INV-02. Una sola compra (newsvendor)", () => {
  it("demanda uniforme entre 100 y 200, costo 4, precio 10 y rescate 2: razón crítica 3/4 y Q* = 175", () => {
    const r = newsvendor({
      cost: fr(4),
      price: fr(10),
      salvage: fr(2),
      demand: { kind: "uniform", min: fr(100), max: fr(200) },
    });
    expect(r.criticalRatio).toEqual(fr("3/4"));
    expect(r.quantity).toEqual(fr(175));
    expect(r.underageCost).toEqual(fr(6));
    expect(r.overageCost).toEqual(fr(2));
    expect(reportNewsvendor(r)).toContain("Q* = 175");
  });

  it("con demanda discreta elige la menor cantidad cuya probabilidad acumulada alcanza la razón crítica", () => {
    const r = newsvendor({
      cost: fr(4),
      price: fr(10),
      salvage: fr(2),
      demand: {
        kind: "discrete",
        values: [fr(100), fr(150), fr(200), fr(250)],
        probabilities: [fr("1/5"), fr("2/5"), fr("3/10"), fr("1/10")],
      },
    });
    // Acumuladas 0.2, 0.6, 0.9, 1 contra 0.75
    expect(r.quantity).toEqual(fr(200));
    expect(r.table!.map((row) => row.cumulative.toString())).toEqual([
      "1/5",
      "3/5",
      "9/10",
      "1",
    ]);
    expect(r.expectedProfit!.isPositive()).toBe(true);
  });

  it("con demanda normal usa el cuantil de la razón crítica", () => {
    const r = newsvendor({
      cost: fr(4),
      price: fr(10),
      salvage: fr(2),
      demand: { kind: "normal", mean: fr(150), sd: fr(20) },
    });
    expect(r.quantity.toNumber()).toBeCloseTo(150 + 0.6745 * 20, 1);
  });
});

describe("INV-03. Revisión continua", () => {
  it("stock de seguridad 32.9 y punto de reorden 132.9 con z = 1.645 para un nivel de servicio del 95 %", () => {
    const r = continuousReview({
      demand: fr(1200),
      orderQuantity: fr(200),
      leadTime: fr("1/12"),
      leadTimeDemand: { mean: fr(100), sd: fr(20) },
      serviceLevel: 0.95,
    });
    expect(Math.abs(r.z - 1.645)).toBeLessThan(0.001);
    expect(Math.abs(r.safetyStock.toNumber() - 32.9)).toBeLessThan(0.1);
    expect(Math.abs(r.reorderPoint.toNumber() - 132.9)).toBeLessThan(0.1);
    expect(r.ordersPerPeriod).toEqual(fr(6));
    const text = reportContinuousReview(r);
    expect(text).toMatch(/Punto de reorden: 132[.,]9/);
  });
});
