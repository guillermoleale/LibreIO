// SPDX-License-Identifier: GPL-3.0-or-later
// Coeficiente simbólico aM + b del método de la Big M. M es más grande que cualquier número.
import { Fraction } from "../rational/Fraction";

export class MValue {
  readonly m: Fraction;
  readonly c: Fraction;

  private constructor(m: Fraction, c: Fraction) {
    this.m = m;
    this.c = c;
  }

  static readonly ZERO = new MValue(Fraction.ZERO, Fraction.ZERO);
  static readonly M = new MValue(Fraction.ONE, Fraction.ZERO);

  static of(m: Fraction, c: Fraction): MValue {
    if (m.isZero() && c.isZero()) {
      return MValue.ZERO;
    }
    return new MValue(m, c);
  }

  static constant(c: Fraction): MValue {
    return MValue.of(Fraction.ZERO, c);
  }

  add(other: MValue): MValue {
    return MValue.of(this.m.add(other.m), this.c.add(other.c));
  }

  sub(other: MValue): MValue {
    return MValue.of(this.m.sub(other.m), this.c.sub(other.c));
  }

  neg(): MValue {
    return MValue.of(this.m.neg(), this.c.neg());
  }

  mulFraction(f: Fraction): MValue {
    return MValue.of(this.m.mul(f), this.c.mul(f));
  }

  /** Orden lexicográfico: primero el coeficiente de M, después la constante. */
  cmp(other: MValue): -1 | 0 | 1 {
    const byM = this.m.cmp(other.m);
    return byM !== 0 ? byM : this.c.cmp(other.c);
  }

  isZero(): boolean {
    return this.m.isZero() && this.c.isZero();
  }

  isNegative(): boolean {
    return this.m.isNegative() || (this.m.isZero() && this.c.isNegative());
  }

  isPositive(): boolean {
    return this.m.isPositive() || (this.m.isZero() && this.c.isPositive());
  }

  /** Por ejemplo "3/2M - 1/2", "M + 2", "-M" o "5". */
  format(number: (f: Fraction) => string): string {
    if (this.m.isZero()) {
      return this.c.isNegative() ? `-${number(this.c.abs())}` : number(this.c);
    }
    const magnitude = this.m.abs();
    const coefficient = magnitude.eq(Fraction.ONE) ? "" : number(magnitude);
    let text = `${this.m.isNegative() ? "-" : ""}${coefficient}M`;
    if (!this.c.isZero()) {
      text += ` ${this.c.isNegative() ? "-" : "+"} ${number(this.c.abs())}`;
    }
    return text;
  }

  toString(): string {
    return this.format((f) => f.toString());
  }
}
