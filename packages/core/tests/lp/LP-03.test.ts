// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación LP-03: problema ilimitado.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { parseLP } from "../../src/parser";
import { graphicalAnalysis, solveLP } from "../../src/lp";
import { reportClassic, reportCombined } from "../../src/report";

const fr = (s: string): Fraction => Fraction.parse(s);

const texto = `MAX X + Y
SUBJECT TO
  X - Y <= 2
  -X + Y <= 2
END`;

describe("LP-03. Ilimitado", () => {
  const model = parseLP(texto);
  const result = solveLP(model);

  it("detecta el estado ilimitado después de que entra X", () => {
    expect(result.status).toBe("unbounded");
    expect(result.solution).toBeNull();
    expect(result.sensitivity).toBeNull();
    expect(result.trace[0]).toMatchObject({ enteringName: "X", leavingName: "SLK 2" });
    expect(result.trace).toHaveLength(2);
    const last = result.trace[1]!;
    expect(last.enteringName).toBe("Y");
    expect(last.leaving).toBeNull();
    expect(last.ratios?.every((r) => r === null)).toBe(true);
  });

  it("el mensaje indica la variable que entra sin razón mínima", () => {
    expect(result.unboundedVariable).toBe("Y");
    const message = result.messages.join("\n");
    expect(message).toMatch(/ilimitad/i);
    expect(message).toContain("Y");
    expect(message).toMatch(/razón/i);
  });

  it("formato clásico: UNBOUNDED SOLUTION", () => {
    expect(reportClassic(model, result)).toContain("UNBOUNDED SOLUTION");
    expect(reportCombined(model, result)).toMatch(/ilimitad/i);
  });

  it("en el gráfico la región es abierta con flecha en la dirección (1, 1)", () => {
    const g = graphicalAnalysis(model);
    expect(g.applicable).toBe(true);
    expect(g.status).toBe("unbounded");
    expect(g.bounded).toBe(false);
    expect(g.unboundedDirection).toEqual([fr("1"), fr("1")]);
    expect(g.improvementDirection).toEqual([fr("1"), fr("1")]);
    expect(g.optimum).toBeNull();
    expect(g.vertices.map((v) => [v.x.toString(), v.y.toString()])).toEqual([
      ["0", "0"],
      ["2", "0"],
      ["0", "2"],
    ]);
    // El polígono recortado para dibujar tiene más puntos que los vértices reales
    expect(g.regionPolygon.length).toBeGreaterThan(g.vertices.length);
  });
});
