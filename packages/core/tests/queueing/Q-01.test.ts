// SPDX-License-Identifier: GPL-3.0-or-later
// Casos de aceptación Q-01 a Q-03: M/M/1, M/M/2 y M/D/1 con λ = 2 y μ = 3.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { solveQueue, type QueueModel } from "../../src/queueing";
import { reportQueue } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

describe("Q-01. M/M/1 con λ = 2 y μ = 3", () => {
  const model: QueueModel = { kind: "MM1", lambda: fr(2), mu: fr(3) };
  const r = solveQueue(model);

  it("ρ = 2/3, P0 = 1/3, L = 2, Lq = 4/3, W = 1, Wq = 2/3", () => {
    expect(r.stable).toBe(true);
    expect(r.rho).toEqual(fr("2/3"));
    expect(r.P0).toEqual(fr("1/3"));
    expect(r.L).toEqual(fr(2));
    expect(r.Lq).toEqual(fr("4/3"));
    expect(r.W).toEqual(fr(1));
    expect(r.Wq).toEqual(fr("2/3"));
    expect(r.lambdaEff).toEqual(fr(2));
    expect(r.probabilityOfWaiting).toEqual(fr("2/3"));
  });

  it("Pn = (1 - ρ) ρ^n y la tabla de Pn acumula hasta cerca de 1", () => {
    expect(r.Pn(0)).toEqual(fr("1/3"));
    expect(r.Pn(1)).toEqual(fr("2/9"));
    expect(r.Pn(2)).toEqual(fr("4/27"));
    expect(r.pnTable.length).toBeGreaterThanOrEqual(10);
    expect(r.pnTable[2]).toEqual({
      n: 2,
      probability: fr("4/27"),
      cumulative: fr("19/27"),
    });
  });

  it("detecta inestabilidad cuando λ ≥ μ", () => {
    const unstable = solveQueue({ kind: "MM1", lambda: fr(3), mu: fr(2) });
    expect(unstable.stable).toBe(false);
    expect(unstable.messages.join(" ")).toMatch(/inestable|ρ ≥ 1|utilización/i);
    expect(reportQueue(model, r)).toContain("L = 2");
  });
});

describe("Q-02. M/M/2 con λ = 2 y μ = 3", () => {
  const model: QueueModel = {
    kind: "MMs",
    lambda: fr(2),
    mu: fr(3),
    servers: 2,
  };
  const r = solveQueue(model);

  it("ρ = 1/3, P0 = 1/2, Lq = 1/12, L = 3/4, Wq = 1/24, W = 3/8", () => {
    expect(r.rho).toEqual(fr("1/3"));
    expect(r.P0).toEqual(fr("1/2"));
    expect(r.Lq).toEqual(fr("1/12"));
    expect(r.L).toEqual(fr("3/4"));
    expect(r.Wq).toEqual(fr("1/24"));
    expect(r.W).toEqual(fr("3/8"));
    // Probabilidad de esperar: P(n >= 2) = P0 r^2 / (2 (1 - ρ)) = 1/6
    expect(r.probabilityOfWaiting).toEqual(fr("1/6"));
    expect(r.Pn(1)).toEqual(fr("1/3"));
  });

  it("M/M/s con s = 1 coincide con M/M/1", () => {
    const one = solveQueue({
      kind: "MMs",
      lambda: fr(2),
      mu: fr(3),
      servers: 1,
    });
    expect(one.L).toEqual(fr(2));
    expect(one.P0).toEqual(fr("1/3"));
  });
});

describe("Q-03. M/D/1 con λ = 2 y μ = 3", () => {
  it("Lq = 2/3, L = 4/3, Wq = 1/3, W = 2/3", () => {
    const r = solveQueue({ kind: "MD1", lambda: fr(2), mu: fr(3) });
    expect(r.Lq).toEqual(fr("2/3"));
    expect(r.L).toEqual(fr("4/3"));
    expect(r.Wq).toEqual(fr("1/3"));
    expect(r.W).toEqual(fr("2/3"));
    expect(r.rho).toEqual(fr("2/3"));
  });

  it("M/G/1 con varianza cero es M/D/1 y M/Ek/1 interpola entre M/D/1 y M/M/1", () => {
    const mg1 = solveQueue({
      kind: "MG1",
      lambda: fr(2),
      mu: fr(3),
      serviceVariance: fr(0),
    });
    expect(mg1.Lq).toEqual(fr("2/3"));
    const mm1 = solveQueue({
      kind: "MG1",
      lambda: fr(2),
      mu: fr(3),
      serviceVariance: fr("1/9"),
    });
    expect(mm1.Lq).toEqual(fr("4/3"));
    const ek1 = solveQueue({
      kind: "MEk1",
      lambda: fr(2),
      mu: fr(3),
      phases: 1,
    });
    expect(ek1.Lq).toEqual(fr("4/3"));
    const ek2 = solveQueue({
      kind: "MEk1",
      lambda: fr(2),
      mu: fr(3),
      phases: 2,
    });
    // Lq = (1 + 1/k)/2 · λ² / (μ (μ - λ)) = (3/4) · 4/3 = 1
    expect(ek2.Lq).toEqual(fr(1));
  });
});

describe("Modelos con capacidad finita y población finita", () => {
  it("M/M/1/K con λ = 2, μ = 3 y K = 3", () => {
    const r = solveQueue({
      kind: "MM1K",
      lambda: fr(2),
      mu: fr(3),
      capacity: 3,
    });
    expect(r.P0).toEqual(fr("27/65"));
    expect(r.Pn(3)).toEqual(fr("8/65"));
    expect(r.lambdaEff).toEqual(fr("114/65"));
    expect(r.L).toEqual(fr("66/65"));
    expect(r.Lq).toEqual(fr("28/65"));
    expect(r.W).toEqual(fr("11/19"));
    expect(r.Wq).toEqual(fr("14/57"));
    expect(r.stable).toBe(true);
    const saturated = solveQueue({
      kind: "MM1K",
      lambda: fr(3),
      mu: fr(3),
      capacity: 2,
    });
    expect(saturated.P0).toEqual(fr("1/3"));
  });

  it("M/M/s/K y M/M/s con población finita son consistentes: las Pn suman 1 y λ efectiva = μ (L - Lq)", () => {
    const models: QueueModel[] = [
      { kind: "MMsK", lambda: fr(2), mu: fr(3), servers: 2, capacity: 4 },
      { kind: "MMsN", lambda: fr("1/2"), mu: fr(3), servers: 2, population: 5 },
    ];
    for (const m of models) {
      const r = solveQueue(m);
      const sum = Fraction.sum(r.pnTable.map((p) => p.probability));
      expect(sum, m.kind).toEqual(Fraction.ONE);
      expect(r.lambdaEff, m.kind).toEqual(r.mu.mul(r.L.sub(r.Lq)));
      expect(r.W.mul(r.lambdaEff), m.kind).toEqual(r.L);
    }
  });
});
