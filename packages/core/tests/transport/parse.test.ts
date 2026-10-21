// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { ParseError } from "../../src/parser";
import {
  parseTransportFile,
  serializeTransportFile,
  solveAssignment,
  solveTransport,
  solveTransshipment,
} from "../../src/transport";

describe("Archivos .io.json de transporte, transbordo y asignación", () => {
  it("lee un problema de transporte con nombres por defecto, fracciones y rutas prohibidas", () => {
    const file = parseTransportFile(`{
      "type": "transport", "title": "Prueba", "sense": "max",
      "supply": [6, "13/2"], "demand": [6, 6.5],
      "costs": [[1, "M"], [null, "1/3"]]
    }`);
    expect(file.type).toBe("transport");
    if (file.type !== "transport") {
      return;
    }
    expect(file.problem.sources).toEqual(["O1", "O2"]);
    expect(file.problem.destinations).toEqual(["D1", "D2"]);
    expect(file.problem.supply[1]).toEqual(Fraction.parse("13/2"));
    expect(file.problem.demand[1]).toEqual(Fraction.parse("13/2"));
    expect(file.problem.costs[0]![1]).toBeNull();
    expect(file.problem.costs[1]![0]).toBeNull();
    expect(file.problem.costs[1]![1]).toEqual(Fraction.parse("1/3"));
    expect(file.problem.sense).toBe("max");
    const again = parseTransportFile(serializeTransportFile(file));
    expect(again).toEqual(file);
    expect(solveTransport(file.problem).status).toBe("optimal");
  });

  it("lee asignación y transbordo y los vuelve a escribir igual", () => {
    const assignment = parseTransportFile(
      `{"type":"assignment","costs":[[9,2,7],[6,4,3],[5,8,1]]}`,
    );
    expect(assignment.type).toBe("assignment");
    if (assignment.type === "assignment") {
      expect(assignment.problem.agents).toEqual(["A1", "A2", "A3"]);
      expect(solveAssignment(assignment.problem).objective).toEqual(
        Fraction.parse("9"),
      );
      expect(parseTransportFile(serializeTransportFile(assignment))).toEqual(
        assignment,
      );
    }
    const trans =
      parseTransportFile(`{"type":"transshipment","nodes":[{"name":"S","supply":5},{"name":"T"},{"name":"D","demand":5}],
      "arcs":[{"from":"S","to":"T","cost":1},{"from":"T","to":"D","cost":2}]}`);
    expect(trans.type).toBe("transshipment");
    if (trans.type === "transshipment") {
      expect(solveTransshipment(trans.problem).objective).toEqual(
        Fraction.parse("15"),
      );
      expect(parseTransportFile(serializeTransportFile(trans))).toEqual(trans);
    }
  });

  it("informa errores en español", () => {
    const casos: Array<[string, RegExp]> = [
      ["{", /JSON/],
      ["[]", /objeto/],
      [`{"type":"foo"}`, /type/],
      [
        `{"type":"transport","supply":[1],"demand":[1],"costs":[[1],[2]]}`,
        /fila por origen/,
      ],
      [
        `{"type":"transport","supply":[1],"demand":[1,2],"costs":[[1]]}`,
        /costo por destino/,
      ],
      [
        `{"type":"transport","supply":[-1],"demand":[1],"costs":[[1]]}`,
        /negativ/,
      ],
      [
        `{"type":"transport","supply":["x"],"demand":[1],"costs":[[1]]}`,
        /número/,
      ],
      [
        `{"type":"transport","sources":["A"],"supply":[1,2],"demand":[3],"costs":[[1],[2]]}`,
        /nombres/,
      ],
      [
        `{"type":"transport","sense":"foo","supply":[1],"demand":[1],"costs":[[1]]}`,
        /sense/,
      ],
      [`{"type":"assignment","costs":[]}`, /costs/],
      [`{"type":"transshipment","nodes":[],"arcs":[]}`, /nodes/],
      [
        `{"type":"transshipment","nodes":[{"name":"A"},{"name":"A"}],"arcs":[]}`,
        /mismo nombre/,
      ],
      [
        `{"type":"transshipment","nodes":[{"name":"A"}],"arcs":[{"from":"A","to":"B","cost":1}]}`,
        /desconocido/,
      ],
      [`{"type":"transshipment","nodes":[{"name":"A"}],"arcs":[]}`, /arcs/],
      [`{"type":"transshipment","nodes":[{"supply":1}],"arcs":[]}`, /name/],
    ];
    for (const [texto, patron] of casos) {
      let error: unknown;
      try {
        parseTransportFile(texto);
      } catch (e) {
        error = e;
      }
      expect(error, texto).toBeInstanceOf(ParseError);
      expect((error as ParseError).message, texto).toMatch(patron);
    }
  });
});
