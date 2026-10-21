// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { Fraction } from "../../src/rational/Fraction";
import { ParseError } from "../../src/parser";
import {
  bayesAnalysis,
  parseDecisionFile,
  payoffAnalysis,
  serializeDecisionFile,
  solveDecisionTree,
  solveGame,
} from "../../src/decision";
import {
  parseInventoryFile,
  serializeInventoryFile,
  eoq,
  newsvendor,
  continuousReview,
} from "../../src/inventory";
import {
  parseQueueFile,
  serializeQueueFile,
  solveQueue,
} from "../../src/queueing";

const examples = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".io.json"))
    .map((f) => readFileSync(`${dir}/${f}`, "utf-8"));

describe("Archivos .io.json de colas, inventarios y decisiones", () => {
  it("todos los ejemplos de colas se leen, se resuelven y se vuelven a escribir igual", () => {
    for (const text of examples("../../examples/queueing")) {
      const file = parseQueueFile(text);
      expect(solveQueue(file.model).lambda.isPositive()).toBe(true);
      expect(parseQueueFile(serializeQueueFile(file))).toEqual(file);
    }
    expect(
      parseQueueFile(`{"type":"queue","kind":"MM1","lambda":2,"mu":3}`).costs,
    ).toBeNull();
  });

  it("todos los ejemplos de inventarios se leen y resuelven", () => {
    for (const text of examples("../../examples/inventory")) {
      const file = parseInventoryFile(text);
      if (file.model === "eoq") {
        expect(eoq(file.input).quantity.isPositive()).toBe(true);
      } else if (file.model === "newsvendor") {
        expect(newsvendor(file.input).quantity.isPositive()).toBe(true);
      } else {
        expect(continuousReview(file.input).reorderPoint.isPositive()).toBe(
          true,
        );
      }
      expect(parseInventoryFile(serializeInventoryFile(file))).toEqual(file);
    }
  });

  it("todos los ejemplos de decisiones se leen y resuelven", () => {
    for (const text of examples("../../examples/decision")) {
      const file = parseDecisionFile(text);
      if (file.type === "payoff") {
        expect(payoffAnalysis(file.problem).maximax.value).toBeInstanceOf(
          Fraction,
        );
      } else if (file.type === "bayes") {
        expect(bayesAnalysis(file.problem).evsi).toBeInstanceOf(Fraction);
      } else if (file.type === "tree") {
        expect(solveDecisionTree(file.tree).status).toBe("ok");
      } else {
        expect(
          solveGame(file.matrix, { rows: file.rows, columns: file.columns })
            .value,
        ).toBeInstanceOf(Fraction);
      }
      expect(parseDecisionFile(serializeDecisionFile(file))).toEqual(file);
    }
  });

  it("informa errores en español", () => {
    const casos: Array<[(text: string) => unknown, string, RegExp]> = [
      [
        parseQueueFile,
        `{"type":"queue","kind":"XX","lambda":1,"mu":2}`,
        /kind/,
      ],
      [
        parseQueueFile,
        `{"type":"queue","kind":"MM1","lambda":"x","mu":2}`,
        /número/,
      ],
      [
        parseQueueFile,
        `{"type":"queue","kind":"MMs","lambda":1,"mu":2,"servers":1.5}`,
        /entero/,
      ],
      [parseInventoryFile, `{"type":"inventory","model":"foo"}`, /model/],
      [
        parseInventoryFile,
        `{"type":"inventory","model":"newsvendor","cost":1,"price":2,"demand":{"kind":"foo"}}`,
        /demand/,
      ],
      [
        parseInventoryFile,
        `{"type":"inventory","model":"continuousReview","demand":1,"orderQuantity":1,"leadTime":1,"leadTimeDemand":{"mean":1,"sd":1},"serviceLevel":2}`,
        /serviceLevel/,
      ],
      [
        parseDecisionFile,
        `{"type":"payoff","payoffs":[[1,2],[3]]}`,
        /rectangular/,
      ],
      [parseDecisionFile, `{"type":"game","matrix":[]}`, /matriz/],
      [
        parseDecisionFile,
        `{"type":"tree","root":"x","nodes":[{"id":"a","kind":"terminal","payoff":1}]}`,
        /root/,
      ],
      [
        parseDecisionFile,
        `{"type":"tree","root":"a","nodes":[{"id":"a","kind":"foo"}]}`,
        /decision/,
      ],
      [parseDecisionFile, `{"type":"other"}`, /type/],
    ];
    for (const [parse, texto, patron] of casos) {
      let error: unknown;
      try {
        parse(texto);
      } catch (e) {
        error = e;
      }
      expect(error, texto).toBeInstanceOf(ParseError);
      expect((error as ParseError).message, texto).toMatch(patron);
    }
  });
});
