// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación PERT-01: CPM con tiempos tempranos y tardíos, holguras y camino crítico.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { cpm, type ProjectProblem } from "../../src/pert";
import { reportCpm } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

export const pert01: ProjectProblem = {
  title: "PERT-01",
  activities: [
    { id: "A", name: null, predecessors: [], duration: fr(3) },
    { id: "B", name: null, predecessors: [], duration: fr(2) },
    { id: "C", name: null, predecessors: ["A"], duration: fr(4) },
    { id: "D", name: null, predecessors: ["B"], duration: fr(1) },
    { id: "E", name: null, predecessors: ["C", "D"], duration: fr(2) },
  ],
};

describe("PERT-01. CPM", () => {
  it("la duración es 9 con camino crítico A-C-E", () => {
    const r = cpm(pert01);
    expect(r.status).toBe("ok");
    expect(r.duration).toEqual(fr(9));
    expect(r.criticalPaths).toEqual([["A", "C", "E"]]);
    expect(r.activities.filter((a) => a.critical).map((a) => a.id)).toEqual([
      "A",
      "C",
      "E",
    ]);
  });

  it("calcula ES, EF, LS, LF y las holguras total y libre", () => {
    const r = cpm(pert01);
    const byId = Object.fromEntries(r.activities.map((a) => [a.id, a]));
    expect(byId["A"]).toMatchObject({
      es: fr(0),
      ef: fr(3),
      ls: fr(0),
      lf: fr(3),
      totalSlack: fr(0),
      freeSlack: fr(0),
    });
    expect(byId["B"]).toMatchObject({
      es: fr(0),
      ef: fr(2),
      ls: fr(4),
      lf: fr(6),
      totalSlack: fr(4),
      freeSlack: fr(0),
    });
    expect(byId["C"]).toMatchObject({
      es: fr(3),
      ef: fr(7),
      ls: fr(3),
      lf: fr(7),
      totalSlack: fr(0),
    });
    expect(byId["D"]).toMatchObject({
      es: fr(2),
      ef: fr(3),
      ls: fr(6),
      lf: fr(7),
      totalSlack: fr(4),
      freeSlack: fr(4),
    });
    expect(byId["E"]).toMatchObject({
      es: fr(7),
      ef: fr(9),
      ls: fr(7),
      lf: fr(9),
      totalSlack: fr(0),
    });
  });

  it("detecta ciclos y predecesoras desconocidas", () => {
    const cyclic: ProjectProblem = {
      title: null,
      activities: [
        { id: "A", name: null, predecessors: ["B"], duration: fr(1) },
        { id: "B", name: null, predecessors: ["A"], duration: fr(1) },
      ],
    };
    expect(cpm(cyclic).status).toBe("cycle");
    expect(() =>
      cpm({
        title: null,
        activities: [
          { id: "A", name: null, predecessors: ["Z"], duration: fr(1) },
        ],
      }),
    ).toThrow(/Z/);
  });

  it("el reporte tiene la tabla de tiempos y el camino crítico", () => {
    const text = reportCpm(pert01, cpm(pert01));
    expect(text).toContain("Duración del proyecto: 9");
    expect(text).toContain("A -> C -> E");
    expect(text).toMatch(/B\s+2\s+0\s+2\s+4\s+6\s+4\s+0/);
  });
});
