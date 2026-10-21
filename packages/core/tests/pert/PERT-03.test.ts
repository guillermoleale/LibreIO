// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación PERT-03: compresión (crashing) al mínimo costo con curva de costo contra duración.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { crashing, type ProjectProblem } from "../../src/pert";
import { reportCrashing } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

export const pert03: ProjectProblem = {
  title: "PERT-03",
  activities: [
    {
      id: "A",
      name: null,
      predecessors: [],
      duration: fr(3),
      crashDuration: fr(2),
      crashCostPerUnit: fr(50),
    },
    { id: "B", name: null, predecessors: [], duration: fr(2) },
    {
      id: "C",
      name: null,
      predecessors: ["A"],
      duration: fr(4),
      crashDuration: fr(3),
      crashCostPerUnit: fr(30),
    },
    { id: "D", name: null, predecessors: ["B"], duration: fr(1) },
    {
      id: "E",
      name: null,
      predecessors: ["C", "D"],
      duration: fr(2),
      crashDuration: fr(1),
      crashCostPerUnit: fr(80),
    },
  ],
};

const crashedMap = (crashed: Array<{ id: string; amount: Fraction }>) =>
  Object.fromEntries(
    crashed
      .filter((c) => !c.amount.isZero())
      .map((c) => [c.id, c.amount.toString()]),
  );

describe("PERT-03. Compresión", () => {
  it("acortar a 7 cuesta 80 con una unidad de C y una de A", () => {
    const r = crashing(pert03, fr(7));
    expect(r.normalDuration).toEqual(fr(9));
    expect(r.target).not.toBeNull();
    expect(r.target!.feasible).toBe(true);
    expect(r.target!.duration).toEqual(fr(7));
    expect(r.target!.cost).toEqual(fr(80));
    expect(crashedMap(r.target!.crashed)).toEqual({ A: "1", C: "1" });
  });

  it("acortar a 6 cuesta 160 con además una unidad de E, y no se puede bajar de 6", () => {
    const r = crashing(pert03, fr(6));
    expect(r.target!.cost).toEqual(fr(160));
    expect(crashedMap(r.target!.crashed)).toEqual({ A: "1", C: "1", E: "1" });
    expect(r.minimumDuration).toEqual(fr(6));
    const impossible = crashing(pert03, fr(5));
    expect(impossible.target!.feasible).toBe(false);
    expect(impossible.messages.join("\n")).toMatch(/6/);
    const text = reportCrashing(pert03, impossible);
    expect(text).toMatch(/[Nn]o se puede (acortar|bajar)/);
    expect(text).toContain("6");
  });

  it("la curva de costo contra duración tiene un punto por unidad desde 9 hasta 6", () => {
    const r = crashing(pert03);
    expect(
      r.curve.map((p) => [p.duration.toString(), p.cost.toString()]),
    ).toEqual([
      ["9", "0"],
      ["8", "30"],
      ["7", "80"],
      ["6", "160"],
    ]);
    expect(crashedMap(r.curve[1]!.crashed)).toEqual({ C: "1" });
    expect(r.curve[3]!.criticalPaths.length).toBeGreaterThanOrEqual(1);
    expect(r.target).toBeNull();
  });

  it("considera los caminos paralelos que se vuelven críticos", () => {
    const parallel: ProjectProblem = {
      title: null,
      activities: [
        {
          id: "A",
          name: null,
          predecessors: [],
          duration: fr(4),
          crashDuration: fr(1),
          crashCostPerUnit: fr(10),
        },
        {
          id: "B",
          name: null,
          predecessors: [],
          duration: fr(3),
          crashDuration: fr(1),
          crashCostPerUnit: fr(20),
        },
      ],
    };
    const r = crashing(parallel, fr(2));
    // Bajar a 3 cuesta 10 (solo A). Bajar a 2 exige acortar A y B: 20 + 20 = 40
    expect(r.curve.map((p) => p.cost.toString())).toEqual([
      "0",
      "10",
      "40",
      "70",
    ]);
    expect(r.target!.cost).toEqual(fr(40));
    expect(crashedMap(r.target!.crashed)).toEqual({ A: "2", B: "1" });
    const text = reportCrashing(parallel, r);
    expect(text).toContain("40");
  });
});
