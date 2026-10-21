// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { formatLP, parseLP } from "../../src/parser";

describe("formatLP", () => {
  it("escribe el modelo en el formato de la sección 4 y el resultado se vuelve a parsear igual", () => {
    const texto = `TITLE Ejemplo de la cátedra
! Comentario hasta fin de línea
MAX 3X + 2Y
SUBJECT TO
  capacidad) 2X + Y <= 100
  horas)     X + Y <= 80
  demanda)   X <= 40
END
GIN X
`;
    const model = parseLP(texto);
    const salida = formatLP(model);
    expect(salida).toBe(`TITLE Ejemplo de la cátedra
MAX 3 X + 2 Y
SUBJECT TO
  capacidad) 2 X + Y <= 100
  horas) X + Y <= 80
  demanda) X <= 40
END
GIN X
`);
    expect(parseLP(salida)).toEqual(model);
  });

  it("conserva cotas, variables libres, binarias y coeficientes fraccionarios", () => {
    const texto = `MIN 1/3 X - Y + Z
ST
X + Y + Z >= 1
2 X - 3 Z = 0
END
FREE Z
SLB X 5
SUB X 50
INT Y
`;
    const model = parseLP(texto);
    const salida = formatLP(model);
    expect(salida).toContain("MIN 1/3 X - Y + Z");
    expect(salida).toContain("  2 X - 3 Z = 0");
    expect(salida).toContain("SLB X 5");
    expect(salida).toContain("SUB X 50");
    expect(salida).toContain("INT Y");
    expect(salida).toContain("FREE Z");
    expect(parseLP(salida)).toEqual(model);
  });

  it("acepta un formateador decimal para los números", () => {
    const model = parseLP("MAX 1/2 X\nST\nX <= 3/4\nEND");
    const salida = formatLP(model, { number: (f) => f.toDecimal(2) });
    expect(salida).toContain("MAX 0.50 X");
    expect(salida).toContain("X <= 0.75");
  });
});
