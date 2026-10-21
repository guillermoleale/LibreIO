// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación NET-03: árbol de expansión mínima por Kruskal y por Prim.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { minimumSpanningTree, type NetworkProblem } from "../../src/network";
import { reportSpanningTree } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

export const net03: NetworkProblem = {
  title: "NET-03",
  directed: false,
  nodes: ["A", "B", "C", "D"],
  arcs: [
    { from: "A", to: "B", weight: fr(1) },
    { from: "B", to: "C", weight: fr(2) },
    { from: "C", to: "D", weight: fr(3) },
    { from: "A", to: "D", weight: fr(4) },
    { from: "A", to: "C", weight: fr(5) },
    { from: "B", to: "D", weight: fr(6) },
  ],
};

const edgeNames = (edges: Array<{ from: string; to: string }>) =>
  edges.map((e) => [e.from, e.to].sort().join("")).sort();

describe("NET-03. Árbol de expansión mínima", () => {
  it("Kruskal elige AB, BC y CD con costo 6 y rechaza las aristas que cierran ciclo", () => {
    const r = minimumSpanningTree(net03, "kruskal");
    expect(r.cost).toEqual(fr(6));
    expect(edgeNames(r.edges)).toEqual(["AB", "BC", "CD"]);
    expect(
      r.steps.map((s) => [`${s.edge.from}${s.edge.to}`, s.accepted]),
    ).toEqual([
      ["AB", true],
      ["BC", true],
      ["CD", true],
      ["AD", false],
      ["AC", false],
      ["BD", false],
    ]);
    expect(r.steps[3]?.note).toMatch(/ciclo/i);
  });

  it("Prim desde A da el mismo árbol", () => {
    const r = minimumSpanningTree(net03, "prim", "A");
    expect(r.cost).toEqual(fr(6));
    expect(edgeNames(r.edges)).toEqual(["AB", "BC", "CD"]);
    expect(
      r.steps
        .filter((s) => s.accepted)
        .map((s) => `${s.edge.from}${s.edge.to}`),
    ).toEqual(["AB", "BC", "CD"]);
    expect(r.steps[0]?.note).toMatch(/A/);
  });

  it("avisa cuando el grafo no es conexo", () => {
    const r = minimumSpanningTree(
      {
        ...net03,
        arcs: net03.arcs.filter((a) => a.to !== "D" && a.from !== "D"),
      },
      "kruskal",
    );
    expect(r.connected).toBe(false);
    expect(r.edges).toHaveLength(2);
    const text = reportSpanningTree(
      net03,
      minimumSpanningTree(net03, "kruskal"),
    );
    expect(text).toContain("Costo total: 6");
  });
});
