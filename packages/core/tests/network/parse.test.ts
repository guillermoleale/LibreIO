// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { ParseError } from "../../src/parser";
import {
  maxFlow,
  minimumSpanningTree,
  parseNetworkFile,
  serializeNetworkFile,
  shortestPath,
  travelingSalesman,
} from "../../src/network";
import {
  reportMaxFlow,
  reportShortestPath,
  reportSpanningTree,
  reportTravelingSalesman,
} from "../../src/report";

describe("Archivos .io.json de redes", () => {
  it("lee una red con nodos opcionales, pesos como fracción y la vuelve a escribir igual", () => {
    const file = parseNetworkFile(
      `{"type":"network","title":"Red","directed":true,"arcs":[{"from":"a","to":"b","weight":"1/2"},{"from":"b","to":"c","cost":3},{"from":"c","to":"a","capacity":4}]}`,
    );
    expect(file.title).toBe("Red");
    expect(file.directed).toBe(true);
    expect(file.nodes).toEqual([]);
    expect(file.arcs[0]?.weight).toEqual(Fraction.parse("1/2"));
    expect(file.arcs[1]?.weight).toEqual(Fraction.parse("3"));
    expect(parseNetworkFile(serializeNetworkFile(file))).toEqual(file);
    const undirected = parseNetworkFile(
      `{"type":"network","nodes":["x","y"],"arcs":[{"from":"x","to":"y","weight":2}]}`,
    );
    expect(undirected.directed).toBe(false);
    expect(undirected.nodes).toEqual(["x", "y"]);
    expect(shortestPath(undirected, "y", "x").distance).toEqual(
      Fraction.parse("2"),
    );
  });

  it("informa errores en español", () => {
    const casos: Array<[string, RegExp]> = [
      ["{", /JSON/],
      ["[]", /objeto/],
      [`{"type":"foo"}`, /type/],
      [`{"type":"network","arcs":[]}`, /arcs/],
      [`{"type":"network","arcs":[1]}`, /objeto/],
      [`{"type":"network","arcs":[{"from":"a"}]}`, /from|to/],
      [
        `{"type":"network","arcs":[{"from":"a","to":"b","weight":"x"}]}`,
        /número/,
      ],
      [`{"type":"network","arcs":[{"from":"a","to":"b"}]}`, /número/],
      [
        `{"type":"network","nodes":[1],"arcs":[{"from":"a","to":"b","weight":1}]}`,
        /nodes/,
      ],
    ];
    for (const [texto, patron] of casos) {
      let error: unknown;
      try {
        parseNetworkFile(texto);
      } catch (e) {
        error = e;
      }
      expect(error, texto).toBeInstanceOf(ParseError);
      expect((error as ParseError).message, texto).toMatch(patron);
    }
  });

  it("los reportes cubren los casos sin solución y las redes dirigidas", () => {
    const net = parseNetworkFile(
      `{"type":"network","directed":true,"arcs":[{"from":"a","to":"b","weight":1},{"from":"c","to":"d","weight":2}]}`,
    );
    expect(reportShortestPath(net, shortestPath(net, "a", "d"))).toMatch(
      /No existe camino/,
    );
    expect(reportMaxFlow(net, maxFlow(net, "a", "d"))).toContain(
      "Flujo máximo de a a d: 0",
    );
    const forest = minimumSpanningTree(net, "prim", "a");
    expect(forest.connected).toBe(false);
    expect(reportSpanningTree(net, forest)).toMatch(/bosque/);
    const tsp = travelingSalesman(net, "a");
    expect(tsp.status).toBe("infeasible");
    expect(reportTravelingSalesman(net, tsp)).toMatch(/No existe un circuito/);
    expect(() => shortestPath(net, "zz", "a")).toThrow(/zz/);
    expect(() => maxFlow(net, "a", "zz")).toThrow(/zz/);
    expect(() => minimumSpanningTree(net, "prim", "zz")).toThrow(/zz/);
    expect(() =>
      maxFlow(
        {
          ...net,
          arcs: [{ from: "a", to: "b", weight: Fraction.parse("-1") }],
        },
        "a",
        "b",
      ),
    ).toThrow(/negativ/);
  });

  it("flujo máximo con arcos paralelos reparte el flujo y los arcos no dirigidos informan el sentido", () => {
    const parallel = parseNetworkFile(
      `{"type":"network","directed":true,"arcs":[{"from":"s","to":"t","weight":3},{"from":"s","to":"t","weight":1}]}`,
    );
    const r = maxFlow(parallel, "s", "t");
    expect(r.value).toEqual(Fraction.parse("4"));
    expect(r.flows.map((f) => f.flow.toString())).toEqual(["3", "1"]);
    const undirected = parseNetworkFile(
      `{"type":"network","arcs":[{"from":"a","to":"b","weight":2},{"from":"c","to":"b","weight":2}]}`,
    );
    const u = maxFlow(undirected, "a", "c");
    expect(u.value).toEqual(Fraction.parse("2"));
    expect(u.flows[1]).toMatchObject({ from: "b", to: "c" });
  });
});
