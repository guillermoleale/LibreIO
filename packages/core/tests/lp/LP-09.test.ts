// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación LP-09: análisis paramétrico del lado derecho de la fila 2 de LP-01 entre 0 y 200.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { parseLP } from "../../src/parser";
import { parametricRhs } from "../../src/lp";
import { reportClassicParametric } from "../../src/report";

const fr = (s: string): Fraction => Fraction.parse(s);

const texto = `MAX 3X + 2Y
SUBJECT TO
  2X + Y <= 100
  X + Y <= 80
  X <= 40
END`;

describe("LP-09. Paramétrico de lado derecho", () => {
  const model = parseLP(texto);
  const p = parametricRhs(model, 0, fr("0"), fr("200"));

  it("devuelve tres tramos lineales de Z", () => {
    expect(p.kind).toBe("rhs");
    expect(p.target).toBe("2");
    expect(p.current).toEqual(fr("100"));
    expect(p.segments).toHaveLength(3);
    const [s1, s2, s3] = p.segments;
    expect(s1).toMatchObject({
      from: fr("0"),
      to: fr("80"),
      slope: fr("2"),
      intercept: fr("0"),
    });
    expect(s2).toMatchObject({
      from: fr("80"),
      to: fr("120"),
      slope: fr("1"),
      intercept: fr("80"),
    });
    expect(s3).toMatchObject({
      from: fr("120"),
      to: fr("200"),
      slope: fr("0"),
      intercept: fr("200"),
    });
    expect(s1?.zFrom).toEqual(fr("0"));
    expect(s1?.zTo).toEqual(fr("160"));
    expect(s3?.zTo).toEqual(fr("200"));
  });

  it("en [0, 80] el óptimo es (0, b) y la base de cada tramo se informa", () => {
    const [s1, s2, s3] = p.segments;
    expect(s1?.solutionTo).toEqual([
      { name: "X", value: fr("0") },
      { name: "Y", value: fr("80") },
    ]);
    expect(s1?.solutionFrom).toEqual([
      { name: "X", value: fr("0") },
      { name: "Y", value: fr("0") },
    ]);
    expect(s2?.solutionFrom).toEqual([
      { name: "X", value: fr("0") },
      { name: "Y", value: fr("80") },
    ]);
    expect(s2?.solutionTo).toEqual([
      { name: "X", value: fr("40") },
      { name: "Y", value: fr("40") },
    ]);
    expect(s3?.solutionFrom).toEqual([
      { name: "X", value: fr("40") },
      { name: "Y", value: fr("40") },
    ]);
    expect(s1?.basis).toEqual(["Y", "SLK 4", "SLK 3"]);
    expect(s2?.basis).toEqual(["Y", "SLK 4", "X"]);
    expect(s3?.basis).toEqual(["Y", "SLK 2", "X"]);
  });

  it("los quiebres están en 80 y 120 con Z = 160 y Z = 200 y dicen qué variable entra y sale", () => {
    expect(p.breakpoints).toHaveLength(2);
    const [b1, b2] = p.breakpoints;
    expect(b1).toMatchObject({
      value: fr("80"),
      z: fr("160"),
      leaving: "X",
      entering: "SLK 3",
      rateBefore: fr("1"),
    });
    expect(b2).toMatchObject({
      value: fr("120"),
      z: fr("200"),
      leaving: "SLK 4",
      entering: "SLK 2",
      rateBefore: fr("1"),
    });
    expect(typeof b1?.pivotRow).toBe("number");
  });

  it("el formato clásico lista los quiebres con variable que sale, que entra, fila, valor, precio dual y Z", () => {
    const text = reportClassicParametric(model, p);
    expect(text).toContain("RIGHTHANDSIDE PARAMETRICS REPORT FOR ROW");
    expect(text).toMatch(/VAR\s+VAR\s+PIVOT\s+RHS\s+DUAL PRICE\s+OBJ/);
    expect(text).toMatch(
      /SLK 4\s+SLK 2\s+\d+\s+120\.000000\s+1\.000000\s+200\.000000/,
    );
    expect(text).toMatch(
      /X\s+SLK 3\s+\d+\s+80\.000000\s+1\.000000\s+160\.000000/,
    );
  });

  it("informa infactibilidad fuera del rango factible del lado derecho", () => {
    const q = parametricRhs(model, 0, fr("-50"), fr("50"));
    expect(q.infeasibleBelow).toEqual(fr("0"));
    expect(q.segments[0]?.from).toEqual(fr("0"));
  });
});
