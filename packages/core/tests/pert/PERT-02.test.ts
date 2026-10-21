// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación PERT-02: PERT con tres estimaciones y probabilidades.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import {
  normalCdf,
  normalQuantile,
  pert,
  type ProjectProblem,
} from "../../src/pert";
import { reportPert } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

export const pert02: ProjectProblem = {
  title: "PERT-02",
  activities: [
    {
      id: "A",
      name: null,
      predecessors: [],
      duration: fr(3),
      optimistic: fr(2),
      mostLikely: fr(3),
      pessimistic: fr(4),
    },
    {
      id: "B",
      name: null,
      predecessors: [],
      duration: fr(2),
      optimistic: fr(1),
      mostLikely: fr(2),
      pessimistic: fr(3),
    },
    {
      id: "C",
      name: null,
      predecessors: ["A"],
      duration: fr(4),
      optimistic: fr(2),
      mostLikely: fr(4),
      pessimistic: fr(6),
    },
    {
      id: "D",
      name: null,
      predecessors: ["B"],
      duration: fr(1),
      optimistic: fr(1),
      mostLikely: fr(1),
      pessimistic: fr(1),
    },
    {
      id: "E",
      name: null,
      predecessors: ["C", "D"],
      duration: fr(2),
      optimistic: fr(1),
      mostLikely: fr(2),
      pessimistic: fr(3),
    },
  ],
};

describe("PERT-02. PERT", () => {
  it("duración esperada 9 y varianza del camino crítico 2/3", () => {
    const r = pert(pert02);
    expect(r.expectedDuration).toEqual(fr(9));
    expect(r.variance).toEqual(fr("2/3"));
    expect(r.criticalPath).toEqual(["A", "C", "E"]);
    const byId = Object.fromEntries(r.activities.map((a) => [a.id, a]));
    expect(byId["A"]).toMatchObject({ expected: fr(3), variance: fr("1/9") });
    expect(byId["C"]).toMatchObject({ expected: fr(4), variance: fr("4/9") });
    expect(byId["D"]).toMatchObject({ expected: fr(1), variance: fr(0) });
    expect(r.standardDeviation).toBeCloseTo(Math.sqrt(2 / 3), 10);
  });

  it("la probabilidad de terminar en 10 unidades es Φ(1 / √(2/3)), aproximadamente 0.89", () => {
    const r = pert(pert02);
    const p = r.probabilityByDate(10);
    expect(p).toBeCloseTo(normalCdf(1 / Math.sqrt(2 / 3)), 10);
    expect(Math.abs(p - 0.8897)).toBeLessThan(0.001);
    expect(r.probabilityByDate(9)).toBeCloseTo(0.5, 10);
    expect(r.dateForProbability(p)).toBeCloseTo(10, 6);
    expect(r.dateForProbability(0.5)).toBeCloseTo(9, 10);
  });

  it("la normal estándar y su inversa son precisas", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 12);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021, 6);
    expect(normalCdf(-1.645)).toBeCloseTo(0.05, 3);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.05)).toBeCloseTo(-1.644854, 5);
  });

  it("el reporte muestra las estimaciones, la duración esperada y la varianza", () => {
    const text = reportPert(pert02, pert(pert02));
    expect(text).toContain("Duración esperada: 9");
    expect(text).toContain("Varianza del camino crítico: 2/3");
    expect(text).toMatch(/C\s+2\s+4\s+6\s+4\s+4\/9/);
  });
});
