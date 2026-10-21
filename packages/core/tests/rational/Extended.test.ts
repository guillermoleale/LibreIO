// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import {
  INFINITY,
  NEG_INFINITY,
  compareExtended,
  extendedToString,
  finite,
  isFinite,
} from "../../src/rational/Extended";

describe("Extended (infinito simbólico)", () => {
  it("distingue finitos de infinitos", () => {
    expect(isFinite(finite(Fraction.ONE))).toBe(true);
    expect(isFinite(INFINITY)).toBe(false);
    expect(isFinite(NEG_INFINITY)).toBe(false);
  });

  it("compara con el orden extendido", () => {
    const uno = finite(Fraction.ONE);
    const dos = finite(Fraction.of(2));
    expect(compareExtended(uno, dos)).toBe(-1);
    expect(compareExtended(dos, uno)).toBe(1);
    expect(compareExtended(uno, uno)).toBe(0);
    expect(compareExtended(uno, INFINITY)).toBe(-1);
    expect(compareExtended(INFINITY, uno)).toBe(1);
    expect(compareExtended(NEG_INFINITY, uno)).toBe(-1);
    expect(compareExtended(INFINITY, INFINITY)).toBe(0);
    expect(compareExtended(NEG_INFINITY, INFINITY)).toBe(-1);
  });

  it("se imprime como fracción, decimal o infinito", () => {
    expect(extendedToString(finite(Fraction.of(3, 2)))).toBe("3/2");
    expect(
      extendedToString(finite(Fraction.of(3, 2)), (f) => f.toDecimal(2)),
    ).toBe("1.50");
    expect(extendedToString(INFINITY)).toBe("infinito");
    expect(extendedToString(NEG_INFINITY)).toBe("-infinito");
    expect(extendedToString(INFINITY, undefined, "INFINITY")).toBe("INFINITY");
    expect(extendedToString(NEG_INFINITY, undefined, "INFINITY")).toBe(
      "-INFINITY",
    );
  });
});
