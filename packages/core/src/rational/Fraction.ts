// SPDX-License-Identifier: GPL-3.0-or-later
// Fracción exacta sobre BigInt. Siempre normalizada: denominador positivo y sin factores comunes.

const DECIMAL_PATTERN = /^\s*([+-]?)(\d+\.?\d*|\.\d+)(?:[eE]([+-]?\d+))?\s*$/;
const FRACTION_PATTERN = /^\s*([+-]?\d+)\s*\/\s*(\d+)\s*$/;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

function toBigInt(value: number | bigint, what: string): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (!Number.isInteger(value)) {
    throw new RangeError(`El ${what} debe ser entero: ${value}`);
  }
  return BigInt(value);
}

export class Fraction {
  readonly num: bigint;
  readonly den: bigint;

  private constructor(num: bigint, den: bigint) {
    this.num = num;
    this.den = den;
  }

  static readonly ZERO = new Fraction(0n, 1n);
  static readonly ONE = new Fraction(1n, 1n);
  static readonly MINUS_ONE = new Fraction(-1n, 1n);

  /** Construye num/den normalizando signo y factores comunes. */
  static of(num: number | bigint, den: number | bigint = 1): Fraction {
    let n = toBigInt(num, "numerador");
    let d = toBigInt(den, "denominador");
    if (d === 0n) {
      throw new RangeError("División por cero");
    }
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    if (g > 1n) {
      n /= g;
      d /= g;
    }
    if (n === 0n) {
      return Fraction.ZERO;
    }
    if (n === 1n && d === 1n) {
      return Fraction.ONE;
    }
    return new Fraction(n, d);
  }

  /** Parsea enteros, decimales (con exponente opcional) y fracciones como 1/3. */
  static parse(text: string): Fraction {
    const fraction = FRACTION_PATTERN.exec(text);
    if (fraction) {
      const den = BigInt(fraction[2]!);
      if (den === 0n) {
        throw new RangeError(`División por cero en '${text.trim()}'`);
      }
      return Fraction.of(BigInt(fraction[1]!), den);
    }
    const decimal = DECIMAL_PATTERN.exec(text);
    if (!decimal) {
      throw new SyntaxError(`'${text}' no es un número`);
    }
    const sign = decimal[1] === "-" ? -1n : 1n;
    const body = decimal[2]!;
    const exponent = decimal[3] ? Number.parseInt(decimal[3], 10) : 0;
    const dot = body.indexOf(".");
    const integerPart = dot >= 0 ? body.slice(0, dot) : body;
    const fractionalPart = dot >= 0 ? body.slice(dot + 1) : "";
    const digits = BigInt((integerPart || "0") + fractionalPart);
    const scale = fractionalPart.length - exponent;
    if (scale >= 0) {
      return Fraction.of(sign * digits, 10n ** BigInt(scale));
    }
    return Fraction.of(sign * digits * 10n ** BigInt(-scale), 1n);
  }

  /** Convierte un número de punto flotante usando su representación decimal más corta. */
  static fromNumber(value: number): Fraction {
    if (!Number.isFinite(value)) {
      throw new RangeError(`No se puede convertir ${value} a fracción`);
    }
    return Fraction.parse(String(value));
  }

  static sum(values: Iterable<Fraction>): Fraction {
    let total = Fraction.ZERO;
    for (const v of values) {
      total = total.add(v);
    }
    return total;
  }

  static max(a: Fraction, b: Fraction): Fraction {
    return a.cmp(b) >= 0 ? a : b;
  }

  static min(a: Fraction, b: Fraction): Fraction {
    return a.cmp(b) <= 0 ? a : b;
  }

  add(other: Fraction): Fraction {
    if (this.den === other.den) {
      return Fraction.of(this.num + other.num, this.den);
    }
    return Fraction.of(
      this.num * other.den + other.num * this.den,
      this.den * other.den,
    );
  }

  sub(other: Fraction): Fraction {
    if (this.den === other.den) {
      return Fraction.of(this.num - other.num, this.den);
    }
    return Fraction.of(
      this.num * other.den - other.num * this.den,
      this.den * other.den,
    );
  }

  mul(other: Fraction): Fraction {
    return Fraction.of(this.num * other.num, this.den * other.den);
  }

  div(other: Fraction): Fraction {
    if (other.num === 0n) {
      throw new RangeError("División por cero");
    }
    return Fraction.of(this.num * other.den, this.den * other.num);
  }

  neg(): Fraction {
    return this.num === 0n ? this : new Fraction(-this.num, this.den);
  }

  abs(): Fraction {
    return this.num < 0n ? new Fraction(-this.num, this.den) : this;
  }

  inverse(): Fraction {
    return Fraction.ONE.div(this);
  }

  cmp(other: Fraction): -1 | 0 | 1 {
    const left = this.num * other.den;
    const right = other.num * this.den;
    if (left < right) {
      return -1;
    }
    return left > right ? 1 : 0;
  }

  eq(other: Fraction): boolean {
    return this.num === other.num && this.den === other.den;
  }

  lt(other: Fraction): boolean {
    return this.cmp(other) < 0;
  }

  le(other: Fraction): boolean {
    return this.cmp(other) <= 0;
  }

  gt(other: Fraction): boolean {
    return this.cmp(other) > 0;
  }

  ge(other: Fraction): boolean {
    return this.cmp(other) >= 0;
  }

  isZero(): boolean {
    return this.num === 0n;
  }

  isNegative(): boolean {
    return this.num < 0n;
  }

  isPositive(): boolean {
    return this.num > 0n;
  }

  sign(): -1 | 0 | 1 {
    if (this.num < 0n) {
      return -1;
    }
    return this.num > 0n ? 1 : 0;
  }

  isInteger(): boolean {
    return this.den === 1n;
  }

  floor(): Fraction {
    let q = this.num / this.den;
    if (this.num % this.den !== 0n && this.num < 0n) {
      q -= 1n;
    }
    return Fraction.of(q, 1n);
  }

  ceil(): Fraction {
    let q = this.num / this.den;
    if (this.num % this.den !== 0n && this.num > 0n) {
      q += 1n;
    }
    return Fraction.of(q, 1n);
  }

  /** Parte fraccionaria no negativa: x - piso(x). */
  fractionalPart(): Fraction {
    return this.sub(this.floor());
  }

  /** Formato 7/3. Los enteros se imprimen sin denominador. */
  toString(): string {
    return this.den === 1n ? this.num.toString() : `${this.num}/${this.den}`;
  }

  /** Decimal con exactamente `digits` cifras, redondeado a la mitad hacia afuera del cero. */
  toDecimal(digits: number): string {
    const places = Math.max(0, Math.trunc(digits));
    const scale = 10n ** BigInt(places);
    const magnitude = this.num < 0n ? -this.num : this.num;
    const scaled = magnitude * scale;
    let rounded = scaled / this.den;
    const remainder = scaled % this.den;
    if (remainder * 2n >= this.den) {
      rounded += 1n;
    }
    const sign = this.num < 0n && rounded !== 0n ? "-" : "";
    if (places === 0) {
      return `${sign}${rounded}`;
    }
    const integerPart = rounded / scale;
    const fractionalPart = (rounded % scale).toString().padStart(places, "0");
    return `${sign}${integerPart}.${fractionalPart}`;
  }

  toNumber(): number {
    const magnitude = this.num < 0n ? -this.num : this.num;
    if (magnitude <= MAX_SAFE && this.den <= MAX_SAFE) {
      return Number(this.num) / Number(this.den);
    }
    return Number(this.toDecimal(20));
  }
}
