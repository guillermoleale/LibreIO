// SPDX-License-Identifier: GPL-3.0-or-later
// Tokenizador por línea del formato LINDO. No lanza errores: produce tokens `invalid`
// que el parser convierte en ParseError cuando los alcanza, para informar la primera línea con problemas.

export type TokenType = "number" | "ident" | "op" | "invalid" | "eol" | "eof";

export interface Token {
  readonly type: TokenType;
  readonly text: string;
  readonly line: number;
  /** Columna de inicio, desde 0. */
  readonly start: number;
  /** Columna de fin exclusiva. */
  readonly end: number;
  /** Mensaje de error para tokens `invalid`. */
  readonly message?: string;
}

const NUMBER = /^(?:\d+\.?\d*|\.\d+)/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_.]*/;
const RELATIONAL = new Set(["<=", ">=", "=<", "=>", "<", ">", "="]);
const SINGLE_OPS = new Set(["+", "-", "*", "/", "(", ")"]);

export function tokenizeLine(text: string, line: number): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === " " || ch === "\t" || ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "!") {
      break;
    }
    const rest = text.slice(i);
    const number = NUMBER.exec(rest);
    if (number) {
      tokens.push({
        type: "number",
        text: number[0],
        line,
        start: i,
        end: i + number[0].length,
      });
      i += number[0].length;
      continue;
    }
    const ident = IDENT.exec(rest);
    if (ident) {
      const word = ident[0];
      const upper = word.toUpperCase();
      if (word.includes(".") && upper !== "S.T." && upper !== "S.T") {
        tokens.push({
          type: "invalid",
          text: word,
          line,
          start: i,
          end: i + word.length,
          message: `El nombre '${word}' no es válido: solo se admiten letras, dígitos y guion bajo`,
        });
      } else {
        tokens.push({
          type: "ident",
          text: word,
          line,
          start: i,
          end: i + word.length,
        });
      }
      i += word.length;
      continue;
    }
    if (ch === "<" || ch === ">" || ch === "=") {
      let op = ch;
      const next = text[i + 1];
      if (next === "<" || next === ">" || next === "=") {
        op += next;
      }
      if (RELATIONAL.has(op)) {
        tokens.push({
          type: "op",
          text: op,
          line,
          start: i,
          end: i + op.length,
        });
      } else {
        tokens.push({
          type: "invalid",
          text: op,
          line,
          start: i,
          end: i + op.length,
          message: `Operador desconocido '${op}'. Se admiten <=, >=, =, <, >, =< y =>`,
        });
      }
      i += op.length;
      continue;
    }
    if (SINGLE_OPS.has(ch)) {
      tokens.push({ type: "op", text: ch, line, start: i, end: i + 1 });
      i += 1;
      continue;
    }
    tokens.push({
      type: "invalid",
      text: ch,
      line,
      start: i,
      end: i + 1,
      message: `Carácter no reconocido '${ch}'`,
    });
    i += 1;
  }
  return tokens;
}

/** Tokeniza todas las líneas y separa cada una con un token `eol`. Termina con `eof`. */
export function tokenize(lines: readonly string[]): Token[] {
  const tokens: Token[] = [];
  lines.forEach((text, index) => {
    const line = index + 1;
    tokens.push(...tokenizeLine(text, line));
    tokens.push({
      type: "eol",
      text: "",
      line,
      start: text.length,
      end: text.length,
    });
  });
  const lastLine = Math.max(1, lines.length);
  tokens.push({ type: "eof", text: "", line: lastLine, start: 0, end: 0 });
  return tokens;
}
