// SPDX-License-Identifier: GPL-3.0-or-later
// Caso de aceptación DEC-02: juegos de suma cero de dos jugadores.
import { describe, expect, it } from "vitest";
import { Fraction } from "../../src/rational/Fraction";
import { solveGame } from "../../src/decision";
import { reportGame } from "../../src/report";

const fr = (s: string | number): Fraction => Fraction.parse(String(s));
const matrix = (rows: number[][]) => rows.map((r) => r.map((v) => fr(v)));

describe("DEC-02. Juegos de suma cero", () => {
  it("la matriz 4 3 / 1 2 tiene punto de silla en fila 1 columna 2 con valor 3", () => {
    const r = solveGame(
      matrix([
        [4, 3],
        [1, 2],
      ]),
    );
    expect(r.maximin).toEqual({ value: fr(3), row: 0 });
    expect(r.minimax).toEqual({ value: fr(3), column: 1 });
    expect(r.saddle).toEqual({ row: 0, column: 1, value: fr(3) });
    expect(r.value).toEqual(fr(3));
    expect(r.rowStrategy).toEqual([fr(1), fr(0)]);
    expect(r.columnStrategy).toEqual([fr(0), fr(1)]);
    expect(r.method).toBe("saddle");
  });

  it("la matriz 3 -1 / -2 2 no tiene punto de silla: filas (1/2, 1/2), columnas (3/8, 5/8), valor 1/2", () => {
    const r = solveGame(
      matrix([
        [3, -1],
        [-2, 2],
      ]),
    );
    expect(r.saddle).toBeNull();
    expect(r.rowStrategy).toEqual([fr("1/2"), fr("1/2")]);
    expect(r.columnStrategy).toEqual([fr("3/8"), fr("5/8")]);
    expect(r.value).toEqual(fr("1/2"));
    expect(r.method).toBe("graphical");
    expect(r.graphical).not.toBeNull();
    expect(r.graphical!.player).toBe("row");
    expect(r.graphical!.lines).toHaveLength(2);
    expect(r.graphical!.optimum).toEqual(fr("1/2"));
    expect(r.lp).not.toBeNull();
  });

  it("elimina filas y columnas dominadas y resuelve el juego reducido", () => {
    const r = solveGame(
      matrix([
        [3, -1],
        [-2, 2],
        [1, -2],
      ]),
    );
    expect(r.dominance.steps).toHaveLength(1);
    expect(r.dominance.steps[0]).toMatchObject({
      kind: "row",
      removed: 2,
      by: 0,
    });
    expect(r.rowStrategy).toEqual([fr("1/2"), fr("1/2"), fr(0)]);
    expect(r.value).toEqual(fr("1/2"));
    const columns = solveGame(
      matrix([
        [3, -1, 4],
        [-2, 2, 3],
      ]),
    );
    expect(columns.dominance.steps[0]).toMatchObject({
      kind: "column",
      removed: 2,
    });
    expect(columns.columnStrategy).toEqual([fr("3/8"), fr("5/8"), fr(0)]);
  });

  it("resuelve un juego 3 por 3 sin punto de silla por programación lineal", () => {
    // Piedra, papel o tijera: valor 0 y estrategias (1/3, 1/3, 1/3)
    const r = solveGame(
      matrix([
        [0, -1, 1],
        [1, 0, -1],
        [-1, 1, 0],
      ]),
    );
    expect(r.method).toBe("lp");
    expect(r.value).toEqual(fr(0));
    expect(r.rowStrategy).toEqual([fr("1/3"), fr("1/3"), fr("1/3")]);
    expect(r.columnStrategy).toEqual([fr("1/3"), fr("1/3"), fr("1/3")]);
    expect(r.lp!.row.variables.length).toBe(4);
    const text = reportGame(r);
    expect(text).toContain("Valor del juego: 0");
  });
});
