// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación AS-01: asignación con el método húngaro.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { solveAssignment, type AssignmentProblem } from "../../src/transport";
import { reportAssignment } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));
const row = (values: number[]) => values.map((v) => fr(v));

const problem: AssignmentProblem = {
  title: "AS-01",
  sense: "min",
  agents: ["1", "2", "3"],
  tasks: ["1", "2", "3"],
  costs: [row([9, 2, 7]), row([6, 4, 3]), row([5, 8, 1])],
};

describe("AS-01. Asignación con método húngaro", () => {
  it("asigna 1 a 2, 2 a 1 y 3 a 3 con costo 9", () => {
    const r = solveAssignment(problem);
    expect(r.status).toBe("optimal");
    expect(r.objective).toEqual(fr(9));
    expect(r.assignment).toEqual([
      { agent: 0, task: 1 },
      { agent: 1, task: 0 },
      { agent: 2, task: 2 },
    ]);
  });

  it("la traza muestra la reducción por filas, por columnas y la cobertura de ceros", () => {
    const r = solveAssignment(problem);
    const kinds = r.steps.map((s) => s.kind);
    expect(kinds[0]).toBe("start");
    expect(kinds[1]).toBe("rowReduction");
    expect(kinds[2]).toBe("columnReduction");
    expect(kinds).toContain("cover");
    const afterRows = r.steps[1]!.matrix.map((row) =>
      row.map((v) => v.c.toString()),
    );
    expect(afterRows).toEqual([
      ["7", "0", "5"],
      ["3", "1", "0"],
      ["4", "7", "0"],
    ]);
    const afterColumns = r.steps[2]!.matrix.map((row) =>
      row.map((v) => v.c.toString()),
    );
    expect(afterColumns).toEqual([
      ["4", "0", "5"],
      ["0", "1", "0"],
      ["1", "7", "0"],
    ]);
    const cover = r.steps.find((s) => s.kind === "cover")!;
    expect(cover.coveredRows!.length + cover.coveredColumns!.length).toBe(3);
  });

  it("ajusta la matriz cuando faltan líneas y maneja desbalance, maximización y asignaciones prohibidas", () => {
    const needsAdjust = solveAssignment({
      title: null,
      sense: "min",
      agents: ["A", "B", "C"],
      tasks: ["1", "2", "3"],
      costs: [row([1, 2, 3]), row([2, 4, 6]), row([3, 6, 9])],
    });
    expect(needsAdjust.steps.some((s) => s.kind === "adjust")).toBe(true);
    expect(needsAdjust.objective).toEqual(fr(10));

    const unbalanced = solveAssignment({
      title: null,
      sense: "min",
      agents: ["A", "B"],
      tasks: ["1", "2", "3"],
      costs: [row([4, 1, 5]), row([2, 0, 6])],
    });
    expect(unbalanced.objective).toEqual(fr(3));
    expect(unbalanced.assignment).toEqual([
      { agent: 0, task: 1 },
      { agent: 1, task: 0 },
    ]);
    expect(unbalanced.balanced).toEqual({ kind: "agent", amount: 1 });

    const max = solveAssignment({ ...problem, sense: "max" });
    expect(max.objective).toEqual(fr(21));
    expect(max.assignment).toEqual([
      { agent: 0, task: 2 },
      { agent: 1, task: 0 },
      { agent: 2, task: 1 },
    ]);

    const prohibited = solveAssignment({
      ...problem,
      costs: [row([9, 2, 7]), row([6, 4, 3]), [null, fr(8), fr(1)]],
    });
    expect(prohibited.objective).toEqual(fr(9));
    const impossible = solveAssignment({
      ...problem,
      costs: [
        [null, null, fr(7)],
        [null, null, fr(3)],
        [null, null, fr(1)],
      ],
    });
    expect(impossible.status).toBe("infeasible");
  });

  it("el reporte lista las asignaciones y el costo", () => {
    const text = reportAssignment(solveAssignment(problem));
    expect(text).toContain("Costo total: 9");
    expect(text).toMatch(/1\s*->\s*2\s+2/);
  });
});
