// SPDX-License-Identifier: GPL-3.0-or-later
// Valor extendido: una fracción o un infinito simbólico. Se usa en cotas y rangos de sensibilidad.
import { Fraction } from "./Fraction";

export type Extended =
  | { readonly finite: true; readonly value: Fraction }
  | { readonly finite: false; readonly sign: 1 | -1 };

export const INFINITY: Extended = { finite: false, sign: 1 };
export const NEG_INFINITY: Extended = { finite: false, sign: -1 };

export function finite(value: Fraction): Extended {
  return { finite: true, value };
}

export function isFinite(
  x: Extended,
): x is { readonly finite: true; readonly value: Fraction } {
  return x.finite;
}

export function compareExtended(a: Extended, b: Extended): -1 | 0 | 1 {
  if (a.finite && b.finite) {
    return a.value.cmp(b.value);
  }
  const sa = a.finite ? 0 : a.sign;
  const sb = b.finite ? 0 : b.sign;
  if (sa < sb) {
    return -1;
  }
  return sa > sb ? 1 : 0;
}

/** Imprime el valor con el formato dado para fracciones y la palabra elegida para el infinito. */
export function extendedToString(
  x: Extended,
  format: (f: Fraction) => string = (f) => f.toString(),
  infinityWord = "infinito",
): string {
  if (x.finite) {
    return format(x.value);
  }
  return x.sign > 0 ? infinityWord : `-${infinityWord}`;
}
