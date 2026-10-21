// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación LP-10: análisis paramétrico del coeficiente de X en LP-01 entre 0 y 6.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { parseLP } from "../../src/parser";
import { parametricCost } from "../../src/lp";
import { reportClassicParametric } from "../../src/report";

const fr = (s: string): Fraction => Fraction.parse(s);

const texto = `MAX 3X + 2Y
SUBJECT TO
  2X + Y <= 100
  X + Y <= 80
  X <= 40
END`;

describe("LP-10. Paramétrico de coeficiente", () => {
  const model = parseLP(texto);
  const p = parametricCost(model, 0, fr("0"), fr("6"));

  it("devuelve tres tramos: Z = 160, Z = 20c + 120 y Z = 40c + 40", () => {
    expect(p.kind).toBe("cost");
    expect(p.target).toBe("X");
    expect(p.current).toEqual(fr("3"));
    expect(p.segments).toHaveLength(3);
    const [s1, s2, s3] = p.segments;
    expect(s1).toMatchObject({
      from: fr("0"),
      to: fr("2"),
      slope: fr("0"),
      intercept: fr("160"),
    });
    expect(s2).toMatchObject({
      from: fr("2"),
      to: fr("4"),
      slope: fr("20"),
      intercept: fr("120"),
    });
    expect(s3).toMatchObject({
      from: fr("4"),
      to: fr("6"),
      slope: fr("40"),
      intercept: fr("40"),
    });
  });

  it("la solución de cada tramo es (0, 80), (20, 60) y (40, 20)", () => {
    const [s1, s2, s3] = p.segments;
    expect(s1?.solutionFrom).toEqual([
      { name: "X", value: fr("0") },
      { name: "Y", value: fr("80") },
    ]);
    expect(s2?.solutionFrom).toEqual([
      { name: "X", value: fr("20") },
      { name: "Y", value: fr("60") },
    ]);
    expect(s3?.solutionFrom).toEqual([
      { name: "X", value: fr("40") },
      { name: "Y", value: fr("20") },
    ]);
    expect(s3?.solutionTo).toEqual(s3?.solutionFrom);
  });

  it("los quiebres están en 2 y 4", () => {
    expect(p.breakpoints).toHaveLength(2);
    const [b1, b2] = p.breakpoints;
    expect(b1).toMatchObject({
      value: fr("2"),
      z: fr("160"),
      leaving: "X",
      entering: "SLK 2",
    });
    expect(b2).toMatchObject({
      value: fr("4"),
      z: fr("200"),
      leaving: "SLK 4",
      entering: "SLK 3",
    });
    expect(b1?.rateBefore).toEqual(fr("20"));
    expect(b2?.rateBefore).toEqual(fr("20"));
  });

  it("el formato clásico tiene el encabezado de coeficiente de la función objetivo", () => {
    const text = reportClassicParametric(model, p);
    expect(text).toContain(
      "OBJECTIVE COEFFICIENT PARAMETRICS REPORT FOR VARIABLE X",
    );
    expect(text).toMatch(
      /SLK 4\s+SLK 3\s+\d+\s+4\.000000\s+20\.000000\s+200\.000000/,
    );
  });

  it("una variable no básica solo cambia de base cuando su coeficiente alcanza el costo reducido", () => {
    const min = parseLP("MIN 2X + 3Y\nST\nX + Y >= 4\nX + 3Y >= 6\nEND");
    const q = parametricCost(min, 1, fr("0"), fr("10"));
    // Y es básica con costo 3: la base no cambia entre 2 y 6
    const middle = q.segments.find(
      (s) => s.from.le(fr("3")) && s.to.ge(fr("3")),
    );
    expect(middle).toMatchObject({ from: fr("2"), to: fr("6") });
    expect(q.breakpoints.map((b) => b.value)).toEqual([fr("2"), fr("6")]);
  });
});
