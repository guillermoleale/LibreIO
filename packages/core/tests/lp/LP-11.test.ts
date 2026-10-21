// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación LP-11: pivoteo manual sobre LP-01.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { parseLP } from "../../src/parser";
import {
  initialTableau,
  manualPivot,
  solveLP,
  toStandardForm,
} from "../../src/lp";

const fr = (s: string): Fraction => Fraction.parse(s);

const texto = `MAX 3X + 2Y
SUBJECT TO
  2X + Y <= 100
  X + Y <= 80
  X <= 40
END`;

describe("LP-11. Pivoteo manual", () => {
  const model = parseLP(texto);
  const sf = toStandardForm(model);
  const t0 = initialTableau(sf, "twoPhase");

  it("acepta que entre Y, avisa que no es la elección de Dantzig y sale SLK 3 con razón 80", () => {
    const outcome = manualPivot(t0, "Y");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.dantzig).toBe(false);
    expect(outcome.warning).toMatch(/Dantzig/);
    expect(outcome.warning).toContain("X");
    expect(outcome.step.leavingName).toBe("SLK 3");
    expect(outcome.step.ratios).toEqual([fr("100"), fr("80"), null]);
    expect(outcome.step.pivotRow).toBe(1);
    const next = outcome.next;
    const basisNames = next.basis.map((col) => next.columns[col]!.name);
    expect(basisNames).toEqual(["SLK 2", "Y", "SLK 4"]);
    expect(next.rhs[1]).toEqual(fr("80"));
    expect(next.objectiveValue.c).toEqual(fr("160"));
  });

  it("acepta la elección de Dantzig sin aviso", () => {
    const outcome = manualPivot(t0, "X");
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.dantzig).toBe(true);
      expect(outcome.warning).toBeNull();
      expect(outcome.step.leavingName).toBe("SLK 4");
    }
  });

  it("permite elegir también la variable que sale si su razón es finita y avisa si no es la mínima", () => {
    const outcome = manualPivot(t0, "X", "SLK 2");
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.step.leavingName).toBe("SLK 2");
      expect(outcome.warning).toMatch(/razón mínima/i);
      // Al no respetar la razón mínima, el tableau siguiente deja de ser factible
      expect(outcome.next.rhs.some((v) => v.isNegative())).toBe(true);
    }
    const invalid = manualPivot(t0, "X", "Y");
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error).toMatch(/básica/);
    }
    const noRatio = manualPivot(t0, "Y", "SLK 4");
    expect(noRatio.ok).toBe(false);
  });

  it("rechaza una variable con costo reducido que no mejora sin modificar el tableau", () => {
    const snapshot = JSON.stringify(t0, (_, v: unknown) =>
      typeof v === "bigint" ? v.toString() : v,
    );
    const outcome = manualPivot(t0, "SLK 2");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toMatch(/SLK 2/);
      expect(outcome.error).toMatch(/no mejora/i);
    }
    expect(
      JSON.stringify(t0, (_, v: unknown) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    ).toBe(snapshot);
    const unknown = manualPivot(t0, "W");
    expect(unknown.ok).toBe(false);
    const basic = manualPivot(t0, "SLK 4");
    expect(basic.ok).toBe(false);
  });

  it("en el tableau óptimo ninguna variable mejora", () => {
    const final = solveLP(model).trace.at(-1)!.tableau;
    for (const col of final.columns) {
      expect(manualPivot(final, col.name).ok).toBe(false);
    }
  });
});
