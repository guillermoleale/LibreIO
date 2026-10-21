// SPDX-License-Identifier: GPL-3.0-or-later
// Casos de aceptación MK-01 (cadena regular) y MK-02 (estados absorbentes).
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { markovChain, type MarkovProblem } from "../../src/markov";
import { reportMarkov } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));
const row = (values: string[]) => values.map((v) => fr(v));

describe("MK-01. Cadena regular", () => {
  const problem: MarkovProblem = {
    title: "MK-01",
    states: ["1", "2"],
    matrix: [row(["9/10", "1/10"]), row(["1/2", "1/2"])],
  };
  const r = markovChain(problem);

  it("el estado estable es (5/6, 1/6)", () => {
    expect(r.regular).toBe(true);
    expect(r.steadyState).toEqual([fr("5/6"), fr("1/6")]);
    expect(r.classes.map((c) => c.states)).toEqual([["1", "2"]]);
    expect(r.absorbingStates).toEqual([]);
  });

  it("tiempos medios de primer paso: de 2 a 1 es 2, de 1 a 2 es 10; recurrencia del estado 1 es 6/5", () => {
    expect(r.meanFirstPassage![1]![0]).toEqual(fr(2));
    expect(r.meanFirstPassage![0]![1]).toEqual(fr(10));
    expect(r.recurrenceTimes).toEqual([fr("6/5"), fr(6)]);
    expect(r.meanFirstPassage![0]![0]).toEqual(fr("6/5"));
  });

  it("calcula la distribución en n pasos y las potencias de la matriz", () => {
    const initial = [fr(1), fr(0)];
    expect(r.distributionAfter(initial, 0)).toEqual(initial);
    expect(r.distributionAfter(initial, 1)).toEqual([fr("9/10"), fr("1/10")]);
    expect(r.distributionAfter(initial, 2)).toEqual([fr("43/50"), fr("7/50")]);
    const p2 = r.power(2);
    expect(p2[0]).toEqual([fr("43/50"), fr("7/50")]);
    expect(p2[1]).toEqual([fr("7/10"), fr("3/10")]);
    const text = reportMarkov(problem, r, { steps: 3, initial });
    expect(text).toContain("5/6");
    expect(text).toMatch(/recurrencia/i);
  });

  it("valida que la matriz sea estocástica", () => {
    expect(() =>
      markovChain({
        title: null,
        states: ["a", "b"],
        matrix: [row(["1/2", "1/4"]), row(["0", "1"])],
      }),
    ).toThrow(/suma/);
    expect(() =>
      markovChain({
        title: null,
        states: ["a"],
        matrix: [row(["1/2", "1/2"])],
      }),
    ).toThrow(/cuadrada/);
  });
});

describe("MK-02. Estados absorbentes", () => {
  const problem: MarkovProblem = {
    title: "MK-02",
    states: ["1", "2", "3"],
    matrix: [
      row(["1/2", "3/10", "1/5"]),
      row(["0", "1", "0"]),
      row(["0", "0", "1"]),
    ],
  };
  const r = markovChain(problem);

  it("clasifica el estado 1 como transitorio y 2 y 3 como absorbentes", () => {
    expect(r.regular).toBe(false);
    expect(r.absorbingStates).toEqual(["2", "3"]);
    expect(r.transientStates).toEqual(["1"]);
    expect(r.steadyState).toBeNull();
  });

  it("probabilidad de absorción 0.6 en 2 y 0.4 en 3, y 2 pasos esperados hasta la absorción", () => {
    const a = r.absorbing!;
    expect(a.transient).toEqual(["1"]);
    expect(a.absorbing).toEqual(["2", "3"]);
    expect(a.Q).toEqual([[fr("1/2")]]);
    expect(a.R).toEqual([[fr("3/10"), fr("1/5")]]);
    expect(a.N).toEqual([[fr(2)]]);
    expect(a.B).toEqual([[fr("3/5"), fr("2/5")]]);
    expect(a.expectedSteps).toEqual([fr(2)]);
    const text = reportMarkov(problem, r);
    expect(text).toMatch(/absorci/i);
    expect(text).toContain("3/5");
  });

  it("una cadena periódica no es regular pero tiene distribución estacionaria", () => {
    const periodic = markovChain({
      title: null,
      states: ["a", "b"],
      matrix: [row(["0", "1"]), row(["1", "0"])],
    });
    expect(periodic.regular).toBe(false);
    expect(periodic.stationary).toEqual([fr("1/2"), fr("1/2")]);
    expect(periodic.steadyState).toBeNull();
    expect(periodic.messages.join(" ")).toMatch(/peri/i);
  });
});
