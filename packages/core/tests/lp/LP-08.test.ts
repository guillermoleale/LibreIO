// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación LP-08: verificación cruzada de 200 problemas aleatorios contra highs.
import { beforeAll, describe, expect, it } from "vitest";
import loadHighs from "highs";
import { Fraction } from "../../src/rational/Fraction";
import type { LPModel, Relation } from "../../src/parser";
import { solveLP } from "../../src/lp";

type Highs = Awaited<ReturnType<typeof loadHighs>>;

/** Generador determinista (mulberry32) para que la semilla fija dé siempre los mismos problemas. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function randomModel(rng: () => number): LPModel {
  const n = randomInt(rng, 2, 6);
  const m = randomInt(rng, 2, 6);
  const relations: Relation[] = ["<=", ">=", "="];
  const variables = Array.from({ length: n }, (_, i) => ({
    name: `X${i + 1}`,
    lower: { finite: true, value: Fraction.ZERO } as const,
    upper: { finite: false, sign: 1 } as const,
    kind: "continuous" as const,
  }));
  const objective = Array.from({ length: n }, () =>
    Fraction.of(randomInt(rng, -9, 9)),
  );
  const constraints = Array.from({ length: m }, (_, i) => ({
    label: null,
    row: i + 2,
    coefficients: Array.from({ length: n }, () =>
      Fraction.of(randomInt(rng, -9, 9)),
    ),
    relation: relations[randomInt(rng, 0, 2)]!,
    rhs: Fraction.of(randomInt(rng, 1, 50)),
  }));
  return {
    title: null,
    sense: rng() < 0.5 ? "max" : "min",
    variables,
    objective,
    constraints,
  };
}

function toCplexLp(model: LPModel): string {
  const names = model.variables.map((v) => v.name);
  const expr = (coefs: Fraction[]): string =>
    coefs
      .map(
        (c, i) =>
          `${c.isNegative() ? "-" : "+"} ${c.abs().toString()} ${names[i]}`,
      )
      .join(" ");
  const lines = [
    model.sense === "max" ? "Maximize" : "Minimize",
    ` obj: ${expr(model.objective)}`,
    "Subject To",
  ];
  model.constraints.forEach((c, i) => {
    lines.push(
      ` c${i + 1}: ${expr(c.coefficients)} ${c.relation} ${c.rhs.toString()}`,
    );
  });
  lines.push("Bounds");
  for (const name of names) {
    lines.push(` ${name} >= 0`);
  }
  lines.push("End");
  return lines.join("\n");
}

describe("LP-08. Verificación cruzada contra highs", () => {
  let highs: Highs;

  beforeAll(async () => {
    highs = await loadHighs();
  });

  it("200 problemas aleatorios con semilla fija dan el mismo estado y valor objetivo", () => {
    const rng = mulberry32(20261021);
    const counts = { optimal: 0, unbounded: 0, infeasible: 0 };
    for (let k = 0; k < 200; k += 1) {
      const model = randomModel(rng);
      const ours = solveLP(model);
      // Sin presolve: con presolve HiGHS informa "Infeasible" en algunos problemas ilimitados
      const theirs = highs.solve(toCplexLp(model), {
        output_flag: false,
        presolve: "off",
      });
      const label = `problema ${k}`;
      if (theirs.Status === "Optimal") {
        expect(ours.status, label).toBe("optimal");
        expect(
          Math.abs(ours.solution!.objective.toNumber() - theirs.ObjectiveValue),
          label,
        ).toBeLessThan(1e-9);
        counts.optimal += 1;
      } else if (theirs.Status === "Infeasible") {
        expect(ours.status, label).toBe("infeasible");
        counts.infeasible += 1;
      } else if (theirs.Status === "Unbounded") {
        expect(ours.status, label).toBe("unbounded");
        counts.unbounded += 1;
      } else {
        // Estados ambiguos de highs (por ejemplo unbounded or infeasible): nuestro estado debe ser uno de los dos
        expect(
          ["unbounded", "infeasible"],
          `${label}: ${theirs.Status}`,
        ).toContain(ours.status);
      }
    }
    // Las tres clases aparecen en la muestra, para que el test tenga sentido
    expect(counts.optimal).toBeGreaterThan(0);
    expect(counts.infeasible).toBeGreaterThan(0);
    expect(counts.unbounded).toBeGreaterThan(0);
  }, 60_000);

  it("Big M y Bland coinciden con dos fases y Dantzig en los primeros 50 problemas", () => {
    const rng = mulberry32(20261021);
    for (let k = 0; k < 50; k += 1) {
      const model = randomModel(rng);
      const base = solveLP(model);
      const bigM = solveLP(model, { method: "bigM" });
      const bland = solveLP(model, { rule: "bland" });
      expect(bigM.status, `problema ${k} bigM`).toBe(base.status);
      expect(bland.status, `problema ${k} bland`).toBe(base.status);
      if (base.status === "optimal") {
        expect(bigM.solution!.objective, `problema ${k} bigM`).toEqual(
          base.solution!.objective,
        );
        expect(bland.solution!.objective, `problema ${k} bland`).toEqual(
          base.solution!.objective,
        );
      }
    }
  }, 60_000);
});
