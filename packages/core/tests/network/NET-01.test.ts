// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación NET-01: camino mínimo con Dijkstra y traza de etiquetas.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { shortestPath, type NetworkProblem } from "../../src/network";
import { reportShortestPath } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

export const net01: NetworkProblem = {
  title: "NET-01",
  directed: false,
  nodes: ["1", "2", "3", "4", "5"],
  arcs: [
    { from: "1", to: "2", weight: fr(2) },
    { from: "1", to: "3", weight: fr(5) },
    { from: "2", to: "3", weight: fr(2) },
    { from: "2", to: "4", weight: fr(6) },
    { from: "3", to: "4", weight: fr(1) },
    { from: "3", to: "5", weight: fr(7) },
    { from: "4", to: "5", weight: fr(2) },
  ],
};

describe("NET-01. Camino mínimo", () => {
  it("de 1 a 5 cuesta 7 por 1-2-3-4-5", () => {
    const r = shortestPath(net01, "1", "5");
    expect(r.status).toBe("optimal");
    expect(r.distance).toEqual(fr(7));
    expect(r.path).toEqual(["1", "2", "3", "4", "5"]);
    expect(r.pathArcs.map((a) => `${a.from}-${a.to}`)).toEqual([
      "1-2",
      "2-3",
      "3-4",
      "4-5",
    ]);
  });

  it("la traza muestra las etiquetas temporales y permanentes de cada iteración", () => {
    const r = shortestPath(net01, "1", "5");
    expect(r.steps.length).toBeGreaterThanOrEqual(4);
    const first = r.steps[0]!;
    expect(first.settled).toBe("1");
    expect(first.labels["2"]).toMatchObject({
      distance: fr(2),
      predecessor: "1",
      permanent: false,
    });
    expect(first.labels["3"]).toMatchObject({
      distance: fr(5),
      predecessor: "1",
      permanent: false,
    });
    expect(first.labels["4"]?.distance).toBeNull();
    const second = r.steps[1]!;
    expect(second.settled).toBe("2");
    expect(second.labels["3"]).toMatchObject({
      distance: fr(4),
      predecessor: "2",
    });
    expect(second.labels["4"]).toMatchObject({
      distance: fr(8),
      predecessor: "2",
    });
    const last = r.steps[r.steps.length - 1]!;
    expect(last.labels["5"]).toMatchObject({
      distance: fr(7),
      predecessor: "4",
      permanent: true,
    });
    expect(r.labels["4"]).toMatchObject({
      distance: fr(5),
      predecessor: "3",
      permanent: true,
    });
  });

  it("respeta la dirección de los arcos y detecta nodos inalcanzables", () => {
    const directed: NetworkProblem = {
      ...net01,
      directed: true,
      arcs: net01.arcs.filter((a) => !(a.from === "3" && a.to === "4")),
    };
    const r = shortestPath(directed, "1", "5");
    expect(r.distance).toEqual(fr(10));
    expect(r.path).toEqual(["1", "2", "4", "5"]);
    const unreachable = shortestPath({ ...net01, directed: true }, "5", "1");
    expect(unreachable.status).toBe("unreachable");
    expect(unreachable.path).toEqual([]);
    expect(() =>
      shortestPath(
        { ...net01, arcs: [{ from: "1", to: "2", weight: fr(-1) }] },
        "1",
        "2",
      ),
    ).toThrow(/negativ/);
  });

  it("el reporte lista las etiquetas y el camino", () => {
    const text = reportShortestPath(net01, shortestPath(net01, "1", "5"));
    expect(text).toContain("Distancia mínima de 1 a 5: 7");
    expect(text).toContain("1 -> 2 -> 3 -> 4 -> 5");
  });
});
