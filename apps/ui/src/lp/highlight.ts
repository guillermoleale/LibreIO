// SPDX-License-Identifier: GPL-3.0-or-later
// Resaltado de sintaxis básico del formato LINDO para el editor.

export type HighlightKind =
  "keyword" | "comment" | "label" | "number" | "operator" | "variable" | "text";

export interface HighlightToken {
  readonly kind: HighlightKind;
  readonly text: string;
}

const KEYWORDS = new Set([
  "MAX",
  "MAXIMIZE",
  "MAXIMISE",
  "MAXIMIZAR",
  "MIN",
  "MINIMIZE",
  "MINIMISE",
  "MINIMIZAR",
  "SUBJECT",
  "TO",
  "SUCH",
  "THAT",
  "ST",
  "S.T.",
  "END",
  "TITLE",
  "FREE",
  "SLB",
  "SUB",
  "GIN",
  "INT",
]);

const TOKEN =
  /(\s+)|([A-Za-z_][A-Za-z0-9_.]*)|(\d+\.?\d*|\.\d+)|(<=|>=|=<|=>|<|>|=|[-+*/()])|(.)/g;

export function highlightLine(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  const bang = line.indexOf("!");
  const code = bang >= 0 ? line.slice(0, bang) : line;
  const comment = bang >= 0 ? line.slice(bang) : "";
  const isTitle = /^\s*TITLE\b/i.test(code);
  if (isTitle) {
    const match = /^(\s*)(TITLE)(.*)$/i.exec(code)!;
    if (match[1]) {
      tokens.push({ kind: "text", text: match[1] });
    }
    tokens.push({ kind: "keyword", text: match[2]! });
    if (match[3]) {
      tokens.push({ kind: "text", text: match[3] });
    }
  } else {
    let first = true;
    for (const m of code.matchAll(TOKEN)) {
      const [whole, space, ident, number, op, other] = m;
      if (space !== undefined) {
        tokens.push({ kind: "text", text: whole });
        continue;
      }
      if (ident !== undefined) {
        const rest = code.slice(m.index + whole.length);
        if (first && /^\s*\)/.test(rest)) {
          tokens.push({ kind: "label", text: whole });
        } else if (KEYWORDS.has(ident.toUpperCase())) {
          tokens.push({ kind: "keyword", text: whole });
        } else {
          tokens.push({ kind: "variable", text: whole });
        }
        first = false;
        continue;
      }
      first = false;
      if (number !== undefined) {
        tokens.push({ kind: "number", text: whole });
      } else if (op !== undefined) {
        tokens.push({ kind: "operator", text: whole });
      } else if (other !== undefined) {
        tokens.push({ kind: "text", text: whole });
      }
    }
  }
  if (comment) {
    tokens.push({ kind: "comment", text: comment });
  }
  return tokens;
}
