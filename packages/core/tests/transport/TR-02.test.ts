// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación TR-02: transporte desbalanceado.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { solveTransport, type TransportProblem } from "../../src/transport";
import { reportTransport } from "../../src/report";
import { tr01 } from "./TR-01.test";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));

describe("TR-02. Transporte desbalanceado", () => {
  const problem: TransportProblem = {
    ...tr01,
    title: "TR-02",
    supply: [fr(15), fr(30), fr(10)],
  };

  it("agrega un destino ficticio con demanda 5 y costo 0 y avisa en el reporte", () => {
    const r = solveTransport(problem);
    expect(r.balanced).toEqual({ kind: "destination", amount: fr(5) });
    expect(r.problem.destinations).toEqual([
      "D1",
      "D2",
      "D3",
      "D4",
      "Ficticio",
    ]);
    expect(r.problem.demand[4]).toEqual(fr(5));
    expect(r.problem.costs.every((row) => row[4]!.isZero())).toBe(true);
    expect(r.status).toBe("optimal");
    // Con 5 unidades más en O2 el óptimo baja a 425: O1 -> D4 15, O2 -> D2 15, O2 -> D3 15, O3 -> D1 5 y O3 -> ficticio 5
    expect(r.objective.c).toEqual(fr(425));
    expect(r.allocation[2]![4]).toEqual(fr(5));
    const text = reportTransport(r);
    expect(text).toMatch(/ficticio/i);
    expect(text).toMatch(/oferta.*supera.*demanda|demanda.*menor.*oferta/i);
  });

  it("con más demanda que oferta agrega un origen ficticio", () => {
    const r = solveTransport({
      ...tr01,
      demand: [fr(5), fr(15), fr(15), fr(25)],
    });
    expect(r.balanced).toEqual({ kind: "source", amount: fr(10) });
    expect(r.problem.sources).toEqual(["O1", "O2", "O3", "Ficticio"]);
  });

  it("un problema balanceado no agrega nada", () => {
    expect(solveTransport(tr01).balanced).toBeNull();
  });
});
