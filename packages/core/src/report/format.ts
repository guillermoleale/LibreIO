// SPDX-License-Identifier: GPL-3.0-or-later
// Utilidades de formato para los reportes de texto monoespaciado.
import { Fraction } from "../rational/Fraction";
import { extendedToString, type Extended } from "../rational/Extended";

export type NumberFormatter = (f: Fraction) => string;

export interface NumberOptions {
  readonly numberFormat?: "fraction" | "decimal";
  readonly decimals?: number;
}

export function numberFormatter(options: NumberOptions = {}): NumberFormatter {
  if (options.numberFormat === "decimal") {
    const decimals = options.decimals ?? 4;
    return (f) => f.toDecimal(decimals);
  }
  return (f) => f.toString();
}

export function extendedFormatter(
  number: NumberFormatter,
  infinityWord = "infinito",
): (x: Extended) => string {
  return (x) => extendedToString(x, number, infinityWord);
}

/** Decimal con `decimals` cifras alineado a la derecha en `width` columnas, como el F de Fortran. */
export function fixed(f: Fraction, width: number, decimals: number): string {
  return f.toDecimal(decimals).padStart(width);
}

export function padLeft(text: string, width: number): string {
  return text.padStart(width);
}

export function padRight(text: string, width: number): string {
  return text.padEnd(width);
}

export type Align = "l" | "r";

/** Tabla de texto: columnas separadas por dos espacios, ancho según el contenido, sin espacios al final. */
export function textTable(
  headers: string[],
  aligns: Align[],
  rows: string[][],
): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const line = (cells: string[]): string =>
    cells
      .map((cell, i) =>
        aligns[i] === "l" ? cell.padEnd(widths[i]!) : cell.padStart(widths[i]!),
      )
      .join("  ")
      .replace(/\s+$/, "");
  return [line(headers), ...rows.map(line)].join("\n");
}
