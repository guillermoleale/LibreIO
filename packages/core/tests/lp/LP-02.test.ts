// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación LP-02: minimización con restricciones de mayor o igual.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { parseLP } from "../../src/parser";
import { solveLP, toStandardForm } from "../../src/lp";
import { reportClassic } from "../../src/report";

const fr = (s: string): Fraction => Fraction.parse(s);

const texto = `MIN 2X + 3Y
SUBJECT TO
  X + Y >= 4
  X + 3Y >= 6
END`;

describe("LP-02. Minimización con mayor o igual", () => {
  const model = parseLP(texto);

  for (const method of ["twoPhase", "bigM"] as const) {
    it(`${method}: X = 3, Y = 1, Z = 9 con precios sombra 3/2 y 1/2`, () => {
      const r = solveLP(model, { method });
      expect(r.status).toBe("optimal");
      expect(r.method).toBe(method);
      expect(r.solution?.variables).toEqual([
        { name: "X", value: fr("3") },
        { name: "Y", value: fr("1") },
      ]);
      expect(r.solution?.objective).toEqual(fr("9"));
      expect(r.sensitivity?.constraints.map((c) => c.shadowPrice)).toEqual([
        fr("3/2"),
        fr("1/2"),
      ]);
      expect(r.sensitivity?.constraints.map((c) => c.dualPrice)).toEqual([
        fr("-3/2"),
        fr("-1/2"),
      ]);
      expect(r.sensitivity?.constraints.map((c) => c.slack)).toEqual([
        fr("0"),
        fr("0"),
      ]);
      expect(r.sensitivity?.variables.map((v) => v.reducedCost)).toEqual([
        fr("0"),
        fr("0"),
      ]);
    });
  }

  it("la forma estándar agrega exceso y artificial por fila con nombres SLK n y ART n", () => {
    const sf = toStandardForm(model);
    expect(sf.columns.map((c) => c.name)).toEqual([
      "X",
      "Y",
      "SLK 2",
      "SLK 3",
      "ART 2",
      "ART 3",
    ]);
    expect(sf.columns.map((c) => c.kind)).toEqual([
      "decision",
      "decision",
      "surplus",
      "surplus",
      "artificial",
      "artificial",
    ]);
    expect(sf.rows.map((r) => r.relation)).toEqual([">=", ">="]);
    expect(sf.b).toEqual([fr("4"), fr("6")]);
    // Internamente se maximiza -Z
    expect(sf.c.slice(0, 2)).toEqual([fr("-2"), fr("-3")]);
  });

  it("dos fases: la traza pasa por la fase 1 y después por la fase 2", () => {
    const r = solveLP(model, { method: "twoPhase" });
    const phases = r.trace.map((s) => s.phase);
    expect(phases[0]).toBe("phase1");
    expect(phases[phases.length - 1]).toBe("phase2");
    expect(phases.indexOf("phase2")).toBeGreaterThan(0);
    expect(r.iterations).toBe(
      r.trace.filter((s) => s.entering !== null).length,
    );
  });

  it("Big M: la fila objetivo inicial tiene coeficientes con M simbólica", () => {
    const r = solveLP(model, { method: "bigM" });
    const first = r.trace[0]!.tableau;
    expect(r.trace.every((s) => s.phase === "bigM")).toBe(true);
    expect(first.objectiveRow.some((v) => !v.m.isZero())).toBe(true);
    expect(first.objectiveValue.m).toEqual(fr("-10"));
    const last = r.trace[r.trace.length - 1]!.tableau;
    expect(last.objectiveValue.m.isZero()).toBe(true);
    expect(last.objectiveValue.c).toEqual(fr("-9"));
  });

  it("el reporte clásico muestra Z = 9 y precios duales -1.5 y -0.5", () => {
    const r = solveLP(model);
    const text = reportClassic(model, r);
    expect(text).toContain("        1)      9.000000");
    expect(text).toContain("         X         3.000000          0.000000");
    expect(text).toContain("         Y         1.000000          0.000000");
    expect(text).toContain("        2)         0.000000         -1.500000");
    expect(text).toContain("        3)         0.000000         -0.500000");
  });

  it("formula el dual MAX 4Y1 + 6Y2 con Y1 + Y2 <= 2, Y1 + 3Y2 <= 3 y lo resuelve con Y1 = 3/2, Y2 = 1/2, W = 9", () => {
    const r = solveLP(model);
    const dual = r.dual!;
    expect(dual.model.sense).toBe("max");
    expect(dual.model.variables.map((v) => v.name)).toEqual(["Y1", "Y2"]);
    expect(dual.model.objective).toEqual([fr("4"), fr("6")]);
    expect(
      dual.model.constraints.map((c) => ({
        coefficients: c.coefficients,
        relation: c.relation,
        rhs: c.rhs,
      })),
    ).toEqual([
      { coefficients: [fr("1"), fr("1")], relation: "<=", rhs: fr("2") },
      { coefficients: [fr("1"), fr("3")], relation: "<=", rhs: fr("3") },
    ]);
    expect(dual.values).toEqual([
      { name: "Y1", value: fr("3/2") },
      { name: "Y2", value: fr("1/2") },
    ]);
    expect(dual.objective).toEqual(fr("9"));
    const solvedDual = solveLP(dual.model);
    expect(solvedDual.status).toBe("optimal");
    expect(solvedDual.solution?.objective).toEqual(fr("9"));
  });

  it("rangos de coeficientes de una minimización: para básicas se calculan en el sentido original", () => {
    const r = solveLP(model);
    const [x, y] = r.sensitivity!.variables;
    // X básica con costo 2: la base no cambia mientras 1 <= cX <= 3
    expect(x?.costMin).toEqual({ finite: true, value: fr("1") });
    expect(x?.costMax).toEqual({ finite: true, value: fr("3") });
    // Y básica con costo 3: la base no cambia mientras 2 <= cY <= 6
    expect(y?.costMin).toEqual({ finite: true, value: fr("2") });
    expect(y?.costMax).toEqual({ finite: true, value: fr("6") });
  });
});
