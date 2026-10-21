// SPDX-License-Identifier: GPL-3.0-or-later
// Parser del lenguaje de modelos compatible con LINDO (sección 4 de SPEC.md).
import { Fraction } from "../rational/Fraction";
import {
  INFINITY,
  NEG_INFINITY,
  finite,
  type Extended,
} from "../rational/Extended";
import { ParseError } from "./ParseError";
import { tokenize, type Token } from "./tokenizer";
import type {
  Constraint,
  LPModel,
  Relation,
  Sense,
  VariableKind,
} from "./model";

const MAX_KEYWORDS = new Set(["MAX", "MAXIMIZE", "MAXIMISE", "MAXIMIZAR"]);
const MIN_KEYWORDS = new Set(["MIN", "MINIMIZE", "MINIMISE", "MINIMIZAR"]);
const DECLARATIONS = new Set(["FREE", "SLB", "SUB", "GIN", "INT"]);

interface Expression {
  readonly coefficients: Map<string, Fraction>;
  readonly constant: Fraction;
}

interface VariableState {
  lower: Extended;
  upper: Extended;
  kind: VariableKind;
}

class Parser {
  private readonly tokens: Token[];
  private pos = 0;
  private readonly variableOrder: string[] = [];
  private readonly variables = new Map<string, VariableState>();
  private readonly lastContentLine: number;

  constructor(
    private readonly lines: readonly string[],
    private readonly title: string | null,
  ) {
    this.tokens = tokenize(lines);
    const content = this.tokens.filter(
      (t) => t.type !== "eol" && t.type !== "eof",
    );
    this.lastContentLine =
      content.length > 0 ? content[content.length - 1]!.line : 1;
  }

  parse(): LPModel {
    this.skipEols();
    const first = this.peek();
    if (first.type === "eof") {
      throw new ParseError(
        1,
        "El modelo está vacío: se esperaba MAX o MIN seguido de la función objetivo",
      );
    }
    const sense = this.parseSense();
    const objective = this.parseObjective();
    const constraints = this.parseConstraints();
    this.parseDeclarations();
    return this.buildModel(sense, objective, constraints);
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)]!;
  }

  private next(): Token {
    const token = this.peek();
    if (token.type !== "eof") {
      this.pos += 1;
    }
    return token;
  }

  private skipEols(): void {
    while (this.peek().type === "eol") {
      this.pos += 1;
    }
  }

  private check(token: Token): Token {
    if (token.type === "invalid") {
      throw new ParseError(
        token.line,
        token.message ?? `Token inválido '${token.text}'`,
      );
    }
    return token;
  }

  private isKeyword(
    token: Token,
    words: ReadonlySet<string> | string,
  ): boolean {
    if (token.type !== "ident") {
      return false;
    }
    const upper = token.text.toUpperCase();
    return typeof words === "string" ? upper === words : words.has(upper);
  }

  /** Reconoce SUBJECT TO, ST, S.T. y SUCH THAT a partir del token actual y lo consume. */
  private consumeSubjectTo(): boolean {
    const token = this.peek();
    if (token.type !== "ident") {
      return false;
    }
    const upper = token.text.toUpperCase();
    if (upper === "ST" || upper === "S.T." || upper === "S.T") {
      this.next();
      return true;
    }
    if (
      (upper === "SUBJECT" && this.isKeyword(this.peek(1), "TO")) ||
      (upper === "SUCH" && this.isKeyword(this.peek(1), "THAT"))
    ) {
      this.next();
      this.next();
      return true;
    }
    return false;
  }

  private parseSense(): Sense {
    const token = this.check(this.peek());
    if (this.isKeyword(token, MAX_KEYWORDS)) {
      this.next();
      return "max";
    }
    if (this.isKeyword(token, MIN_KEYWORDS)) {
      this.next();
      return "min";
    }
    throw new ParseError(
      token.line,
      `Se esperaba MAX o MIN al comienzo del modelo y se encontró '${token.text}'`,
    );
  }

  private parseObjective(): Expression {
    const startLine = this.peek().line;
    const collected: Token[] = [];
    for (;;) {
      const token = this.peek();
      if (token.type === "eof") {
        throw new ParseError(
          this.lastContentLine,
          "Se esperaba SUBJECT TO (o ST) después de la función objetivo",
        );
      }
      if (token.type === "eol") {
        this.next();
        continue;
      }
      if (this.consumeSubjectTo()) {
        break;
      }
      if (token.type === "op" && isRelational(token.text)) {
        throw new ParseError(
          token.line,
          "Se esperaba SUBJECT TO (o ST) antes de la primera restricción",
        );
      }
      if (this.isKeyword(token, "END")) {
        throw new ParseError(
          token.line,
          "Se esperaba SUBJECT TO (o ST) después de la función objetivo",
        );
      }
      collected.push(this.next());
    }
    if (collected.length === 0) {
      throw new ParseError(startLine, "La función objetivo está vacía");
    }
    const expression = this.parseExpression(collected, "la función objetivo");
    if (!expression.constant.isZero()) {
      throw new ParseError(
        collected[0]!.line,
        "La función objetivo no admite términos constantes",
      );
    }
    if (expression.coefficients.size === 0) {
      throw new ParseError(
        collected[0]!.line,
        "La función objetivo no tiene variables",
      );
    }
    return expression;
  }

  private parseConstraints(): Constraint[] {
    const constraints: Constraint[] = [];
    for (;;) {
      this.skipEols();
      const token = this.check(this.peek());
      if (token.type === "eof") {
        throw new ParseError(
          this.lastContentLine,
          "Falta END al final de las restricciones",
        );
      }
      if (this.isKeyword(token, "END")) {
        this.next();
        const after = this.check(this.peek());
        if (after.type !== "eol" && after.type !== "eof") {
          throw new ParseError(after.line, "END debe ir solo en su línea");
        }
        if (constraints.length === 0) {
          throw new ParseError(token.line, "El modelo no tiene restricciones");
        }
        return constraints;
      }
      constraints.push(this.parseConstraint(constraints.length + 2));
    }
  }

  private parseConstraint(row: number): Constraint {
    let label: string | null = null;
    const first = this.check(this.peek());
    if (
      first.type === "ident" &&
      this.peek(1).type === "op" &&
      this.peek(1).text === ")"
    ) {
      label = first.text;
      this.next();
      this.next();
      this.skipEols();
    }
    const lineTokens: Token[] = [];
    while (this.peek().type !== "eol" && this.peek().type !== "eof") {
      lineTokens.push(this.check(this.next()));
    }
    const line = lineTokens[0]?.line ?? first.line;
    if (lineTokens.length === 0) {
      throw new ParseError(line, `La restricción '${label ?? row}' está vacía`);
    }
    const relationIndices = lineTokens
      .map((t, i) => (t.type === "op" && isRelational(t.text) ? i : -1))
      .filter((i) => i >= 0);
    if (relationIndices.length === 0) {
      throw new ParseError(
        line,
        "La restricción no tiene operador de comparación (<=, >= o =)",
      );
    }
    if (relationIndices.length > 1) {
      throw new ParseError(
        line,
        "La restricción tiene más de un operador de comparación",
      );
    }
    const relationIndex = relationIndices[0]!;
    const relationToken = lineTokens[relationIndex]!;
    const left = this.parseExpression(
      lineTokens.slice(0, relationIndex),
      "el lado izquierdo",
    );
    const right = this.parseExpression(
      lineTokens.slice(relationIndex + 1),
      "el lado derecho",
    );
    const coefficients = new Map<string, Fraction>(left.coefficients);
    for (const [name, coef] of right.coefficients) {
      coefficients.set(
        name,
        (coefficients.get(name) ?? Fraction.ZERO).sub(coef),
      );
    }
    if (coefficients.size === 0) {
      throw new ParseError(line, "La restricción no tiene variables");
    }
    const names = [...coefficients.keys()];
    return {
      label,
      row,
      coefficients: names.map((name) => coefficients.get(name)!),
      relation: normalizeRelation(relationToken.text),
      rhs: right.constant.sub(left.constant),
      // Las columnas se alinean con la lista final de variables en buildModel.
      ...({ names } as object),
    } as Constraint;
  }

  /** Parsea una suma de términos: [signo] (número [/ número] [*] [variable] | variable). */
  private parseExpression(
    tokens: readonly Token[],
    context: string,
  ): Expression {
    const coefficients = new Map<string, Fraction>();
    let constant = Fraction.ZERO;
    let i = 0;
    let expectOperator = false;
    if (tokens.length === 0) {
      const line = this.peek().line;
      throw new ParseError(line, `Falta ${context}`);
    }
    const line = tokens[0]!.line;
    while (i < tokens.length) {
      let token = this.check(tokens[i]!);
      let sign = Fraction.ONE;
      if (token.type === "op" && (token.text === "+" || token.text === "-")) {
        if (token.text === "-") {
          sign = Fraction.MINUS_ONE;
        }
        i += 1;
        if (i >= tokens.length) {
          throw new ParseError(
            token.line,
            `Se esperaba un término (número o variable) después de '${token.text}'`,
          );
        }
        token = this.check(tokens[i]!);
      } else if (expectOperator) {
        throw new ParseError(
          token.line,
          `Se esperaba un operador (+ o -) antes de '${token.text}'`,
        );
      }
      if (token.type === "number") {
        let coefficient = Fraction.parse(token.text);
        i += 1;
        const slash = tokens[i];
        if (slash && slash.type === "op" && slash.text === "/") {
          const denominator = tokens[i + 1];
          if (!denominator || denominator.type !== "number") {
            throw new ParseError(
              token.line,
              `Se esperaba un denominador después de '${token.text}/'`,
            );
          }
          const den = Fraction.parse(denominator.text);
          if (den.isZero()) {
            throw new ParseError(
              token.line,
              `División por cero en el coeficiente '${token.text}/${denominator.text}'`,
            );
          }
          coefficient = coefficient.div(den);
          i += 2;
        }
        const star = tokens[i];
        let hadStar = false;
        if (star && star.type === "op" && star.text === "*") {
          hadStar = true;
          i += 1;
        }
        const variable = tokens[i];
        if (variable && variable.type === "ident") {
          this.addTerm(coefficients, variable.text, sign.mul(coefficient));
          i += 1;
        } else if (hadStar) {
          throw new ParseError(
            token.line,
            `Se esperaba una variable después de '${token.text}*'`,
          );
        } else {
          constant = constant.add(sign.mul(coefficient));
        }
        expectOperator = true;
        continue;
      }
      if (token.type === "ident") {
        this.addTerm(coefficients, token.text, sign);
        i += 1;
        expectOperator = true;
        continue;
      }
      throw new ParseError(
        token.line,
        `Se esperaba un término (número o variable) en ${context} y se encontró '${token.text}'`,
      );
    }
    if (!expectOperator) {
      throw new ParseError(line, `Falta un término al final de ${context}`);
    }
    return { coefficients, constant };
  }

  private addTerm(
    coefficients: Map<string, Fraction>,
    rawName: string,
    value: Fraction,
  ): void {
    const name = rawName.toUpperCase();
    if (!this.variables.has(name)) {
      this.variables.set(name, {
        lower: finite(Fraction.ZERO),
        upper: INFINITY,
        kind: "continuous",
      });
      this.variableOrder.push(name);
    }
    coefficients.set(
      name,
      (coefficients.get(name) ?? Fraction.ZERO).add(value),
    );
  }

  private parseDeclarations(): void {
    for (;;) {
      this.skipEols();
      const token = this.check(this.peek());
      if (token.type === "eof") {
        return;
      }
      if (!this.isKeyword(token, DECLARATIONS)) {
        throw new ParseError(
          token.line,
          `Declaración desconocida '${token.text}'. Después de END solo se admiten FREE, SLB, SUB, GIN e INT`,
        );
      }
      this.next();
      const keyword = token.text.toUpperCase();
      const args: Token[] = [];
      while (this.peek().type !== "eol" && this.peek().type !== "eof") {
        args.push(this.check(this.next()));
      }
      switch (keyword) {
        case "FREE":
          this.applyToNames(token, args, (state) => {
            state.lower = NEG_INFINITY;
          });
          break;
        case "GIN":
          this.applyToNames(token, args, (state) => {
            state.kind = "integer";
          });
          break;
        case "INT":
          this.applyToNames(token, args, (state) => {
            state.kind = "binary";
            state.lower = finite(Fraction.ZERO);
            state.upper = finite(Fraction.ONE);
          });
          break;
        case "SLB":
        case "SUB":
          this.applyBound(token, keyword, args);
          break;
        default:
          throw new ParseError(
            token.line,
            `Declaración desconocida '${token.text}'`,
          );
      }
    }
  }

  private variableName(
    keyword: Token,
    token: Token,
    nextToken: Token | undefined,
  ): string {
    if (
      token.type === "number" &&
      nextToken &&
      nextToken.type === "ident" &&
      nextToken.start === token.end
    ) {
      throw new ParseError(
        token.line,
        `El nombre de variable '${token.text}${nextToken.text}' no puede empezar con un dígito`,
      );
    }
    if (token.type !== "ident") {
      throw new ParseError(
        token.line,
        `${keyword.text.toUpperCase()} requiere un nombre de variable y se encontró '${token.text}'`,
      );
    }
    const name = token.text.toUpperCase();
    if (!this.variables.has(name)) {
      throw new ParseError(
        token.line,
        `La variable '${name}' no aparece en el modelo`,
      );
    }
    return name;
  }

  private applyToNames(
    keyword: Token,
    args: Token[],
    apply: (state: VariableState) => void,
  ): void {
    const word = keyword.text.toUpperCase();
    if (args.length === 0) {
      throw new ParseError(
        keyword.line,
        `${word} requiere al menos un nombre de variable`,
      );
    }
    const [first] = args;
    if (
      args.length === 1 &&
      first!.type === "number" &&
      (word === "GIN" || word === "INT")
    ) {
      const count = Fraction.parse(first!.text);
      if (!count.isInteger() || !count.isPositive()) {
        throw new ParseError(
          first!.line,
          `${word} ${first!.text}: la cantidad de variables debe ser un entero positivo`,
        );
      }
      const n = Number(count.num);
      if (n > this.variableOrder.length) {
        throw new ParseError(
          first!.line,
          `${word} ${first!.text}: el modelo tiene solo ${this.variableOrder.length} variable${this.variableOrder.length === 1 ? "" : "s"}`,
        );
      }
      for (let i = 0; i < n; i += 1) {
        apply(this.variables.get(this.variableOrder[i]!)!);
      }
      return;
    }
    for (let i = 0; i < args.length; i += 1) {
      const name = this.variableName(keyword, args[i]!, args[i + 1]);
      apply(this.variables.get(name)!);
    }
  }

  private applyBound(keyword: Token, word: string, args: Token[]): void {
    if (args.length < 2) {
      throw new ParseError(
        keyword.line,
        `${word} requiere un nombre de variable y un valor, por ejemplo '${word} X 5'`,
      );
    }
    const name = this.variableName(keyword, args[0]!, args[1]);
    let i = 1;
    let sign = Fraction.ONE;
    const maybeSign = args[i]!;
    if (
      maybeSign.type === "op" &&
      (maybeSign.text === "-" || maybeSign.text === "+")
    ) {
      sign = maybeSign.text === "-" ? Fraction.MINUS_ONE : Fraction.ONE;
      i += 1;
    }
    const valueToken = args[i];
    if (!valueToken || valueToken.type !== "number") {
      throw new ParseError(
        keyword.line,
        `${word} requiere un valor numérico para '${name}'`,
      );
    }
    let value = Fraction.parse(valueToken.text).mul(sign);
    const slash = args[i + 1];
    if (
      slash &&
      slash.type === "op" &&
      slash.text === "/" &&
      args[i + 2]?.type === "number"
    ) {
      const den = Fraction.parse(args[i + 2]!.text);
      if (den.isZero()) {
        throw new ParseError(
          keyword.line,
          `División por cero en el valor de ${word}`,
        );
      }
      value = value.div(den);
      i += 2;
    }
    if (args.length > i + 1) {
      throw new ParseError(
        keyword.line,
        `Texto inesperado después del valor de ${word}: '${args[i + 1]!.text}'`,
      );
    }
    const state = this.variables.get(name)!;
    if (word === "SLB") {
      state.lower = finite(value);
    } else {
      state.upper = finite(value);
    }
  }

  private buildModel(
    sense: Sense,
    objective: Expression,
    rawConstraints: Constraint[],
  ): LPModel {
    const names = this.variableOrder;
    const variables = names.map((name) => {
      const state = this.variables.get(name)!;
      return { name, lower: state.lower, upper: state.upper, kind: state.kind };
    });
    const objectiveCoefficients = names.map(
      (name) => objective.coefficients.get(name) ?? Fraction.ZERO,
    );
    const constraints = rawConstraints.map((c) => {
      const localNames = (c as unknown as { names: string[] }).names;
      const byName = new Map(
        localNames.map((name, i) => [name, c.coefficients[i]!]),
      );
      return {
        label: c.label,
        row: c.row,
        coefficients: names.map((name) => byName.get(name) ?? Fraction.ZERO),
        relation: c.relation,
        rhs: c.rhs,
      };
    });
    return {
      title: this.title,
      sense,
      variables,
      objective: objectiveCoefficients,
      constraints,
    };
  }
}

function isRelational(text: string): boolean {
  return (
    text === "<=" ||
    text === ">=" ||
    text === "=<" ||
    text === "=>" ||
    text === "<" ||
    text === ">" ||
    text === "="
  );
}

function normalizeRelation(text: string): Relation {
  if (text === "<=" || text === "=<" || text === "<") {
    return "<=";
  }
  if (text === ">=" || text === "=>" || text === ">") {
    return ">=";
  }
  return "=";
}

/** Separa la línea TITLE (si existe) del resto, conservando la numeración de líneas. */
function extractTitle(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]!;
    const withoutComment = raw.split("!")[0]!;
    const trimmed = withoutComment.trim();
    if (trimmed === "") {
      continue;
    }
    const match = /^TITLE(?:\s+(.*))?$/i.exec(trimmed);
    if (match) {
      lines[i] = "";
      return (match[1] ?? "").trim();
    }
    return null;
  }
  return null;
}

/** Parsea un modelo en formato LINDO. Lanza `ParseError` con número de línea ante errores de sintaxis. */
export function parseLP(text: string): LPModel {
  const lines = text.split(/\r?\n/);
  const title = extractTitle(lines);
  return new Parser(lines, title).parse();
}
