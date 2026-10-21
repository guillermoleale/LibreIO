// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación DEC-03: revisión bayesiana y árbol de decisión equivalente.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import {
  bayesAnalysis,
  solveDecisionTree,
  type BayesProblem,
  type DecisionTree,
} from "../../src/decision";
import { reportBayes, reportDecisionTree } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

export const dec03: BayesProblem = {
  title: "DEC-03",
  states: ["S1", "S2"],
  priors: [fr("3/5"), fr("2/5")],
  alternatives: ["A1", "A2"],
  payoffs: [
    [fr(100), fr(-50)],
    [fr(20), fr(20)],
  ],
  indicators: ["I1", "I2"],
  likelihoods: [
    [fr("4/5"), fr("1/5")],
    [fr("3/10"), fr("7/10")],
  ],
};

describe("DEC-03. Revisión bayesiana", () => {
  const r = bayesAnalysis(dec03);

  it("sin información A1 con 40 y VEIP 28", () => {
    expect(r.withoutInformation).toMatchObject({
      alternative: 0,
      value: fr(40),
    });
    expect(r.evwpi).toEqual(fr(68));
    expect(r.evpi).toEqual(fr(28));
  });

  it("P(I1) = 0.6, posteriores P(S1|I1) = 0.8 y P(S1|I2) = 0.3", () => {
    expect(r.indicatorProbabilities).toEqual([fr("3/5"), fr("2/5")]);
    expect(r.posteriors[0]).toEqual([fr("4/5"), fr("1/5")]);
    expect(r.posteriors[1]).toEqual([fr("3/10"), fr("7/10")]);
    expect(r.joint[0]).toEqual([fr("12/25"), fr("3/25")]);
  });

  it("con información 50, VEIM 10 y eficiencia 5/14", () => {
    expect(r.decisions.map((d) => [d.alternative, d.value.toString()])).toEqual(
      [
        [0, "70"],
        [1, "20"],
      ],
    );
    expect(r.evwsi).toEqual(fr(50));
    expect(r.evsi).toEqual(fr(10));
    expect(r.efficiency).toEqual(fr("5/14"));
    const text = reportBayes(dec03, r);
    expect(text).toMatch(/VEIM.*10/);
    expect(text).toMatch(/Eficiencia.*5\/14/);
  });

  it("el árbol de decisión equivalente se resuelve hacia atrás con el mismo valor 50", () => {
    const tree: DecisionTree = {
      title: "DEC-03 como árbol",
      sense: "max",
      root: "raiz",
      nodes: [
        {
          id: "raiz",
          kind: "decision",
          label: "Muestrear",
          branches: [
            { to: "sinInfo", label: "Sin información" },
            { to: "conInfo", label: "Con información" },
          ],
        },
        {
          id: "sinInfo",
          kind: "decision",
          label: null,
          branches: [
            { to: "a1", label: "A1" },
            { to: "a2", label: "A2" },
          ],
        },
        {
          id: "a1",
          kind: "chance",
          label: null,
          branches: [
            { to: "t100", label: "S1", probability: fr("3/5") },
            { to: "tm50", label: "S2", probability: fr("2/5") },
          ],
        },
        {
          id: "a2",
          kind: "terminal",
          label: null,
          payoff: fr(20),
          branches: [],
        },
        {
          id: "t100",
          kind: "terminal",
          label: null,
          payoff: fr(100),
          branches: [],
        },
        {
          id: "tm50",
          kind: "terminal",
          label: null,
          payoff: fr(-50),
          branches: [],
        },
        {
          id: "conInfo",
          kind: "chance",
          label: null,
          branches: [
            { to: "d1", label: "I1", probability: fr("3/5") },
            { to: "d2", label: "I2", probability: fr("2/5") },
          ],
        },
        {
          id: "d1",
          kind: "decision",
          label: null,
          branches: [
            { to: "a1i1", label: "A1" },
            { to: "a2b", label: "A2" },
          ],
        },
        {
          id: "a1i1",
          kind: "chance",
          label: null,
          branches: [
            { to: "t100", label: "S1", probability: fr("4/5") },
            { to: "tm50", label: "S2", probability: fr("1/5") },
          ],
        },
        {
          id: "a2b",
          kind: "terminal",
          label: null,
          payoff: fr(20),
          branches: [],
        },
        {
          id: "d2",
          kind: "decision",
          label: null,
          branches: [
            { to: "a1i2", label: "A1" },
            { to: "a2c", label: "A2" },
          ],
        },
        {
          id: "a1i2",
          kind: "chance",
          label: null,
          branches: [
            { to: "t100", label: "S1", probability: fr("3/10") },
            { to: "tm50", label: "S2", probability: fr("7/10") },
          ],
        },
        {
          id: "a2c",
          kind: "terminal",
          label: null,
          payoff: fr(20),
          branches: [],
        },
      ],
    };
    const t = solveDecisionTree(tree);
    expect(t.status).toBe("ok");
    expect(t.rootValue).toEqual(fr(50));
    expect(t.values["sinInfo"]).toEqual(fr(40));
    expect(t.values["conInfo"]).toEqual(fr(50));
    expect(t.values["d1"]).toEqual(fr(70));
    expect(t.values["d2"]).toEqual(fr(20));
    expect(t.choices["raiz"]).toBe(1);
    expect(t.choices["d1"]).toBe(0);
    expect(t.choices["d2"]).toBe(1);
    expect(t.order[0]).toBe("raiz");
    const text = reportDecisionTree(tree, t);
    expect(text).toContain("Valor del árbol: 50");
    expect(text).toMatch(/Con información/);
  });

  it("los costos de las ramas se suman y las probabilidades deben sumar 1", () => {
    const tree: DecisionTree = {
      title: null,
      sense: "max",
      root: "r",
      nodes: [
        {
          id: "r",
          kind: "decision",
          label: null,
          branches: [
            { to: "c", label: "invertir", payoff: fr(-10) },
            { to: "t0", label: "no invertir" },
          ],
        },
        {
          id: "c",
          kind: "chance",
          label: null,
          branches: [
            { to: "t50", label: "éxito", probability: fr("1/2") },
            { to: "t0", label: "fracaso", probability: fr("1/2") },
          ],
        },
        {
          id: "t50",
          kind: "terminal",
          label: null,
          payoff: fr(50),
          branches: [],
        },
        {
          id: "t0",
          kind: "terminal",
          label: null,
          payoff: fr(0),
          branches: [],
        },
      ],
    };
    const t = solveDecisionTree(tree);
    expect(t.rootValue).toEqual(fr(15));
    expect(t.choices["r"]).toBe(0);
    const bad: DecisionTree = {
      ...tree,
      nodes: tree.nodes.map((n) =>
        n.id === "c"
          ? {
              ...n,
              branches: n.branches.map((b) => ({
                ...b,
                probability: fr("1/3"),
              })),
            }
          : n,
      ),
    };
    expect(solveDecisionTree(bad).status).toBe("invalid");
    const costTree = solveDecisionTree({ ...tree, sense: "min" });
    expect(costTree.rootValue).toEqual(fr(0));
    expect(costTree.choices["r"]).toBe(1);
  });
});
