// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación LP-04: problema infactible.
import { describe, expect, it } from "vitest";
import { parseLP } from "../../src/parser";
import { graphicalAnalysis, solveLP } from "../../src/lp";
import { reportClassic, reportCombined } from "../../src/report";

const texto = `MAX X + Y
SUBJECT TO
  X + Y <= 2
  X + Y >= 4
END`;

describe("LP-04. Infactible", () => {
  const model = parseLP(texto);

  it("dos fases: la fase 1 termina con una artificial positiva", () => {
    const r = solveLP(model, { method: "twoPhase" });
    expect(r.status).toBe("infeasible");
    expect(r.solution).toBeNull();
    expect(r.trace.every((s) => s.phase === "phase1")).toBe(true);
    expect(r.infeasibility).not.toBeNull();
    expect(r.infeasibility!.length).toBeGreaterThan(0);
    expect(r.infeasibility![0]!.artificial).toBe("ART 3");
    expect(r.infeasibility![0]!.value.isPositive()).toBe(true);
    const last = r.trace[r.trace.length - 1]!.tableau;
    // La suma de infactibilidades al final de la fase 1 es 2
    expect(last.objectiveValue.c.toString()).toBe("-2");
    expect(r.messages.join("\n")).toMatch(/infactible/i);
  });

  it("Big M: el valor óptimo conserva un término en M", () => {
    const r = solveLP(model, { method: "bigM" });
    expect(r.status).toBe("infeasible");
    const last = r.trace[r.trace.length - 1]!.tableau;
    expect(last.objectiveValue.m.isZero()).toBe(false);
    expect(r.infeasibility![0]!.artificial).toBe("ART 3");
  });

  it("formato clásico: NO FEASIBLE SOLUTION", () => {
    const r = solveLP(model);
    expect(reportClassic(model, r)).toContain("NO FEASIBLE SOLUTION");
    expect(reportCombined(model, r)).toMatch(/infactible/i);
  });

  it("en el gráfico la región es vacía", () => {
    const g = graphicalAnalysis(model);
    expect(g.applicable).toBe(true);
    expect(g.status).toBe("infeasible");
    expect(g.vertices).toEqual([]);
    expect(g.regionPolygon).toEqual([]);
    expect(g.optimum).toBeNull();
  });
});
