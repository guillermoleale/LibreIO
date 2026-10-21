// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación Q-04: análisis de costos y de capacidad sobre M/M/s.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import {
  capacityAnalysis,
  queueCost,
  solveQueue,
  type QueueModel,
} from "../../src/queueing";
import { reportCapacity } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

describe("Q-04. Análisis de costos sobre M/M/s con λ = 2 y μ = 3", () => {
  const base: QueueModel = {
    kind: "MMs",
    lambda: fr(2),
    mu: fr(3),
    servers: 1,
  };
  const costs = { serverCost: fr(10), waitingCost: fr(30) };

  it("s = 1 cuesta 70, s = 2 cuesta 42.5 y s = 3 aproximadamente 50.3; el óptimo es s = 2", () => {
    const one = queueCost(solveQueue(base), costs);
    expect(one.total).toEqual(fr(70));
    expect(one.serviceCost).toEqual(fr(10));
    expect(one.waitingCostTotal).toEqual(fr(60));
    const two = queueCost(solveQueue({ ...base, servers: 2 }), costs);
    expect(two.total).toEqual(fr("85/2"));
    const three = queueCost(solveQueue({ ...base, servers: 3 }), costs);
    expect(Math.abs(three.total.toNumber() - 50.3)).toBeLessThan(0.05);
    const analysis = capacityAnalysis(
      base,
      { vary: "servers", values: [fr(1), fr(2), fr(3)] },
      costs,
    );
    expect(analysis.rows.map((r) => r.cost!.total.toString())).toEqual([
      "70",
      "85/2",
      three.total.toString(),
    ]);
    expect(analysis.best).toBe(1);
    const text = reportCapacity(analysis);
    expect(text).toContain("70");
    expect(text).toMatch(/42[.,]5|85\/2/);
  });

  it("puede costear la espera en cola en vez de en el sistema y variar λ, μ o K", () => {
    const queueBased = queueCost(solveQueue(base), {
      ...costs,
      basis: "queue",
    });
    expect(queueBased.total).toEqual(fr(10).add(fr(30).mul(fr("4/3"))));
    const byMu = capacityAnalysis(
      base,
      { vary: "mu", values: [fr(3), fr(4)] },
      costs,
    );
    expect(byMu.rows).toHaveLength(2);
    expect(byMu.rows[1]!.result.L.lt(byMu.rows[0]!.result.L)).toBe(true);
    const byLambda = capacityAnalysis(base, {
      vary: "lambda",
      values: [fr(1), fr(2), fr(4)],
    });
    expect(byLambda.rows[2]!.result.stable).toBe(false);
    expect(byLambda.rows[2]!.cost).toBeNull();
    const byK = capacityAnalysis(
      { kind: "MM1K", lambda: fr(2), mu: fr(3), capacity: 2 },
      { vary: "capacity", values: [fr(2), fr(5)] },
      costs,
    );
    expect(byK.rows[1]!.result.L.gt(byK.rows[0]!.result.L)).toBe(true);
  });
});
