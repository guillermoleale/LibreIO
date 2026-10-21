// SPDX-License-Identifier: GPL-3.0-or-later
// Ayudas para el modo guiado de la interfaz: cerrar una fase y seguir con la siguiente.
import { describe, expect, it } from "vitest";
import { parseLP } from "../../src/parser";
import {
  analyzeTableau,
  finishPhase,
  initialTableau,
  manualPivot,
  toStandardForm,
} from "../../src/lp";

describe("finishPhase", () => {
  it("al terminar la fase 1 sin artificiales positivas pasa a la fase 2 con la función objetivo original", () => {
    const model = parseLP("MIN 2X + 3Y\nST\nX + Y >= 4\nX + 3Y >= 6\nEND");
    const sf = toStandardForm(model);
    let t = initialTableau(sf, "twoPhase");
    expect(t.phase).toBe("phase1");
    for (let guard = 0; guard < 10; guard += 1) {
      const a = analyzeTableau(t, "dantzig");
      if (a.kind !== "pivot") {
        break;
      }
      const outcome = manualPivot(t, t.columns[a.entering]!.name);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        t = outcome.next;
      }
    }
    const finished = finishPhase(t, sf);
    expect(finished.kind).toBe("phase2");
    if (finished.kind === "phase2") {
      expect(finished.tableau.phase).toBe("phase2");
      expect(finished.tableau.objectiveValue.c.isZero()).toBe(false);
    }
  });

  it("al terminar la fase 1 con una artificial positiva informa infactibilidad", () => {
    const model = parseLP("MAX X + Y\nST\nX + Y <= 2\nX + Y >= 4\nEND");
    const sf = toStandardForm(model);
    let t = initialTableau(sf, "twoPhase");
    for (let guard = 0; guard < 10; guard += 1) {
      const a = analyzeTableau(t, "dantzig");
      if (a.kind !== "pivot") {
        break;
      }
      const outcome = manualPivot(t, t.columns[a.entering]!.name);
      if (outcome.ok) {
        t = outcome.next;
      }
    }
    const finished = finishPhase(t, sf);
    expect(finished.kind).toBe("infeasible");
    if (finished.kind === "infeasible") {
      expect(finished.infeasibility[0]?.artificial).toBe("ART 3");
    }
  });

  it("en la fase 2 o con Big M el tableau óptimo cierra el problema", () => {
    const model = parseLP(
      "MAX 3X + 2Y\nST\n2X + Y <= 100\nX + Y <= 80\nX <= 40\nEND",
    );
    const sf = toStandardForm(model);
    const t = initialTableau(sf, "twoPhase");
    expect(finishPhase(t, sf).kind).toBe("notOptimal");
    let current = t;
    for (let guard = 0; guard < 10; guard += 1) {
      const a = analyzeTableau(current, "dantzig");
      if (a.kind !== "pivot") {
        break;
      }
      const outcome = manualPivot(current, current.columns[a.entering]!.name);
      if (outcome.ok) {
        current = outcome.next;
      }
    }
    const finished = finishPhase(current, sf);
    expect(finished.kind).toBe("optimal");
    if (finished.kind === "optimal") {
      expect(finished.objective.toString()).toBe("180");
    }
  });
});
