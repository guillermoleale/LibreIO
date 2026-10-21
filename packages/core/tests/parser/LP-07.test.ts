// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación LP-07 del apéndice A de SPEC.md: parser del formato LINDO.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { INFINITY, NEG_INFINITY, finite } from "../../src/rational/Extended";
import { ParseError, parseLP } from "../../src/parser";

const fr = (text: string): Fraction => Fraction.parse(text);
const row = (coefs: string[]): Fraction[] => coefs.map(fr);

describe("LP-07. Parser del formato LINDO", () => {
  const texto = `TITLE Prueba del parser
! Comentario inicial
MAX 3*X + 2Y - Z + 1/3 W
SUBJECT TO
  capacidad) 2X + Y + 10 <= 110    ! constante del lado izquierdo
  horas) X + Y =< 80
  demanda) X => 5
  -Y + 3 Z = 0
  2W + 4 >= X - 6
END
FREE Z
SLB X 5
SUB X 50
GIN W
INT Y
`;

  it("reconoce título, sentido, variables en orden de aparición y función objetivo", () => {
    const model = parseLP(texto);
    expect(model.title).toBe("Prueba del parser");
    expect(model.sense).toBe("max");
    expect(model.variables.map((v) => v.name)).toEqual(["X", "Y", "Z", "W"]);
    expect(model.objective).toEqual(row(["3", "2", "-1", "1/3"]));
  });

  it("reconoce etiquetas, operadores alternativos y normaliza las constantes al lado derecho", () => {
    const model = parseLP(texto);
    expect(model.constraints).toHaveLength(5);
    const [c1, c2, c3, c4, c5] = model.constraints;
    expect(c1).toMatchObject({ label: "capacidad", row: 2, relation: "<=" });
    expect(c1?.coefficients).toEqual(row(["2", "1", "0", "0"]));
    expect(c1?.rhs).toEqual(fr("100"));
    expect(c2).toMatchObject({ label: "horas", row: 3, relation: "<=" });
    expect(c2?.rhs).toEqual(fr("80"));
    expect(c3).toMatchObject({ label: "demanda", row: 4, relation: ">=" });
    expect(c3?.coefficients).toEqual(row(["1", "0", "0", "0"]));
    expect(c3?.rhs).toEqual(fr("5"));
    expect(c4).toMatchObject({ label: null, row: 5, relation: "=" });
    expect(c4?.coefficients).toEqual(row(["0", "-1", "3", "0"]));
    expect(c4?.rhs).toEqual(fr("0"));
    expect(c5).toMatchObject({ label: null, row: 6, relation: ">=" });
    expect(c5?.coefficients).toEqual(row(["-1", "0", "0", "2"]));
    expect(c5?.rhs).toEqual(fr("-10"));
  });

  it("aplica las declaraciones FREE, SLB, SUB, GIN e INT en forma nominal", () => {
    const model = parseLP(texto);
    const [x, y, z, w] = model.variables;
    expect(x).toEqual({
      name: "X",
      lower: finite(fr("5")),
      upper: finite(fr("50")),
      kind: "continuous",
    });
    expect(y).toEqual({
      name: "Y",
      lower: finite(Fraction.ZERO),
      upper: finite(Fraction.ONE),
      kind: "binary",
    });
    expect(z).toEqual({
      name: "Z",
      lower: NEG_INFINITY,
      upper: INFINITY,
      kind: "continuous",
    });
    expect(w).toEqual({
      name: "W",
      lower: finite(Fraction.ZERO),
      upper: INFINITY,
      kind: "integer",
    });
  });

  it("aplica GIN n e INT n a las primeras n variables en orden de aparición", () => {
    const model = parseLP(`MIN X + Y + Z
ST
X + Y + Z >= 1
END
GIN 2
`);
    expect(model.variables.map((v) => v.kind)).toEqual([
      "integer",
      "integer",
      "continuous",
    ]);
    const binario = parseLP(`MIN X + Y + Z
ST
X + Y + Z >= 1
END
INT 1
`);
    expect(binario.variables.map((v) => v.kind)).toEqual([
      "binary",
      "continuous",
      "continuous",
    ]);
    expect(binario.variables[0]?.upper).toEqual(finite(Fraction.ONE));
  });

  it("acepta ST, S.T., SUCH THAT y operadores <, >, = sin distinguir mayúsculas", () => {
    const a = parseLP("max 3x + 2y\nst\nx + y < 4\nx > 1\nend\n");
    expect(a.sense).toBe("max");
    expect(a.variables.map((v) => v.name)).toEqual(["X", "Y"]);
    expect(a.constraints.map((c) => c.relation)).toEqual(["<=", ">="]);
    const b = parseLP("MIN X\nS.T.\nX = 2\nEND");
    expect(b.constraints[0]?.relation).toBe("=");
    const c = parseLP("MINIMIZE X\nSUCH THAT\nX >= 2\nEND");
    expect(c.sense).toBe("min");
    expect(c.constraints).toHaveLength(1);
  });

  it("acepta la función objetivo en varias líneas y la restricción con la etiqueta en línea aparte", () => {
    const model = parseLP(`MAX 3X
 + 2Y
ST
fila)
 X + Y <= 4
END`);
    expect(model.objective).toEqual(row(["3", "2"]));
    expect(model.constraints[0]).toMatchObject({
      label: "fila",
      relation: "<=",
    });
  });

  it("agrega a la función objetivo con coeficiente 0 las variables que aparecen solo en restricciones", () => {
    const model = parseLP("MAX X\nST\nX + Y <= 4\nY + Z >= 1\nEND");
    expect(model.variables.map((v) => v.name)).toEqual(["X", "Y", "Z"]);
    expect(model.objective).toEqual(row(["1", "0", "0"]));
    expect(model.constraints[0]?.coefficients).toEqual(row(["1", "1", "0"]));
  });

  it("suma los términos repetidos de una misma variable", () => {
    const model = parseLP("MAX X + 2X\nST\n3X - X + Y <= 4\nEND");
    expect(model.objective).toEqual(row(["3", "0"]));
    expect(model.constraints[0]?.coefficients).toEqual(row(["2", "1"]));
  });

  it("acepta coeficientes decimales como fracción exacta", () => {
    const model = parseLP("MAX 0.5X + 1.25Y\nST\nX + Y <= 2.5\nEND");
    expect(model.objective).toEqual(row(["1/2", "5/4"]));
    expect(model.constraints[0]?.rhs).toEqual(fr("5/2"));
  });

  it("informa con número de línea una variable que empieza con dígito en una declaración", () => {
    const texto = "MAX X + Y\nST\nX + Y <= 4\nEND\nFREE 2X\n";
    expect(() => parseLP(texto)).toThrow(ParseError);
    try {
      parseLP(texto);
    } catch (e) {
      const err = e as ParseError;
      expect(err.line).toBe(5);
      expect(err.message).toMatch(/dígito/);
    }
  });

  it("informa cuando falta END", () => {
    const texto = "MAX X + Y\nST\nX + Y <= 4\n";
    try {
      parseLP(texto);
      throw new Error("debía fallar");
    } catch (e) {
      const err = e as ParseError;
      expect(err).toBeInstanceOf(ParseError);
      expect(err.line).toBe(3);
      expect(err.message).toMatch(/END/);
    }
  });

  it("informa un operador desconocido con su línea", () => {
    const texto = "MAX X + Y\nST\nX + Y <= 4\nX - Y <> 1\nEND";
    try {
      parseLP(texto);
      throw new Error("debía fallar");
    } catch (e) {
      const err = e as ParseError;
      expect(err).toBeInstanceOf(ParseError);
      expect(err.line).toBe(4);
      expect(err.message).toMatch(/[Oo]perador/);
    }
  });

  it("informa una restricción sin operador de comparación", () => {
    const texto = "MAX X + Y\nST\nX + Y <= 4\n2X + 3Y\nEND";
    try {
      parseLP(texto);
      throw new Error("debía fallar");
    } catch (e) {
      const err = e as ParseError;
      expect(err).toBeInstanceOf(ParseError);
      expect(err.line).toBe(4);
      expect(err.message).toMatch(/operador/);
    }
  });

  it("informa otros errores habituales con su línea", () => {
    const casos: Array<[string, number, RegExp]> = [
      ["ST\nX <= 4\nEND", 1, /MAX|MIN/],
      ["MAX X\nX <= 4\nEND", 2, /SUBJECT TO|ST/],
      ["MAX X\nST\nX <= 4 <= 5\nEND", 3, /operador/],
      ["MAX X\nST\nX + <= 4\nEND", 3, /término|variable|número/i],
      ["MAX X\nST\nX + Y <= 4\nEND\nSLB X\n", 5, /SLB/],
      ["MAX X\nST\nX + Y <= 4\nEND\nFREE W\n", 5, /W/],
      ["MAX X\nST\nX + Y <= 4\nEND\nGIN 5\n", 5, /5/],
      ["MAX X\nST\nX + Y <= 4\nEND\nFOO X\n", 5, /FOO/],
      ["MAX X\nST\nX + Y <= 4\nEND\nX <= 3\n", 5, /END/],
      ["MAX X\nST\nX + Y <= 4 ? 1\nEND", 3, /\?/],
      ["MAX X\nST\nX + 1/0 Y <= 4\nEND", 3, /cero/],
      ["MAX X\nST\n3 X Y <= 4\nEND", 3, /operador/],
    ];
    for (const [texto, linea, patron] of casos) {
      let capturado: unknown;
      try {
        parseLP(texto);
      } catch (e) {
        capturado = e;
      }
      expect(capturado, texto).toBeInstanceOf(ParseError);
      const err = capturado as ParseError;
      expect(err.line, texto).toBe(linea);
      expect(err.message, texto).toMatch(patron);
    }
  });

  it("rechaza un modelo sin restricciones y un modelo vacío", () => {
    expect(() => parseLP("")).toThrow(ParseError);
    expect(() => parseLP("MAX X\nST\nEND")).toThrow(ParseError);
  });
});
