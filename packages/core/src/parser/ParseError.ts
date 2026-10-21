// SPDX-License-Identifier: GPL-3.0-or-later

/** Error de sintaxis con número de línea (desde 1) y mensaje en español. */
export class ParseError extends Error {
  readonly line: number;

  constructor(line: number, message: string) {
    super(message);
    this.name = "ParseError";
    this.line = line;
  }

  override toString(): string {
    return `Línea ${this.line}: ${this.message}`;
  }
}
