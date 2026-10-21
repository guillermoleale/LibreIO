// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { parseLP } from "../../src/parser";
import { solveLP } from "../../src/lp";
import { reportCombined, reportModel } from "../../src/report";

describe("Reporte combinado", () => {
  const model = parseLP(
    "TITLE Prueba\nMIN 2X + 3Y\nST\nuno) X + Y >= 4\ndos) X + 3Y >= 6\nEND",
  );
  const result = solveLP(model);

  it("muestra el título, las etiquetas de las filas y la dirección >=", () => {
    const text = reportCombined(model, result);
    expect(text).toContain("Problema: Prueba");
    expect(text).toContain("Objetivo: MIN 2 X + 3 Y");
    expect(text).toMatch(/^uno\s+4\s+>=\s+4\s+0\s+3\/2/m);
    expect(text).toMatch(/^dos\s+6\s+>=\s+6\s+0\s+1\/2/m);
    expect(text).toContain("Valor de la función objetivo: Z = 9");
  });

  it("acepta vista decimal", () => {
    const text = reportCombined(model, result, {
      numberFormat: "decimal",
      decimals: 3,
    });
    expect(text).toContain("Z = 9.000");
    expect(text).toMatch(/^uno\s+4\.000\s+>=\s+4\.000\s+0\.000\s+1\.500/m);
  });

  it("el reporte del modelo incluye la forma estándar y el dual", () => {
    const text = reportModel(model, result);
    expect(text).toContain("Forma estándar");
    expect(text).toContain("SLK 2");
    expect(text).toContain("ART 2");
    expect(text).toContain("Dual");
    expect(text).toContain("MAX 4 Y1 + 6 Y2");
    expect(text).toContain("Y1 + Y2 <= 2");
  });
});
