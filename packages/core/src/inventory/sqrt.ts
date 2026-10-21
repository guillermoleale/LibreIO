// SPDX-License-Identifier: GPL-3.0-or-later
// Raíz cuadrada de una fracción: exacta cuando numerador y denominador son cuadrados perfectos.
import { Fraction } from "../rational/Fraction";

function isqrt(n: bigint): bigint {
  if (n < 2n) {
    return n;
  }
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (x * x > n) {
    x -= 1n;
  }
  while ((x + 1n) * (x + 1n) <= n) {
    x += 1n;
  }
  return x;
}

export function sqrtFraction(f: Fraction): { value: Fraction; exact: boolean } {
  if (f.isNegative()) {
    throw new RangeError("Raíz cuadrada de un número negativo");
  }
  const n = isqrt(f.num);
  const d = isqrt(f.den);
  if (n * n === f.num && d * d === f.den) {
    return { value: Fraction.of(n, d), exact: true };
  }
  return { value: Fraction.fromNumber(Math.sqrt(f.toNumber())), exact: false };
}
