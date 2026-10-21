// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";

describe("Fraction", () => {
  it("se normaliza siempre: signo en el numerador y denominador positivo sin factores comunes", () => {
    const f = Fraction.of(6, -8);
    expect(f.num).toBe(-3n);
    expect(f.den).toBe(4n);
    expect(Fraction.of(0, 5).toString()).toBe("0");
    expect(Fraction.of(-0, 5).den).toBe(1n);
  });

  it("rechaza el denominador cero", () => {
    expect(() => Fraction.of(1, 0)).toThrow();
    expect(() => Fraction.of(1, 2).div(Fraction.ZERO)).toThrow();
  });

  it("suma, resta, multiplica y divide en forma exacta", () => {
    const a = Fraction.of(1, 3);
    const b = Fraction.of(1, 6);
    expect(a.add(b).toString()).toBe("1/2");
    expect(a.sub(b).toString()).toBe("1/6");
    expect(a.mul(b).toString()).toBe("1/18");
    expect(a.div(b).toString()).toBe("2");
    expect(a.neg().toString()).toBe("-1/3");
    expect(a.neg().abs().toString()).toBe("1/3");
    expect(Fraction.of(-3, 7).inverse().toString()).toBe("-7/3");
  });

  it("no pierde precisión con numeradores grandes", () => {
    const big = Fraction.of(10n ** 30n, 3n);
    const sum = big.add(Fraction.of(2, 3));
    expect(sum.toString()).toBe("333333333333333333333333333334");
  });

  it("compara con cmp, eq, lt, le, gt y ge", () => {
    const a = Fraction.of(2, 3);
    const b = Fraction.of(3, 4);
    expect(a.cmp(b)).toBe(-1);
    expect(b.cmp(a)).toBe(1);
    expect(a.cmp(Fraction.of(4, 6))).toBe(0);
    expect(a.eq(Fraction.of(4, 6))).toBe(true);
    expect(a.lt(b)).toBe(true);
    expect(a.le(a)).toBe(true);
    expect(b.gt(a)).toBe(true);
    expect(b.ge(b)).toBe(true);
    expect(Fraction.max(a, b)).toBe(b);
    expect(Fraction.min(a, b)).toBe(a);
  });

  it("informa signo, cero e integralidad", () => {
    expect(Fraction.ZERO.isZero()).toBe(true);
    expect(Fraction.of(-1, 2).isNegative()).toBe(true);
    expect(Fraction.of(1, 2).isPositive()).toBe(true);
    expect(Fraction.of(-5).sign()).toBe(-1);
    expect(Fraction.ZERO.sign()).toBe(0);
    expect(Fraction.of(4, 2).isInteger()).toBe(true);
    expect(Fraction.of(3, 2).isInteger()).toBe(false);
  });

  it("calcula piso y techo con el signo correcto", () => {
    expect(Fraction.of(7, 2).floor().toString()).toBe("3");
    expect(Fraction.of(7, 2).ceil().toString()).toBe("4");
    expect(Fraction.of(-7, 2).floor().toString()).toBe("-4");
    expect(Fraction.of(-7, 2).ceil().toString()).toBe("-3");
    expect(Fraction.of(4).floor().toString()).toBe("4");
    expect(Fraction.of(7, 2).fractionalPart().toString()).toBe("1/2");
  });

  it("se imprime con formato 7/3 y los enteros sin denominador", () => {
    expect(Fraction.of(7, 3).toString()).toBe("7/3");
    expect(Fraction.of(-7, 3).toString()).toBe("-7/3");
    expect(Fraction.of(12, 4).toString()).toBe("3");
    expect(Fraction.of(-12, 4).toString()).toBe("-3");
  });

  it("convierte a decimal con n cifras, redondeando a la mitad hacia afuera", () => {
    expect(Fraction.of(1, 3).toDecimal(6)).toBe("0.333333");
    expect(Fraction.of(2, 3).toDecimal(6)).toBe("0.666667");
    expect(Fraction.of(-1, 3).toDecimal(4)).toBe("-0.3333");
    expect(Fraction.of(180).toDecimal(4)).toBe("180.0000");
    expect(Fraction.of(1, 2).toDecimal(0)).toBe("1");
    expect(Fraction.of(-1, 2).toDecimal(0)).toBe("-1");
    expect(Fraction.of(5, 8).toDecimal(2)).toBe("0.63");
    expect(Fraction.of(-1, 1000).toDecimal(2)).toBe("0.00");
  });

  it("convierte a número de punto flotante", () => {
    expect(Fraction.of(1, 4).toNumber()).toBe(0.25);
    expect(Fraction.of(-7, 2).toNumber()).toBe(-3.5);
    expect(Fraction.of(1, 3).toNumber()).toBeCloseTo(1 / 3, 15);
  });

  it("parsea enteros, decimales, fracciones y signos", () => {
    expect(Fraction.parse("7").toString()).toBe("7");
    expect(Fraction.parse("-7").toString()).toBe("-7");
    expect(Fraction.parse("+7").toString()).toBe("7");
    expect(Fraction.parse("0.25").toString()).toBe("1/4");
    expect(Fraction.parse(".5").toString()).toBe("1/2");
    expect(Fraction.parse("2.").toString()).toBe("2");
    expect(Fraction.parse("-1.125").toString()).toBe("-9/8");
    expect(Fraction.parse("1/3").toString()).toBe("1/3");
    expect(Fraction.parse("-6/4").toString()).toBe("-3/2");
    expect(Fraction.parse(" 3 ").toString()).toBe("3");
    expect(Fraction.parse("1e3").toString()).toBe("1000");
    expect(Fraction.parse("2.5e-1").toString()).toBe("1/4");
  });

  it("rechaza textos que no son números", () => {
    expect(() => Fraction.parse("abc")).toThrow();
    expect(() => Fraction.parse("")).toThrow();
    expect(() => Fraction.parse("1/0")).toThrow();
    expect(() => Fraction.parse("1/2/3")).toThrow();
  });

  it("construye desde números de punto flotante exactos", () => {
    expect(Fraction.fromNumber(0.5).toString()).toBe("1/2");
    expect(Fraction.fromNumber(-3).toString()).toBe("-3");
    expect(Fraction.fromNumber(0.1).toString()).toBe("1/10");
    expect(() => Fraction.fromNumber(Number.NaN)).toThrow();
    expect(() => Fraction.fromNumber(Number.POSITIVE_INFINITY)).toThrow();
  });

  it("suma listas con sum", () => {
    expect(
      Fraction.sum([
        Fraction.of(1, 2),
        Fraction.of(1, 3),
        Fraction.of(1, 6),
      ]).toString(),
    ).toBe("1");
    expect(Fraction.sum([]).toString()).toBe("0");
  });
});
