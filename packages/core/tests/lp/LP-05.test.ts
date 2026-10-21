// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación LP-05: óptimos alternativos.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { parseLP } from "../../src/parser";
import { graphicalAnalysis, solveLP } from "../../src/lp";
import { reportClassic, reportCombined } from "../../src/report";

const fr = (s: string): Fraction => Fraction.parse(s);

const texto = `MAX 2X + 2Y
SUBJECT TO
  X + Y <= 4
  X <= 3
  Y <= 3
END`;

describe("LP-05. Óptimos alternativos", () => {
  const model = parseLP(texto);
  const result = solveLP(model);

  it("Dantzig llega a Z = 8 en (3, 1)", () => {
    expect(result.status).toBe("optimal");
    expect(result.solution?.objective).toEqual(fr("8"));
    expect(result.solution?.variables).toEqual([
      { name: "X", value: fr("3") },
      { name: "Y", value: fr("1") },
    ]);
    expect(result.trace[0]).toMatchObject({ enteringName: "X", leavingName: "SLK 3" });
  });

  it("hay una variable no básica con costo reducido 0 y se avisa que existen soluciones alternativas", () => {
    const last = result.trace[result.trace.length - 1]!.tableau;
    const nonBasicZero = last.columns
      .map((col, j) => ({ col, j }))
      .filter(({ j }) => !last.basis.includes(j) && last.objectiveRow[j]!.c.isZero() && last.objectiveRow[j]!.m.isZero());
    expect(nonBasicZero.map(({ col }) => col.name)).toEqual(["SLK 3"]);
    expect(result.flags.alternativeOptima).toBe(true);
    expect(result.messages.join("\n")).toMatch(/alternativ/i);
    expect(reportCombined(model, result)).toContain("Existen soluciones alternativas");
    expect(reportClassic(model, result)).toContain("        1)      8.000000");
  });

  it("el gráfico resalta el segmento entre (1, 3) y (3, 1)", () => {
    const g = graphicalAnalysis(model);
    expect(g.status).toBe("optimal");
    expect(g.optimum).toEqual({ x: fr("3"), y: fr("1"), z: fr("8") });
    expect(g.optimalSegment).toEqual([
      { x: fr("1"), y: fr("3"), z: fr("8") },
      { x: fr("3"), y: fr("1"), z: fr("8") },
    ]);
    expect(g.vertices.map((v) => [v.x.toString(), v.y.toString()])).toEqual([
      ["0", "0"],
      ["3", "0"],
      ["3", "1"],
      ["1", "3"],
      ["0", "3"],
    ]);
  });
});
