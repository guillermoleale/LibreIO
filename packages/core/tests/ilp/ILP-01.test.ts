// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación ILP-01: ramificación y acotamiento.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { parseLP } from "../../src/parser";
import { branchAndBound } from "../../src/ilp";
import { reportClassicInteger, reportCombinedInteger } from "../../src/report";

const fr = (s: string): Fraction => Fraction.parse(s);

const texto = `MAX 5X + 4Y
SUBJECT TO
  6X + 4Y <= 24
  X + 2Y <= 6
END
GIN X
GIN Y`;

describe("ILP-01. Branch and bound", () => {
  const model = parseLP(texto);
  const r = branchAndBound(model);

  it("la relajación da X = 3, Y = 3/2, Z = 21 y ramifica en Y", () => {
    const root = r.nodes[0]!;
    expect(root.status).toBe("optimal");
    expect(root.bound).toEqual(fr("21"));
    expect(root.solution).toEqual([
      { name: "X", value: fr("3") },
      { name: "Y", value: fr("3/2") },
    ]);
    expect(root.integer).toBe(false);
    expect(root.branchedOn).toBe("Y");
    expect(root.children).toHaveLength(2);
  });

  it("el nodo Y <= 1 da Z = 62/3 y el nodo Y >= 2 da (2, 2) con Z = 18 entero", () => {
    const [left, right] = r.nodes[0]!.children.map((id) => r.nodes[id]!);
    expect(left?.branch).toEqual({
      variable: "Y",
      direction: "<=",
      value: fr("1"),
    });
    expect(left?.bound).toEqual(fr("62/3"));
    expect(left?.integer).toBe(false);
    expect(right?.branch).toEqual({
      variable: "Y",
      direction: ">=",
      value: fr("2"),
    });
    expect(right?.bound).toEqual(fr("18"));
    expect(right?.integer).toBe(true);
    expect(right?.solution).toEqual([
      { name: "X", value: fr("2") },
      { name: "Y", value: fr("2") },
    ]);
    expect(right?.pruned).toBe("integer");
  });

  it("sobre Y <= 1 ramifica en X: X <= 3 da (3, 1) con 19 y X >= 4 da (4, 0) con 20", () => {
    const left = r.nodes[r.nodes[0]!.children[0]!]!;
    expect(left.branchedOn).toBe("X");
    const [a, b] = left.children.map((id) => r.nodes[id]!);
    expect(a?.branch).toEqual({
      variable: "X",
      direction: "<=",
      value: fr("3"),
    });
    expect(a?.bound).toEqual(fr("19"));
    expect(a?.solution).toEqual([
      { name: "X", value: fr("3") },
      { name: "Y", value: fr("1") },
    ]);
    expect(b?.branch).toEqual({
      variable: "X",
      direction: ">=",
      value: fr("4"),
    });
    expect(b?.bound).toEqual(fr("20"));
    expect(b?.solution).toEqual([
      { name: "X", value: fr("4") },
      { name: "Y", value: fr("0") },
    ]);
  });

  it("el óptimo es X = 4, Y = 0, Z = 20 con cinco nodos en el árbol", () => {
    expect(r.status).toBe("optimal");
    expect(r.solution?.objective).toEqual(fr("20"));
    expect(r.solution?.variables).toEqual([
      { name: "X", value: fr("4") },
      { name: "Y", value: fr("0") },
    ]);
    expect(r.nodes).toHaveLength(5);
    expect(r.bestNode).toBe(4);
    expect(r.branches).toBe(2);
    expect(r.incumbents.map((i) => i.objective)).toEqual([
      fr("18"),
      fr("19"),
      fr("20"),
    ]);
    expect(r.pivots).toBeGreaterThan(0);
  });

  it("el reporte clásico contiene NEW INTEGER SOLUTION, BOUND ON OPTIMUM y ENUMERATION COMPLETE", () => {
    const text = reportClassicInteger(model, r);
    expect(text).toMatch(
      /NEW INTEGER SOLUTION OF\s+20\.0000000\s+AT BRANCH\s+\d+ PIVOT\s+\d+/,
    );
    expect(text).toMatch(/BOUND ON OPTIMUM:\s+20\.00000/);
    expect(text).toMatch(/ENUMERATION COMPLETE\. BRANCHES=\s+2 PIVOTS=\s+\d+/);
    expect(text).toContain("LAST INTEGER SOLUTION IS THE BEST FOUND");
    expect(text).toContain("        1)      20.00000");
    expect(text).toContain("         X         4.000000");
    const combined = reportCombinedInteger(model, r);
    expect(combined).toContain("Z = 20");
    expect(combined).toMatch(/5 nodos/);
  });

  it("permite elegir a mano la variable de ramificación", () => {
    const mixed = parseLP(
      "MAX 3X + 2Y\nST\n2X + Y <= 9\nX + 3Y <= 10\nEND\nGIN X\nGIN Y",
    );
    const auto = branchAndBound(mixed);
    const manual = branchAndBound(mixed, {
      chooseBranch: (candidates) => candidates[candidates.length - 1]!,
    });
    expect(auto.solution?.objective).toEqual(manual.solution?.objective);
    expect(auto.nodes[0]?.solution?.every((v) => v.value.isInteger())).toBe(
      false,
    );
  });

  it("detecta infactibilidad entera y variables binarias", () => {
    const infeasible = branchAndBound(parseLP("MAX X\nST\n2X = 3\nEND\nGIN X"));
    expect(infeasible.status).toBe("infeasible");
    const binary = branchAndBound(
      parseLP(
        "MAX 3X + 2Y + 4Z\nST\n2X + 3Y + 5Z <= 7\nEND\nINT X\nINT Y\nINT Z",
      ),
    );
    expect(binary.status).toBe("optimal");
    expect(binary.solution?.objective).toEqual(fr("7"));
  });
});
