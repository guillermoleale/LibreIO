// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación NET-04: viajante con ramificación y acotamiento y heurísticas.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { travelingSalesman, type NetworkProblem } from "../../src/network";
import { reportTravelingSalesman } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

export const net04: NetworkProblem = {
  title: "NET-04",
  directed: false,
  nodes: ["1", "2", "3", "4"],
  arcs: [
    { from: "1", to: "2", weight: fr(10) },
    { from: "1", to: "3", weight: fr(15) },
    { from: "1", to: "4", weight: fr(20) },
    { from: "2", to: "3", weight: fr(35) },
    { from: "2", to: "4", weight: fr(25) },
    { from: "3", to: "4", weight: fr(30) },
  ],
};

describe("NET-04. Viajante", () => {
  it("el óptimo es 80 por el circuito 1-2-4-3-1", () => {
    const r = travelingSalesman(net04, "1");
    expect(r.status).toBe("optimal");
    expect(r.optimal.cost).toEqual(fr(80));
    expect(r.optimal.tour).toEqual(["1", "2", "4", "3", "1"]);
    expect(r.optimal.nodes.length).toBeGreaterThan(1);
    expect(r.optimal.nodes[0]?.path).toEqual(["1"]);
    expect(r.optimal.nodes.some((n) => n.pruned)).toBe(true);
  });

  it("vecino más cercano desde 1 también da 80 e inserción más barata da una solución factible", () => {
    const r = travelingSalesman(net04, "1");
    expect(r.nearestNeighbor.tour).toEqual(["1", "2", "4", "3", "1"]);
    expect(r.nearestNeighbor.cost).toEqual(fr(80));
    expect(r.nearestNeighbor.steps.length).toBe(3);
    expect(r.cheapestInsertion.tour).toHaveLength(5);
    expect(r.cheapestInsertion.cost.ge(fr(80))).toBe(true);
    expect(r.cheapestInsertion.steps.length).toBeGreaterThan(0);
  });

  it("acepta una matriz asimétrica y rechaza más de 10 nodos o grafos incompletos", () => {
    const asym: NetworkProblem = {
      title: null,
      directed: true,
      nodes: ["A", "B", "C"],
      arcs: [
        { from: "A", to: "B", weight: fr(1) },
        { from: "B", to: "C", weight: fr(1) },
        { from: "C", to: "A", weight: fr(1) },
        { from: "A", to: "C", weight: fr(5) },
        { from: "C", to: "B", weight: fr(5) },
        { from: "B", to: "A", weight: fr(5) },
      ],
    };
    const r = travelingSalesman(asym, "A");
    expect(r.optimal.cost).toEqual(fr(3));
    expect(r.optimal.tour).toEqual(["A", "B", "C", "A"]);
    const incomplete = travelingSalesman(
      { ...net04, arcs: net04.arcs.slice(0, 3) },
      "1",
    );
    expect(incomplete.status).toBe("infeasible");
    const big: NetworkProblem = {
      title: null,
      directed: false,
      nodes: Array.from({ length: 11 }, (_, i) => `N${i}`),
      arcs: [],
    };
    expect(() => travelingSalesman(big, "N0")).toThrow(/10/);
  });

  it("resuelve exactamente un caso de 8 ciudades y las heurísticas no lo mejoran", () => {
    const n = 8;
    const nodes = Array.from({ length: n }, (_, i) => `C${i + 1}`);
    const arcs: NetworkProblem["arcs"] = [];
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        arcs.push({
          from: nodes[i]!,
          to: nodes[j]!,
          weight: fr(((i * 7 + j * 13) % 23) + 1),
        });
      }
    }
    const r = travelingSalesman(
      { title: null, directed: false, nodes, arcs },
      "C1",
    );
    expect(r.status).toBe("optimal");
    expect(r.nearestNeighbor.cost.ge(r.optimal.cost)).toBe(true);
    expect(r.cheapestInsertion.cost.ge(r.optimal.cost)).toBe(true);
    const text = reportTravelingSalesman(net04, travelingSalesman(net04, "1"));
    expect(text).toContain("Costo del circuito óptimo: 80");
    expect(text).toContain("1 -> 2 -> 4 -> 3 -> 1");
  });
});
