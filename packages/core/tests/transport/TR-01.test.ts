// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación TR-01: transporte con soluciones iniciales y MODI.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import {
  initialSolution,
  solveTransport,
  type TransportProblem,
} from "../../src/transport";
import { reportTransport } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));
const row = (values: number[]) => values.map((v) => fr(v));

export const tr01: TransportProblem = {
  title: "TR-01",
  sense: "min",
  sources: ["O1", "O2", "O3"],
  destinations: ["D1", "D2", "D3", "D4"],
  supply: row([15, 25, 10]),
  demand: row([5, 15, 15, 15]),
  costs: [row([10, 2, 20, 11]), row([12, 7, 9, 20]), row([4, 14, 16, 18])],
};

function allocationMap(
  allocation: Array<Array<Fraction | null>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  allocation.forEach((r, i) =>
    r.forEach((v, j) => {
      if (v !== null && !v.isZero()) {
        out[`x${i + 1}${j + 1}`] = v.toString();
      }
    }),
  );
  return out;
}

describe("TR-01. Transporte", () => {
  it("esquina noroeste cuesta 520", () => {
    const s = initialSolution(tr01, "northwest");
    expect(s.cost.c).toEqual(fr(520));
    expect(s.cost.m.isZero()).toBe(true);
    expect(allocationMap(s.allocation)).toEqual({
      x11: "5",
      x12: "10",
      x22: "5",
      x23: "15",
      x24: "5",
      x34: "10",
    });
    expect(s.basicCount).toBe(6);
    expect(s.steps.length).toBeGreaterThan(0);
  });

  it("mínimo de matriz cuesta 475", () => {
    const s = initialSolution(tr01, "matrixMinimum");
    expect(s.cost.c).toEqual(fr(475));
    expect(allocationMap(s.allocation)).toEqual({
      x12: "15",
      x23: "15",
      x24: "10",
      x31: "5",
      x34: "5",
    });
  });

  it("Vogel cuesta 475 y es degenerada con cinco celdas básicas de seis", () => {
    const s = initialSolution(tr01, "vogel");
    expect(s.cost.c).toEqual(fr(475));
    expect(s.basicCount).toBe(5);
    expect(s.degenerate).toBe(true);
    expect(s.steps[0]?.rowPenalties).toBeDefined();
  });

  it("mínimo de fila, mínimo de columna y Russell dan soluciones factibles", () => {
    for (const method of ["rowMinimum", "columnMinimum", "russell"] as const) {
      const s = initialSolution(tr01, method);
      const rowSums = s.allocation.map((r) =>
        Fraction.sum(r.map((v) => v ?? Fraction.ZERO)),
      );
      expect(rowSums, method).toEqual(tr01.supply);
      expect(s.cost.c.ge(fr(435)), method).toBe(true);
    }
  });

  it("MODI llega al óptimo 435 desde Vogel manejando la degeneración", () => {
    const r = solveTransport(tr01, { initial: "vogel" });
    expect(r.status).toBe("optimal");
    expect(r.objective.c).toEqual(fr(435));
    expect(allocationMap(r.allocation)).toEqual({
      x12: "5",
      x14: "10",
      x22: "10",
      x23: "15",
      x31: "5",
      x34: "5",
    });
    expect(r.initial.cost.c).toEqual(fr(475));
    expect(r.iterations.length).toBeGreaterThan(1);
    const first = r.iterations[0]!;
    expect(first.u).toHaveLength(3);
    expect(first.v).toHaveLength(4);
    expect(first.entering).not.toBeNull();
    expect(first.cycle!.length).toBeGreaterThanOrEqual(4);
    const last = r.iterations[r.iterations.length - 1]!;
    expect(last.entering).toBeNull();
    expect(r.messages.join("\n")).toMatch(/degenerad/i);
  });

  it("MODI llega al mismo óptimo desde cualquier solución inicial", () => {
    for (const method of [
      "northwest",
      "matrixMinimum",
      "rowMinimum",
      "columnMinimum",
      "vogel",
      "russell",
    ] as const) {
      const r = solveTransport(tr01, { initial: method });
      expect(r.objective.c, method).toEqual(fr(435));
    }
  });

  it("informa el rango de cada costo en el que la solución no cambia", () => {
    const r = solveTransport(tr01);
    const cell = r.sensitivity[0]![1]!; // x12 básica con costo 2
    expect(cell.basic).toBe(true);
    expect(cell.min.finite ? cell.min.value.le(fr(2)) : true).toBe(true);
    expect(cell.max.finite ? cell.max.value.ge(fr(2)) : true).toBe(true);
    const nonBasic = r.sensitivity[0]![0]!; // x11 no básica
    expect(nonBasic.basic).toBe(false);
    expect(nonBasic.max.finite).toBe(false);
    expect(nonBasic.reducedCost?.isPositive()).toBe(true);
  });

  it("maximización y rutas prohibidas con costo M", () => {
    const max: TransportProblem = { ...tr01, sense: "max" };
    const r = solveTransport(max);
    expect(r.status).toBe("optimal");
    expect(r.objective.c.gt(fr(520))).toBe(true);
    const prohibited: TransportProblem = {
      ...tr01,
      costs: tr01.costs.map((row, i) =>
        row.map((c, j) => (i === 0 && j === 1 ? null : c)),
      ),
    };
    const p = solveTransport(prohibited);
    expect(p.allocation[0]![1] === null || p.allocation[0]![1]!.isZero()).toBe(
      true,
    );
    expect(p.objective.m.isZero()).toBe(true);
    expect(p.objective.c.gt(fr(435))).toBe(true);
  });

  it("el reporte de texto tiene la tabla de asignaciones y el costo total", () => {
    const r = solveTransport(tr01, { initial: "vogel" });
    const text = reportTransport(r);
    expect(text).toContain("Costo total: 435");
    expect(text).toMatch(/Vogel/);
    expect(text).toMatch(/D1\s+D2\s+D3\s+D4/);
    expect(text).toMatch(/O1\s+(0|-)?\s*5\s+(0|-)?\s*(0|-)?\s*10/);
  });
});
