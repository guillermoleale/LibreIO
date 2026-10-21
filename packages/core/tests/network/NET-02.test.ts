// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación NET-02: flujo máximo con Ford Fulkerson, caminos de aumento y corte mínimo.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { maxFlow, type NetworkProblem } from "../../src/network";
import { reportMaxFlow } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

export const net02: NetworkProblem = {
  title: "NET-02",
  directed: true,
  nodes: ["s", "a", "b", "t"],
  arcs: [
    { from: "s", to: "a", weight: fr(10) },
    { from: "s", to: "b", weight: fr(5) },
    { from: "a", to: "b", weight: fr(15) },
    { from: "a", to: "t", weight: fr(5) },
    { from: "b", to: "t", weight: fr(10) },
  ],
};

describe("NET-02. Flujo máximo", () => {
  it("el flujo máximo es 15 con corte mínimo {s, a, b} | {t}", () => {
    const r = maxFlow(net02, "s", "t");
    expect(r.value).toEqual(fr(15));
    expect(r.minCut.sourceSide).toEqual(["s", "a", "b"]);
    expect(r.minCut.sinkSide).toEqual(["t"]);
    expect(r.minCut.arcs.map((a) => `${a.from}-${a.to}`).sort()).toEqual([
      "a-t",
      "b-t",
    ]);
    expect(r.minCut.capacity).toEqual(fr(15));
  });

  it("los flujos cumplen capacidad y conservación", () => {
    const r = maxFlow(net02, "s", "t");
    for (const f of r.flows) {
      expect(f.flow.le(f.capacity), `${f.from}-${f.to}`).toBe(true);
      expect(f.flow.isNegative()).toBe(false);
    }
    const out = (n: string) =>
      Fraction.sum(r.flows.filter((f) => f.from === n).map((f) => f.flow));
    const into = (n: string) =>
      Fraction.sum(r.flows.filter((f) => f.to === n).map((f) => f.flow));
    expect(out("s")).toEqual(fr(15));
    expect(into("t")).toEqual(fr(15));
    expect(out("a")).toEqual(into("a"));
    expect(out("b")).toEqual(into("b"));
  });

  it("la traza muestra cada camino de aumento con su cuello de botella", () => {
    const r = maxFlow(net02, "s", "t");
    expect(r.augmentingPaths.length).toBeGreaterThanOrEqual(2);
    expect(Fraction.sum(r.augmentingPaths.map((p) => p.bottleneck))).toEqual(
      fr(15),
    );
    for (const p of r.augmentingPaths) {
      expect(p.path[0]).toBe("s");
      expect(p.path[p.path.length - 1]).toBe("t");
      expect(p.bottleneck.isPositive()).toBe(true);
    }
    const text = reportMaxFlow(net02, r);
    expect(text).toContain("Flujo máximo de s a t: 15");
    expect(text).toMatch(/Corte mínimo/);
  });

  it("en un grafo no dirigido cada arista admite flujo en los dos sentidos", () => {
    const undirected: NetworkProblem = { ...net02, directed: false };
    expect(maxFlow(undirected, "s", "t").value).toEqual(fr(15));
    const noPath = maxFlow(
      { ...net02, arcs: net02.arcs.filter((a) => a.to !== "t") },
      "s",
      "t",
    );
    expect(noPath.value).toEqual(fr(0));
  });
});
