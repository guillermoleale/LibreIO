// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación LP-06: degeneración.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { parseLP } from "../../src/parser";
import { solveLP } from "../../src/lp";
import { reportCombined } from "../../src/report";

const fr = (s: string): Fraction => Fraction.parse(s);

const texto = `MAX 3X + 2Y
SUBJECT TO
  X + Y <= 4
  X + 3Y <= 6
  X <= 4
END`;

describe("LP-06. Degeneración", () => {
  const model = parseLP(texto);
  const result = solveLP(model);

  it("hay empate de razones mínimas en la primera iteración", () => {
    const first = result.trace[0]!;
    expect(first.enteringName).toBe("X");
    expect(first.ratios).toEqual([fr("4"), fr("6"), fr("4")]);
    expect(first.tiedRows).toEqual([0, 2]);
    // Ante empate sale la fila de menor índice
    expect(first.pivotRow).toBe(0);
    expect(first.leavingName).toBe("SLK 2");
    expect(first.note).toMatch(/empate/i);
  });

  it("óptimo X = 4, Y = 0, Z = 12 con una variable básica en cero", () => {
    expect(result.status).toBe("optimal");
    expect(result.solution?.objective).toEqual(fr("12"));
    expect(result.solution?.variables).toEqual([
      { name: "X", value: fr("4") },
      { name: "Y", value: fr("0") },
    ]);
    const last = result.trace[result.trace.length - 1]!.tableau;
    const zeroBasics = last.basis
      .filter((_, i) => last.rhs[i]!.isZero())
      .map((col) => last.columns[col]!.name);
    expect(zeroBasics).toEqual(["SLK 4"]);
    expect(result.flags.degenerate).toBe(true);
  });

  it("el reporte avisa que la solución es degenerada", () => {
    expect(result.messages.join("\n")).toMatch(/degenerad/i);
    expect(reportCombined(model, result)).toMatch(/degenerada/i);
  });
});
