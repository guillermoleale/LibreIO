// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación LP-01 del apéndice A de SPEC.md: óptimo único.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { INFINITY, finite } from "../../src/rational/Extended";
import { parseLP } from "../../src/parser";
import { graphicalAnalysis, solveLP } from "../../src/lp";
import { reportClassic, reportCombined } from "../../src/report";

const fr = (s: string): Fraction => Fraction.parse(s);

const texto = `MAX 3X + 2Y
SUBJECT TO
  2X + Y <= 100
  X + Y <= 80
  X <= 40
END`;

// Texto de la sección 5.11 de SPEC.md, copiado tal cual.
const CLASSIC_GOLDEN = ` LP OPTIMUM FOUND AT STEP      3

        OBJECTIVE FUNCTION VALUE

        1)      180.0000

  VARIABLE        VALUE          REDUCED COST
         X        20.000000          0.000000
         Y        60.000000          0.000000

       ROW   SLACK OR SURPLUS     DUAL PRICES
        2)         0.000000          1.000000
        3)         0.000000          1.000000
        4)        20.000000          0.000000

 NO. ITERATIONS=       3

 RANGES IN WHICH THE BASIS IS UNCHANGED:

                           OBJ COEFFICIENT RANGES
 VARIABLE         CURRENT        ALLOWABLE        ALLOWABLE
                   COEF          INCREASE         DECREASE
        X        3.000000         1.000000         1.000000
        Y        2.000000         1.000000         0.500000

                           RIGHTHAND SIDE RANGES
      ROW         CURRENT        ALLOWABLE        ALLOWABLE
                    RHS          INCREASE         DECREASE
        2      100.000000        20.000000        20.000000
        3       80.000000        20.000000        20.000000
        4       40.000000         INFINITY        20.000000
`;

const COMBINED_GOLDEN = `LibreIO. Reporte combinado
Objetivo: MAX 3 X + 2 Y
Método: dos fases con regla de Dantzig

Óptimo encontrado en 3 iteraciones
Valor de la función objetivo: Z = 180

Variable  Valor  Coeficiente  Contribución  Costo reducido  Estado  Mín. coef.  Máx. coef.
X            20            3            60               0  básica           2           4
Y            60            2           120               0  básica         3/2           3

Restricción  Lado izq.  Dir.  Lado der.  Holgura/Exceso  Precio sombra  Mín. LD   Máx. LD
2                  100  <=          100               0              1       80       120
3                   80  <=           80               0              1       60       100
4                   20  <=           40              20              0       20  infinito
`;

describe("LP-01. Óptimo único", () => {
  const model = parseLP(texto);
  const result = solveLP(model);

  it("encuentra X = 20, Y = 60, Z = 180 en tres iteraciones", () => {
    expect(result.status).toBe("optimal");
    expect(result.iterations).toBe(3);
    expect(result.solution?.objective).toEqual(fr("180"));
    expect(result.solution?.variables).toEqual([
      { name: "X", value: fr("20") },
      { name: "Y", value: fr("60") },
    ]);
    expect(result.flags).toEqual({ degenerate: false, alternativeOptima: false });
  });

  it("pivotea con Dantzig: entra X y sale SLK 4, entra Y y sale SLK 2, entra SLK 4 y sale SLK 3", () => {
    expect(result.trace).toHaveLength(4);
    const pivots = result.trace
      .filter((step) => step.entering !== null)
      .map((step) => [step.enteringName, step.leavingName]);
    expect(pivots).toEqual([
      ["X", "SLK 4"],
      ["Y", "SLK 2"],
      ["SLK 4", "SLK 3"],
    ]);
    expect(result.trace[3]?.entering).toBeNull();
    expect(result.trace.every((step) => step.phase === "phase2")).toBe(true);
  });

  it("muestra las razones mínimas de cada iteración", () => {
    const first = result.trace[0]!;
    expect(first.ratios).toEqual([fr("50"), fr("80"), fr("40")]);
    expect(first.pivotRow).toBe(2);
    const second = result.trace[1]!;
    expect(second.ratios).toEqual([fr("20"), fr("40"), null]);
    const third = result.trace[2]!;
    expect(third.ratios).toEqual([null, fr("20"), fr("40")]);
  });

  it("el tableau final tiene Z = 180 y las variables básicas Y, SLK 4 y X", () => {
    const last = result.trace[3]!.tableau;
    expect(last.objectiveValue.c).toEqual(fr("180"));
    expect(last.objectiveValue.m.isZero()).toBe(true);
    expect(last.basis.map((col) => last.columns[col]!.name)).toEqual(["Y", "SLK 4", "X"]);
    expect(last.rhs).toEqual([fr("60"), fr("20"), fr("20")]);
    expect(last.objectiveRow.map((v) => v.c)).toEqual([fr("0"), fr("0"), fr("1"), fr("1"), fr("0")]);
  });

  it("informa holguras 0, 0, 20 y precios duales 1, 1, 0", () => {
    const rows = result.sensitivity!.constraints;
    expect(rows.map((r) => r.slack)).toEqual([fr("0"), fr("0"), fr("20")]);
    expect(rows.map((r) => r.lhs)).toEqual([fr("100"), fr("80"), fr("20")]);
    expect(rows.map((r) => r.dualPrice)).toEqual([fr("1"), fr("1"), fr("0")]);
    expect(rows.map((r) => r.shadowPrice)).toEqual([fr("1"), fr("1"), fr("0")]);
  });

  it("costos reducidos 0 y 0 y rangos de coeficientes X en [2, 4], Y en [3/2, 3]", () => {
    const vars = result.sensitivity!.variables;
    expect(vars.map((v) => v.reducedCost)).toEqual([fr("0"), fr("0")]);
    expect(vars.map((v) => v.basic)).toEqual([true, true]);
    expect(vars.map((v) => v.contribution)).toEqual([fr("60"), fr("120")]);
    expect(vars[0]).toMatchObject({
      costMin: finite(fr("2")),
      costMax: finite(fr("4")),
      costIncrease: finite(fr("1")),
      costDecrease: finite(fr("1")),
    });
    expect(vars[1]).toMatchObject({
      costMin: finite(fr("3/2")),
      costMax: finite(fr("3")),
      costIncrease: finite(fr("1")),
      costDecrease: finite(fr("1/2")),
    });
  });

  it("rangos de lado derecho: fila 2 en [80, 120], fila 3 en [60, 100], fila 4 en [20, infinito)", () => {
    const rows = result.sensitivity!.constraints;
    expect(rows[0]).toMatchObject({
      rhsMin: finite(fr("80")),
      rhsMax: finite(fr("120")),
      rhsIncrease: finite(fr("20")),
      rhsDecrease: finite(fr("20")),
    });
    expect(rows[1]).toMatchObject({ rhsMin: finite(fr("60")), rhsMax: finite(fr("100")) });
    expect(rows[2]).toMatchObject({
      rhsMin: finite(fr("20")),
      rhsMax: INFINITY,
      rhsIncrease: INFINITY,
      rhsDecrease: finite(fr("20")),
    });
  });

  it("vértices de la región: (0, 0), (40, 0), (40, 20), (20, 60), (0, 80)", () => {
    const g = graphicalAnalysis(model);
    expect(g.applicable).toBe(true);
    expect(g.status).toBe("optimal");
    expect(g.bounded).toBe(true);
    expect(g.vertices.map((v) => [v.x.toString(), v.y.toString(), v.z.toString()])).toEqual([
      ["0", "0", "0"],
      ["40", "0", "120"],
      ["40", "20", "160"],
      ["20", "60", "180"],
      ["0", "80", "160"],
    ]);
    expect(g.optimum).toEqual({ x: fr("20"), y: fr("60"), z: fr("180") });
    expect(g.optimalSegment).toBeNull();
    expect(g.lines).toHaveLength(3);
  });

  it("el reporte clásico coincide carácter por carácter con el texto de SPEC.md", () => {
    expect(reportClassic(model, result)).toBe(CLASSIC_GOLDEN);
  });

  it("el reporte combinado muestra contribución 60 y 120, estado básica y los rangos como mínimo y máximo", () => {
    expect(reportCombined(model, result)).toBe(COMBINED_GOLDEN);
  });
});
