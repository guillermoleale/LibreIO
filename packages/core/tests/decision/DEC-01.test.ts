// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación DEC-01: tabla de pagos con todos los criterios.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { payoffAnalysis, type PayoffProblem } from "../../src/decision";
import { reportPayoff } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));
const row = (values: number[]) => values.map((v) => fr(v));

export const dec01: PayoffProblem = {
  title: "DEC-01",
  sense: "max",
  alternatives: ["A1", "A2", "A3"],
  states: ["S1", "S2", "S3"],
  payoffs: [row([50, 40, 30]), row([80, 20, 10]), row([60, 50, 5])],
  probabilities: [fr("3/10"), fr("1/2"), fr("1/5")],
  alpha: fr("3/5"),
};

describe("DEC-01. Tabla de pagos", () => {
  const r = payoffAnalysis(dec01);

  it("maximax A2, maximin A1, Laplace A1 con 40 y Hurwicz con α = 0.6 A2 con 52", () => {
    expect(r.maximax).toMatchObject({ alternative: 1, value: fr(80) });
    expect(r.maximin).toMatchObject({ alternative: 0, value: fr(30) });
    expect(r.laplace).toMatchObject({ alternative: 0, value: fr(40) });
    expect(r.hurwicz).toMatchObject({ alternative: 1, value: fr(52) });
    expect(r.hurwicz.values).toEqual([fr(42), fr(52), fr(38)]);
  });

  it("Savage A3 con arrepentimiento máximo 25, valor esperado A3 con 44 y VEIP 11", () => {
    expect(r.savage).toMatchObject({ alternative: 2, value: fr(25) });
    expect(r.savage.regrets).toEqual([
      row([30, 10, 0]),
      row([0, 30, 20]),
      row([20, 0, 25]),
    ]);
    expect(r.expectedValue).toMatchObject({ alternative: 2, value: fr(44) });
    expect(r.expectedValue!.values).toEqual([fr(41), fr(36), fr(44)]);
    expect(r.expectedRegret).toMatchObject({ alternative: 2, value: fr(11) });
    expect(r.evwpi).toEqual(fr(55));
    expect(r.evpi).toEqual(fr(11));
  });

  it("sin probabilidades no hay criterios de valor esperado y con costos los criterios se invierten", () => {
    const noProb = payoffAnalysis({ ...dec01, probabilities: null });
    expect(noProb.expectedValue).toBeNull();
    expect(noProb.evpi).toBeNull();
    expect(noProb.maximax.alternative).toBe(1);
    const costs = payoffAnalysis({ ...dec01, sense: "min" });
    // Minimin (optimista): A3 con 5. Minimax (pesimista): A1 con 50. Valor esperado mínimo: A2 con 36
    expect(costs.maximax).toMatchObject({ alternative: 2, value: fr(5) });
    expect(costs.maximin).toMatchObject({ alternative: 0, value: fr(50) });
    expect(costs.expectedValue).toMatchObject({
      alternative: 1,
      value: fr(36),
    });
    expect(costs.savage.regrets[0]).toEqual(row([0, 20, 25]));
    expect(costs.evpi).toEqual(
      fr(36).sub(
        fr("3/10")
          .mul(fr(50))
          .add(fr("1/2").mul(fr(20)))
          .add(fr("1/5").mul(fr(5))),
      ),
    );
  });

  it("el reporte muestra cada criterio con su alternativa", () => {
    const text = reportPayoff(dec01, r);
    expect(text).toMatch(/Maximax.*A2/);
    expect(text).toMatch(/Laplace.*A1.*40/);
    expect(text).toMatch(/VEIP.*11/);
  });
});
