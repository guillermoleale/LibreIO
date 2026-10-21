// SPDX-License-Identifier: GPL-3.0-or-later
import { extendedToString, type Extended, type Fraction } from "@libreio/core";

export type NumberFormat = "fraction" | "decimal";

export const DECIMALS = 4;

export function makeFormatter(format: NumberFormat): (f: Fraction) => string {
  return format === "decimal"
    ? (f) => f.toDecimal(DECIMALS)
    : (f) => f.toString();
}

export function formatExtended(
  x: Extended,
  number: (f: Fraction) => string,
): string {
  return extendedToString(x, number, "∞");
}
