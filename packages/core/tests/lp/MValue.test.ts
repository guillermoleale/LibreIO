// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { MValue } from "../../src/lp";

const fr = (s: string): Fraction => Fraction.parse(s);

describe("MValue (coeficientes aM + b del método de la Big M)", () => {
  it("opera y compara con M dominante", () => {
    const a = MValue.of(fr("1"), fr("2")); // M + 2
    const b = MValue.of(fr("0"), fr("1000")); // 1000
    expect(a.cmp(b)).toBe(1);
    expect(b.cmp(a)).toBe(-1);
    expect(a.add(b).toString()).toBe("M + 1002");
    expect(a.sub(a).isZero()).toBe(true);
    expect(a.mulFraction(fr("-2")).toString()).toBe("-2M - 4");
    expect(MValue.of(fr("-1"), fr("0")).toString()).toBe("-M");
    expect(MValue.of(fr("3/2"), fr("-1/2")).toString()).toBe("3/2M - 1/2");
    expect(MValue.constant(fr("5")).toString()).toBe("5");
    expect(MValue.constant(fr("0")).toString()).toBe("0");
    expect(MValue.of(fr("1"), fr("0")).isNegative()).toBe(false);
    expect(MValue.of(fr("-1"), fr("100")).isNegative()).toBe(true);
    expect(MValue.of(fr("0"), fr("-1")).isNegative()).toBe(true);
  });

  it("se imprime en decimal con el formateador dado", () => {
    const v = MValue.of(fr("1/2"), fr("1/4"));
    expect(v.format((f) => f.toDecimal(2))).toBe("0.50M + 0.25");
    expect(
      MValue.of(fr("-1/2"), fr("-1/4")).format((f) => f.toDecimal(2)),
    ).toBe("-0.50M - 0.25");
    expect(MValue.of(fr("-1"), fr("-1")).format((f) => f.toDecimal(2))).toBe(
      "-M - 1.00",
    );
  });
});
