// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { parseLP } from "../../src/parser";
import { solveLP, toStandardForm } from "../../src/lp";

const fr = (s: string): Fraction => Fraction.parse(s);

describe("Forma estándar", () => {
  it("usa holgura para <=, exceso y artificial para >= y solo artificial para =", () => {
    const model = parseLP("MAX X + Y\nST\nX + Y <= 4\nX - Y >= 1\nX + 2Y = 3\nEND");
    const sf = toStandardForm(model);
    expect(sf.columns.map((c) => c.name)).toEqual(["X", "Y", "SLK 2", "SLK 3", "ART 3", "ART 4"]);
    expect(sf.columns.map((c) => c.kind)).toEqual([
      "decision",
      "decision",
      "slack",
      "surplus",
      "artificial",
      "artificial",
    ]);
    expect(sf.rows[0]).toMatchObject({ relation: "<=", slackColumn: 2, artificialColumn: null });
    expect(sf.rows[1]).toMatchObject({ relation: ">=", slackColumn: 3, artificialColumn: 4 });
    expect(sf.rows[2]).toMatchObject({ relation: "=", slackColumn: null, artificialColumn: 5 });
    expect(sf.initialBasis.map((c) => sf.columns[c]!.name)).toEqual(["SLK 2", "ART 3", "ART 4"]);
    expect(sf.A[1]).toEqual([fr("1"), fr("-1"), fr("0"), fr("-1"), fr("1"), fr("0")]);
  });

  it("multiplica por -1 las filas con lado derecho negativo", () => {
    const model = parseLP("MAX X\nST\nX - Y <= -2\nX + Y <= 10\nEND");
    const sf = toStandardForm(model);
    expect(sf.rows[0]?.relation).toBe(">=");
    expect(sf.b[0]).toEqual(fr("2"));
    expect(sf.A[0]?.slice(0, 2)).toEqual([fr("-1"), fr("1")]);
    const r = solveLP(model);
    expect(r.status).toBe("optimal");
    expect(r.solution?.variables).toEqual([
      { name: "X", value: fr("4") },
      { name: "Y", value: fr("6") },
    ]);
  });

  it("las cotas superiores se agregan como filas y la solución las respeta", () => {
    const model = parseLP("MAX X + Y\nST\nX + Y <= 10\nEND\nSUB X 3\nSUB Y 4");
    const r = solveLP(model);
    expect(r.status).toBe("optimal");
    expect(r.solution?.objective).toEqual(fr("7"));
    expect(r.solution?.variables).toEqual([
      { name: "X", value: fr("3") },
      { name: "Y", value: fr("4") },
    ]);
    expect(r.standardForm.rows.map((row) => row.label)).toEqual([null, "SUB X", "SUB Y"]);
  });

  it("las cotas inferiores positivas se agregan como filas", () => {
    const model = parseLP("MIN X + Y\nST\nX + Y >= 1\nEND\nSLB X 2");
    const r = solveLP(model);
    expect(r.status).toBe("optimal");
    expect(r.solution?.variables).toEqual([
      { name: "X", value: fr("2") },
      { name: "Y", value: fr("0") },
    ]);
  });

  it("una variable libre se desdobla en dos columnas y se recompone en la solución", () => {
    const model = parseLP("MIN X\nST\nX >= -5\nEND\nFREE X");
    const sf = toStandardForm(model);
    expect(sf.columns.filter((c) => c.kind === "decision").map((c) => c.name)).toEqual(["X+", "X-"]);
    const r = solveLP(model);
    expect(r.status).toBe("optimal");
    expect(r.solution?.variables).toEqual([{ name: "X", value: fr("-5") }]);
    expect(r.solution?.objective).toEqual(fr("-5"));
  });

  it("una restricción redundante no rompe la fase 1 ni los rangos", () => {
    const model = parseLP("MAX X + Y\nST\nX + Y = 4\n2X + 2Y = 8\nX <= 3\nEND");
    const r = solveLP(model);
    expect(r.status).toBe("optimal");
    expect(r.solution?.objective).toEqual(fr("4"));
    expect(r.sensitivity).not.toBeNull();
  });

  it("las variables enteras se resuelven como relajación continua y se avisa", () => {
    const model = parseLP("MAX 3X + 2Y\nST\n2X + Y <= 100\nX + Y <= 80\nX <= 40\nEND\nGIN X");
    const r = solveLP(model);
    expect(r.status).toBe("optimal");
    expect(r.solution?.objective).toEqual(fr("180"));
    expect(r.messages.join("\n")).toMatch(/relajaci/i);
  });
});
