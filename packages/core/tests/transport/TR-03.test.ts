// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación TR-03: transbordo reducido a transporte con nodo intermedio y buffer.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import {
  solveTransshipment,
  transshipmentToTransport,
  type TransshipmentProblem,
} from "../../src/transport";
import { reportTransshipment } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

const problem: TransshipmentProblem = {
  title: "TR-03",
  sense: "min",
  nodes: [
    { name: "S1", supply: fr(10), demand: fr(0) },
    { name: "S2", supply: fr(5), demand: fr(0) },
    { name: "T", supply: fr(0), demand: fr(0) },
    { name: "D1", supply: fr(0), demand: fr(8) },
    { name: "D2", supply: fr(0), demand: fr(7) },
  ],
  arcs: [
    { from: "S1", to: "T", cost: fr(2) },
    { from: "S2", to: "T", cost: fr(3) },
    { from: "T", to: "D1", cost: fr(1) },
    { from: "T", to: "D2", cost: fr(2) },
    { from: "S1", to: "D1", cost: fr(5) },
    { from: "S2", to: "D2", cost: fr(4) },
  ],
};

describe("TR-03. Transbordo", () => {
  it("la matriz ampliada tiene buffer 15, filas S1, S2, T y columnas T, D1, D2 con costo M en los arcos inexistentes", () => {
    const { transport, buffer } = transshipmentToTransport(problem);
    expect(buffer).toEqual(fr(15));
    expect(transport.sources).toEqual(["S1", "S2", "T"]);
    expect(transport.destinations).toEqual(["T", "D1", "D2"]);
    expect(transport.supply).toEqual([fr(10), fr(5), fr(15)]);
    expect(transport.demand).toEqual([fr(15), fr(8), fr(7)]);
    expect(transport.costs[0]).toEqual([fr(2), fr(5), null]);
    expect(transport.costs[1]).toEqual([fr(3), null, fr(4)]);
    expect(transport.costs[2]).toEqual([fr(0), fr(1), fr(2)]);
  });

  it("el costo mínimo es 52 con S1-T 10, T-D1 8, T-D2 2 y S2-D2 5, y pasan 10 unidades por T", () => {
    const r = solveTransshipment(problem);
    expect(r.status).toBe("optimal");
    expect(r.objective).toEqual(fr(52));
    const flows = Object.fromEntries(
      r.flows.map((f) => [`${f.from}-${f.to}`, f.value.toString()]),
    );
    expect(flows).toEqual({
      "S1-T": "10",
      "T-D1": "8",
      "T-D2": "2",
      "S2-D2": "5",
    });
    expect(r.through).toEqual([{ node: "T", amount: fr(10) }]);
    expect(r.transport.iterations.length).toBeGreaterThan(0);
    const text = reportTransshipment(r);
    expect(text).toContain("Costo total: 52");
    expect(text).toMatch(/S1\s*->\s*T\s+10/);
    expect(text).toMatch(/M/);
  });
});
