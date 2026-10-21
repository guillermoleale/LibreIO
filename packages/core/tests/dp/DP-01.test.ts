// SPDX-License-Identifier: GPL-3.0-or-later
// Casos de aceptación DP-01 (mochila) y DP-02 (diligencia) con la tabla de cada etapa.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import {
  knapsack,
  stagecoach,
  type KnapsackProblem,
  type StagecoachProblem,
} from "../../src/dp";
import { reportKnapsack, reportStagecoach } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

describe("DP-01. Mochila", () => {
  const problem: KnapsackProblem = {
    title: "DP-01",
    capacity: fr(5),
    items: [
      { name: "1", weight: fr(2), value: fr(3) },
      { name: "2", weight: fr(3), value: fr(4) },
      { name: "3", weight: fr(4), value: fr(5) },
      { name: "4", weight: fr(5), value: fr(6) },
    ],
  };

  it("el valor óptimo es 7 con los objetos 1 y 2", () => {
    const r = knapsack(problem);
    expect(r.value).toEqual(fr(7));
    expect(r.selected).toEqual([0, 1]);
    expect(r.weight).toEqual(fr(5));
  });

  it("la tabla de cada etapa muestra f(etapa, capacidad) y la decisión", () => {
    const r = knapsack(problem);
    expect(r.stages).toHaveLength(4);
    // Etapa 4 (último objeto, resuelta primero hacia atrás): con capacidad 5 conviene llevarlo (valor 6)
    const last = r.stages[3]!;
    expect(last.item).toBe(3);
    expect(last.rows.find((row) => row.capacity.eq(fr(5)))).toMatchObject({
      best: fr(6),
      choice: 1,
    });
    expect(last.rows.find((row) => row.capacity.eq(fr(4)))).toMatchObject({
      best: fr(0),
      choice: 0,
    });
    // Etapa 1 con capacidad 5: f = 7 llevando el objeto 1
    const first = r.stages[0]!;
    expect(first.rows.find((row) => row.capacity.eq(fr(5)))).toMatchObject({
      best: fr(7),
      choice: 1,
    });
    expect(first.rows.length).toBe(6);
    expect(r.order).toEqual([3, 2, 1, 0]);
    const text = reportKnapsack(problem, r);
    expect(text).toContain("Valor óptimo: 7");
    expect(text).toMatch(/Objetos elegidos: 1, 2/);
  });

  it("admite varias unidades de un objeto y rechaza pesos no enteros", () => {
    const multi = knapsack({
      title: null,
      capacity: fr(10),
      items: [
        { name: "A", weight: fr(3), value: fr(4), maxUnits: 3 },
        { name: "B", weight: fr(4), value: fr(5) },
      ],
    });
    // 3 A: peso 9 valor 12; 2 A + B: peso 10 valor 13
    expect(multi.value).toEqual(fr(13));
    expect(multi.units).toEqual([2, 1]);
    expect(() =>
      knapsack({
        title: null,
        capacity: fr("5/2"),
        items: [{ name: "A", weight: fr(1), value: fr(1) }],
      }),
    ).toThrow(/enter/);
  });
});

describe("DP-02. Diligencia", () => {
  const problem: StagecoachProblem = {
    title: "DP-02",
    stages: [["1"], ["2", "3"], ["4", "5"], ["6"]],
    arcs: [
      { from: "1", to: "2", cost: fr(4) },
      { from: "1", to: "3", cost: fr(2) },
      { from: "2", to: "4", cost: fr(3) },
      { from: "2", to: "5", cost: fr(6) },
      { from: "3", to: "4", cost: fr(5) },
      { from: "3", to: "5", cost: fr(1) },
      { from: "4", to: "6", cost: fr(2) },
      { from: "5", to: "6", cost: fr(4) },
    ],
  };

  it("el costo mínimo es 7 por 1-3-5-6", () => {
    const r = stagecoach(problem);
    expect(r.status).toBe("optimal");
    expect(r.cost).toEqual(fr(7));
    expect(r.path).toEqual(["1", "3", "5", "6"]);
  });

  it("la tabla hacia atrás da f(4) = 2, f(5) = 4, f(2) = 5, f(3) = 5 y f(1) = 7", () => {
    const r = stagecoach(problem);
    expect(r.f).toEqual({
      "1": fr(7),
      "2": fr(5),
      "3": fr(5),
      "4": fr(2),
      "5": fr(4),
      "6": fr(0),
    });
    expect(r.tables).toHaveLength(3);
    const stage3 = r.tables[0]!;
    expect(stage3.stage).toBe(3);
    expect(
      stage3.rows.map((row) => [row.state, row.best.toString(), row.decision]),
    ).toEqual([
      ["4", "2", "6"],
      ["5", "4", "6"],
    ]);
    const stage2 = r.tables[1]!;
    expect(stage2.rows.find((row) => row.state === "2")).toMatchObject({
      best: fr(5),
      decision: "4",
    });
    expect(stage2.rows.find((row) => row.state === "3")).toMatchObject({
      best: fr(5),
      decision: "5",
    });
    expect(
      stage2.rows
        .find((row) => row.state === "3")
        ?.candidates.map((c) => [c.next, c.total.toString()]),
    ).toEqual([
      ["4", "7"],
      ["5", "5"],
    ]);
    expect(r.decisions["1"]).toBe("3");
    const text = reportStagecoach(problem, r);
    expect(text).toContain("Costo mínimo: 7");
    expect(text).toContain("1 -> 3 -> 5 -> 6");
  });

  it("deduce las etapas si no se dan y detecta estados sin salida", () => {
    const auto = stagecoach({ title: null, stages: null, arcs: problem.arcs });
    expect(auto.cost).toEqual(fr(7));
    expect(auto.stagesUsed).toEqual([["1"], ["2", "3"], ["4", "5"], ["6"]]);
    const broken = stagecoach({
      title: null,
      stages: null,
      arcs: problem.arcs.filter((a) => a.from !== "5"),
    });
    expect(broken.status).toBe("infeasible");
    const maximize = stagecoach({ ...problem, sense: "max" });
    expect(maximize.cost).toEqual(fr(14));
    expect(maximize.path).toEqual(["1", "2", "5", "6"]);
  });
});
