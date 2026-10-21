// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { parseLP } from "../../src/parser";
import { graphicalAnalysis } from "../../src/lp";

const fr = (s: string): Fraction => Fraction.parse(s);

describe("Grilla de puntos enteros del método gráfico", () => {
  it("lista los puntos enteros de la región de ILP-01", () => {
    const model = parseLP(
      "MAX 5X + 4Y\nST\n6X + 4Y <= 24\nX + 2Y <= 6\nEND\nGIN X\nGIN Y",
    );
    const g = graphicalAnalysis(model);
    expect(g.integerPoints).toHaveLength(13);
    expect(
      g.integerPoints.some((p) => p.x.eq(fr("4")) && p.y.eq(fr("0"))),
    ).toBe(true);
    expect(
      g.integerPoints.some((p) => p.x.eq(fr("0")) && p.y.eq(fr("3"))),
    ).toBe(true);
    expect(
      g.integerPoints.some((p) => p.x.eq(fr("3")) && p.y.eq(fr("2"))),
    ).toBe(false);
  });

  it("no calcula la grilla si el modelo es continuo", () => {
    const model = parseLP(
      "MAX 3X + 2Y\nST\n2X + Y <= 100\nX + Y <= 80\nX <= 40\nEND",
    );
    expect(graphicalAnalysis(model).integerPoints).toEqual([]);
  });
});
