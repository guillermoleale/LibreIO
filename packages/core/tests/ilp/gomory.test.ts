// SPDX-License-Identifier: GPL-3.0-or-later
// Cortes de Gomory (fase 6): planos de corte fraccionarios sobre el simplex del núcleo.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { parseLP } from "../../src/parser";
import { branchAndBound, gomoryCuts, type GomoryCut } from "../../src/ilp";
import { reportGomory } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

const ilp01 = `MAX 5X + 4Y
SUBJECT TO
  6X + 4Y <= 24
  X + 2Y <= 6
END
GIN X
GIN Y`;

function satisfied(cut: GomoryCut, point: Fraction[]): boolean {
  const lhs = Fraction.sum(cut.coefficients.map((c, i) => c.mul(point[i]!)));
  return cut.relation === "<=" ? lhs.le(cut.rhs) : lhs.ge(cut.rhs);
}

describe("Cortes de Gomory", () => {
  const model = parseLP(ilp01);
  const r = gomoryCuts(model);

  it("ILP-01 termina en X = 4, Y = 0, Z = 20 con al menos un corte", () => {
    expect(r.status).toBe("optimal");
    expect(r.solution?.objective).toEqual(fr(20));
    expect(r.solution?.variables).toEqual([
      { name: "X", value: fr(4) },
      { name: "Y", value: fr(0) },
    ]);
    expect(r.cuts.length).toBeGreaterThanOrEqual(1);
    expect(r.iterations.length).toBe(r.cuts.length + 1);
    expect(r.iterations[r.iterations.length - 1]?.integer).toBe(true);
    expect(r.relaxation.solution?.objective).toEqual(fr(21));
  });

  it("todos los cortes se cumplen en la solución entera óptima", () => {
    const optimum = [fr(4), fr(0)];
    for (const cut of r.cuts) {
      expect(satisfied(cut, optimum), `corte ${cut.index}`).toBe(true);
    }
  });

  it("el primer corte sale de la fila de Y (parte fraccionaria 1/2) y la relajación lo viola", () => {
    const first = r.cuts[0]!;
    expect(first.index).toBe(1);
    expect(first.sourceVariable).toBe("Y");
    // tableauRow guarda las partes fraccionarias: f0 = frac(3/2) = 1/2
    expect(first.tableauRow.rhs).toEqual(fr("1/2"));
    expect(first.tableauRow.names.length).toBe(
      first.tableauRow.coefficients.length,
    );
    // En el espacio original el corte es 6X + 5Y <= 25
    expect(first.coefficients).toEqual([fr(6), fr(5)]);
    expect(first.relation).toBe("<=");
    expect(first.rhs).toEqual(fr(25));
    expect(satisfied(first, [fr(3), fr("3/2")])).toBe(false);
    expect(r.iterations[0]?.cut).toBe(first);
    expect(r.iterations[0]?.integer).toBe(false);
    expect(r.iterations[0]?.solution).toEqual([
      { name: "X", value: fr(3) },
      { name: "Y", value: fr("3/2") },
    ]);
  });

  it("un modelo cuya relajación ya es entera no genera cortes", () => {
    const integer = gomoryCuts(
      parseLP(
        "MAX 3X + 2Y\nST\n2X + Y <= 100\nX + Y <= 80\nX <= 40\nEND\nGIN X\nGIN Y",
      ),
    );
    expect(integer.status).toBe("optimal");
    expect(integer.cuts).toEqual([]);
    expect(integer.iterations).toHaveLength(1);
    expect(integer.solution?.objective).toEqual(fr(180));
  });

  it("MAX X con 2X = 3 y X entera es infactible", () => {
    const infeasible = gomoryCuts(parseLP("MAX X\nST\n2X = 3\nEND\nGIN X"));
    expect(infeasible.status).toBe("infeasible");
    expect(infeasible.solution).toBeNull();
    expect(infeasible.messages.join(" ")).toMatch(/infactible/i);
  });

  it("coincide con ramificación y acotamiento en modelos chicos", () => {
    const modelos = [
      "MAX 3X + 2Y\nST\n2X + Y <= 9\nX + 3Y <= 10\nEND\nGIN X\nGIN Y",
      "MAX 2X + 3Y\nST\n3X + 4Y <= 24\n2X + Y <= 9\nEND\nGIN X\nGIN Y",
      "MIN 3X + 5Y\nST\n2X + 3Y >= 7\nX + 4Y >= 6\nEND\nGIN X\nGIN Y",
      "MAX 3X + 2Y + 4Z\nST\n2X + 3Y + 5Z <= 7\nEND\nINT X\nINT Y\nINT Z",
    ];
    for (const texto of modelos) {
      const m = parseLP(texto);
      const g = gomoryCuts(m);
      const b = branchAndBound(m);
      expect(g.status, texto).toBe("optimal");
      expect(g.solution?.objective, texto).toEqual(b.solution?.objective);
      for (const cut of g.cuts) {
        expect(
          satisfied(
            cut,
            b.solution!.variables.map((v) => v.value),
          ),
          `${texto} corte ${cut.index}`,
        ).toBe(true);
      }
    }
  });

  it("respeta el límite de cortes y lo informa", () => {
    const limited = gomoryCuts(model, { maxCuts: 0 });
    expect(limited.status).toBe("limit");
    expect(limited.cuts).toEqual([]);
    expect(limited.messages.join(" ")).toMatch(/límite/i);
  });

  it("el reporte lista los cortes y la solución", () => {
    const text = reportGomory(model, r);
    expect(text).toContain("Corte 1");
    expect(text).toContain("6 X + 5 Y <= 25");
    expect(text).toContain("Z = 20");
    expect(
      reportGomory(model, gomoryCuts(parseLP("MAX X\nST\n2X = 3\nEND\nGIN X"))),
    ).toMatch(/infactible/i);
  });
});
