// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { ParseError } from "../../src/parser";
import {
  cpm,
  crashing,
  parseProjectFile,
  pert,
  serializeProjectFile,
} from "../../src/pert";
import { reportCpm, reportCrashing, reportPert } from "../../src/report";

describe("Archivos .io.json de proyectos", () => {
  it("lee actividades con duración o con tres estimaciones y datos de quiebre y las vuelve a escribir igual", () => {
    const file = parseProjectFile(`{"type":"project","title":"P","activities":[
      {"id":"A","name":"Diseño","duration":3,"crashDuration":2,"crashCostPerUnit":50},
      {"id":"B","predecessors":["A"],"optimistic":1,"mostLikely":2,"pessimistic":"3"},
      {"id":"C","predecessors":["A"],"duration":2,"normalCost":100,"crashDuration":1,"crashCost":180}
    ]}`);
    expect(file.title).toBe("P");
    expect(file.activities[1]?.duration).toEqual(Fraction.parse("2"));
    expect(file.activities[0]?.name).toBe("Diseño");
    expect(parseProjectFile(serializeProjectFile(file))).toEqual(file);
    const r = crashing(file, Fraction.parse("4"));
    expect(r.crashable.map((c) => [c.id, c.costPerUnit.toString()])).toEqual([
      ["A", "50"],
      ["C", "80"],
    ]);
    expect(r.target?.feasible).toBe(true);
    expect(reportCrashing(file, r)).toContain("Objetivo 4");
    expect(reportCpm(file, cpm(file))).toContain("Duración del proyecto: 5");
    expect(reportPert(file, pert(file))).toContain("Duración esperada: 5");
  });

  it("informa errores en español", () => {
    const casos: Array<[string, RegExp]> = [
      ["{", /JSON/],
      ["[]", /objeto/],
      [`{"type":"foo"}`, /type/],
      [`{"type":"project","activities":[]}`, /activities/],
      [`{"type":"project","activities":[1]}`, /objeto/],
      [`{"type":"project","activities":[{"duration":1}]}`, /id/],
      [
        `{"type":"project","activities":[{"id":"A","predecessors":"B","duration":1}]}`,
        /predecessors/,
      ],
      [`{"type":"project","activities":[{"id":"A"}]}`, /duration/],
      [`{"type":"project","activities":[{"id":"A","duration":"x"}]}`, /número/],
      [
        `{"type":"project","activities":[{"id":"A","duration":true}]}`,
        /número/,
      ],
    ];
    for (const [texto, patron] of casos) {
      let error: unknown;
      try {
        parseProjectFile(texto);
      } catch (e) {
        error = e;
      }
      expect(error, texto).toBeInstanceOf(ParseError);
      expect((error as ParseError).message, texto).toMatch(patron);
    }
  });

  it("valida identificadores repetidos, duraciones negativas y ciclos en la compresión", () => {
    expect(() =>
      cpm({
        title: null,
        activities: [
          { id: "A", name: null, predecessors: [], duration: Fraction.ONE },
          { id: "A", name: null, predecessors: [], duration: Fraction.ONE },
        ],
      }),
    ).toThrow(/repetida/);
    expect(() =>
      cpm({
        title: null,
        activities: [
          { id: "", name: null, predecessors: [], duration: Fraction.ONE },
        ],
      }),
    ).toThrow(/identificador/);
    expect(() =>
      cpm({
        title: null,
        activities: [
          {
            id: "A",
            name: null,
            predecessors: [],
            duration: Fraction.parse("-1"),
          },
        ],
      }),
    ).toThrow(/negativa/);
    const cyclic = {
      title: null,
      activities: [
        { id: "A", name: null, predecessors: ["B"], duration: Fraction.ONE },
        { id: "B", name: null, predecessors: ["A"], duration: Fraction.ONE },
      ],
    };
    expect(() => crashing(cyclic)).toThrow(/ciclo/);
    expect(reportCpm(cyclic, cpm(cyclic))).toMatch(/ciclo/);
    const sigmaZero = pert({
      title: null,
      activities: [
        {
          id: "A",
          name: null,
          predecessors: [],
          duration: Fraction.parse("4"),
        },
      ],
    });
    expect(sigmaZero.probabilityByDate(4)).toBe(1);
    expect(sigmaZero.probabilityByDate(3)).toBe(0);
    const twoPaths = pert({
      title: null,
      activities: [
        {
          id: "A",
          name: null,
          predecessors: [],
          duration: Fraction.parse("2"),
          optimistic: Fraction.ONE,
          mostLikely: Fraction.parse("2"),
          pessimistic: Fraction.parse("3"),
        },
        {
          id: "B",
          name: null,
          predecessors: [],
          duration: Fraction.parse("2"),
        },
      ],
    });
    expect(twoPaths.messages.join(" ")).toMatch(/más de un camino crítico/);
    expect(twoPaths.criticalPath).toEqual(["A"]);
  });
});
