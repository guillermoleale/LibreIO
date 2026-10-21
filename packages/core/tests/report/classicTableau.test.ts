// SPDX-License-Identifier: GPL-3.0-or-later
// Test golden del tableau en formato clásico (LINDO TABL) para el tableau inicial de LP-01.
import { describe, expect, it } from "vitest";
import { parseLP } from "../../src/parser";
import { initialTableau, solveLP, toStandardForm } from "../../src/lp";
import { reportClassicTableau } from "../../src/report";

const texto = `MAX 3X + 2Y
SUBJECT TO
  2X + Y <= 100
  X + Y <= 80
  X <= 40
END`;

const GOLDEN = ` THE TABLEAU

       ROW  (BASIS)        X        Y    SLK 2    SLK 3    SLK 4      RHS
         1      ART   -3.000   -2.000    0.000    0.000    0.000    0.000
         2    SLK 2    2.000    1.000    1.000    0.000    0.000  100.000
         3    SLK 3    1.000    1.000    0.000    1.000    0.000   80.000
         4    SLK 4    1.000    0.000    0.000    0.000    1.000   40.000
`;

describe("Tableau en formato clásico", () => {
  const model = parseLP(texto);

  it("el tableau inicial de LP-01 coincide con el golden", () => {
    const t0 = initialTableau(toStandardForm(model), "twoPhase");
    expect(reportClassicTableau(t0)).toBe(GOLDEN);
  });

  it("el tableau final de LP-01 muestra la base óptima y Z = 180", () => {
    const final = solveLP(model).trace.at(-1)!.tableau;
    const text = reportClassicTableau(final);
    expect(text).toContain(
      "         1      ART    0.000    0.000    1.000    1.000    0.000  180.000",
    );
    expect(text).toContain("         2        Y");
    expect(text).toContain("         4        X");
  });

  it("con Big M los coeficientes con M se imprimen en forma simbólica", () => {
    const min = parseLP("MIN 2X + 3Y\nST\nX + Y >= 4\nX + 3Y >= 6\nEND");
    const t0 = initialTableau(toStandardForm(min), "bigM");
    const text = reportClassicTableau(t0);
    expect(text).toContain("ART 2");
    expect(text).toMatch(/M/);
    expect(text).toContain("-10.000M");
  });
});
