// SPDX-License-Identifier: GPL-3.0-or-later
// Método gráfico para dos variables: rectas, región factible, vértices con Z y casos especiales.
import { Fraction } from "../rational/Fraction";
import type { LPModel, Relation, Sense } from "../parser/model";
import { solveLP, type LPStatus } from "./solveLP";

export interface GraphLine {
  /** Índice de la restricción, o -1 para las cotas de las variables. */
  readonly index: number;
  readonly name: string;
  readonly a: Fraction;
  readonly b: Fraction;
  readonly c: Fraction;
  readonly relation: Relation;
}

export interface Point {
  readonly x: Fraction;
  readonly y: Fraction;
}

export interface Vertex extends Point {
  readonly z: Fraction;
}

export interface GraphicalAnalysis {
  readonly applicable: boolean;
  readonly variables: [string, string] | null;
  readonly sense: Sense;
  readonly objective: [Fraction, Fraction];
  readonly lines: GraphLine[];
  readonly bounds: GraphLine[];
  /** Vértices reales de la región, en sentido antihorario desde el más bajo y a la izquierda. */
  readonly vertices: Vertex[];
  /** Polígono recortado a la vista para sombrear, también en sentido antihorario. */
  readonly regionPolygon: Point[];
  readonly bounded: boolean;
  readonly status: LPStatus;
  readonly optimum: Vertex | null;
  readonly optimalSegment: [Vertex, Vertex] | null;
  readonly improvementDirection: [Fraction, Fraction];
  readonly unboundedDirection: [Fraction, Fraction] | null;
  readonly zRange: { readonly min: Fraction; readonly max: Fraction } | null;
  readonly viewBox: { readonly xMax: number; readonly yMax: number };
  /** Puntos enteros de la región cuando las dos variables son enteras. */
  readonly integerPoints: Point[];
}

function satisfies(line: GraphLine, p: Point): boolean {
  const value = line.a.mul(p.x).add(line.b.mul(p.y));
  const cmp = value.cmp(line.c);
  if (line.relation === "<=") {
    return cmp <= 0;
  }
  if (line.relation === ">=") {
    return cmp >= 0;
  }
  return cmp === 0;
}

function intersect(l1: GraphLine, l2: GraphLine): Point | null {
  const det = l1.a.mul(l2.b).sub(l2.a.mul(l1.b));
  if (det.isZero()) {
    return null;
  }
  const x = l1.c.mul(l2.b).sub(l2.c.mul(l1.b)).div(det);
  const y = l1.a.mul(l2.c).sub(l2.a.mul(l1.c)).div(det);
  return { x, y };
}

/** Vértices factibles del sistema de semiplanos, ordenados en sentido antihorario. */
function feasibleVertices(lines: GraphLine[]): Point[] {
  const seen = new Map<string, Point>();
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const p = intersect(lines[i]!, lines[j]!);
      if (p === null) {
        continue;
      }
      const key = `${p.x.toString()},${p.y.toString()}`;
      if (seen.has(key)) {
        continue;
      }
      if (lines.every((l) => satisfies(l, p))) {
        seen.set(key, p);
      }
    }
  }
  return orderCounterClockwise([...seen.values()]);
}

function orderCounterClockwise(points: Point[]): Point[] {
  if (points.length <= 2) {
    return [...points].sort((p, q) => p.y.cmp(q.y) || p.x.cmp(q.x));
  }
  const cx = points.reduce((s, p) => s + p.x.toNumber(), 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y.toNumber(), 0) / points.length;
  const sorted = [...points].sort(
    (p, q) =>
      Math.atan2(p.y.toNumber() - cy, p.x.toNumber() - cx) -
      Math.atan2(q.y.toNumber() - cy, q.x.toNumber() - cx),
  );
  let start = 0;
  sorted.forEach((p, i) => {
    const best = sorted[start]!;
    if (p.y.cmp(best.y) < 0 || (p.y.eq(best.y) && p.x.lt(best.x))) {
      start = i;
    }
  });
  return [...sorted.slice(start), ...sorted.slice(0, start)];
}

function objectiveAt(model: LPModel, p: Point): Fraction {
  return model.objective[0]!.mul(p.x).add(model.objective[1]!.mul(p.y));
}

function withObjective(
  model: LPModel,
  objective: Fraction[],
  sense: Sense,
): LPModel {
  return {
    ...model,
    title: null,
    sense,
    objective,
    variables: model.variables.map((v) => ({ ...v, kind: "continuous" })),
  };
}

export function graphicalAnalysis(model: LPModel): GraphicalAnalysis {
  const names = model.variables.map((v) => v.name);
  const objective: [Fraction, Fraction] = [
    model.objective[0] ?? Fraction.ZERO,
    model.objective[1] ?? Fraction.ZERO,
  ];
  const improvementDirection: [Fraction, Fraction] =
    model.sense === "max"
      ? objective
      : [objective[0].neg(), objective[1].neg()];
  const empty: GraphicalAnalysis = {
    applicable: false,
    variables: null,
    sense: model.sense,
    objective,
    lines: [],
    bounds: [],
    vertices: [],
    regionPolygon: [],
    bounded: true,
    status: "infeasible",
    optimum: null,
    optimalSegment: null,
    improvementDirection,
    unboundedDirection: null,
    zRange: null,
    viewBox: { xMax: 10, yMax: 10 },
    integerPoints: [],
  };
  if (model.variables.length !== 2) {
    return empty;
  }
  const lines: GraphLine[] = model.constraints.map((c, i) => ({
    index: i,
    name: c.label ?? String(c.row),
    a: c.coefficients[0]!,
    b: c.coefficients[1]!,
    c: c.rhs,
    relation: c.relation,
  }));
  const bounds: GraphLine[] = [];
  model.variables.forEach((v, i) => {
    const a = i === 0 ? Fraction.ONE : Fraction.ZERO;
    const b = i === 0 ? Fraction.ZERO : Fraction.ONE;
    if (v.lower.finite) {
      bounds.push({
        index: -1,
        name: `${v.name} >= ${v.lower.value.toString()}`,
        a,
        b,
        c: v.lower.value,
        relation: ">=",
      });
    }
    if (v.upper.finite) {
      bounds.push({
        index: -1,
        name: `${v.name} <= ${v.upper.value.toString()}`,
        a,
        b,
        c: v.upper.value,
        relation: "<=",
      });
    }
  });
  const all = [...lines, ...bounds];
  const points = feasibleVertices(all);
  const vertices: Vertex[] = points.map((p) => ({
    x: p.x,
    y: p.y,
    z: objectiveAt(model, p),
  }));

  // Acotación: la región es acotada si X e Y tienen máximo finito.
  let bounded = true;
  for (const direction of [
    [Fraction.ONE, Fraction.ZERO],
    [Fraction.ZERO, Fraction.ONE],
  ]) {
    const r = solveLP(withObjective(model, direction, "max"));
    if (r.status === "unbounded") {
      bounded = false;
    }
  }

  const result = solveLP(withObjective(model, model.objective, model.sense));
  const status = result.status;
  let optimum: Vertex | null = null;
  let optimalSegment: [Vertex, Vertex] | null = null;
  if (status === "optimal" && result.solution) {
    const [x, y] = result.solution.variables.map((v) => v.value) as [
      Fraction,
      Fraction,
    ];
    optimum = { x, y, z: result.solution.objective };
    const optimal = vertices
      .filter((v) => v.z.eq(result.solution!.objective))
      .sort((p, q) => p.x.cmp(q.x));
    if (optimal.length >= 2) {
      optimalSegment = [optimal[0]!, optimal[optimal.length - 1]!];
    }
  }
  const unboundedDirection =
    status === "unbounded" ? improvementDirection : null;

  // Vista: margen sobre los vértices y las intersecciones de las rectas con los ejes.
  const candidates: number[] = [1];
  for (const v of vertices) {
    candidates.push(v.x.toNumber(), v.y.toNumber());
  }
  for (const l of all) {
    if (!l.a.isZero()) {
      candidates.push(l.c.div(l.a).toNumber());
    }
    if (!l.b.isZero()) {
      candidates.push(l.c.div(l.b).toNumber());
    }
  }
  const extent = Math.max(
    ...candidates.filter((c) => Number.isFinite(c) && c > 0),
  );
  const factor = bounded ? 1.2 : 1.6;
  const xMax = Math.ceil(extent * factor);
  const yMax = xMax;
  const box: GraphLine[] = [
    {
      index: -1,
      name: "vista",
      a: Fraction.ONE,
      b: Fraction.ZERO,
      c: Fraction.fromNumber(xMax),
      relation: "<=",
    },
    {
      index: -1,
      name: "vista",
      a: Fraction.ZERO,
      b: Fraction.ONE,
      c: Fraction.fromNumber(yMax),
      relation: "<=",
    },
    {
      index: -1,
      name: "vista",
      a: Fraction.ONE,
      b: Fraction.ZERO,
      c: Fraction.ZERO,
      relation: ">=",
    },
    {
      index: -1,
      name: "vista",
      a: Fraction.ZERO,
      b: Fraction.ONE,
      c: Fraction.ZERO,
      relation: ">=",
    },
  ];
  const regionPolygon =
    vertices.length === 0 ? [] : feasibleVertices([...all, ...box]);

  let zRange: GraphicalAnalysis["zRange"] = null;
  if (vertices.length > 0) {
    const zs = vertices.map((v) => v.z);
    zRange = {
      min: zs.reduce((a, b) => (b.lt(a) ? b : a)),
      max: zs.reduce((a, b) => (b.gt(a) ? b : a)),
    };
  }

  const integerPoints = model.variables.every((v) => v.kind !== "continuous")
    ? integerGrid(all, vertices, bounded, xMax, yMax)
    : [];

  return {
    applicable: true,
    integerPoints,
    variables: [names[0]!, names[1]!],
    sense: model.sense,
    objective,
    lines,
    bounds,
    vertices,
    regionPolygon,
    bounded,
    status,
    optimum,
    optimalSegment,
    improvementDirection,
    unboundedDirection,
    zRange,
    viewBox: { xMax, yMax },
  };
}

/** Puntos de coordenadas enteras que cumplen todas las restricciones, dentro de la región o de la vista. */
function integerGrid(
  lines: GraphLine[],
  vertices: Vertex[],
  bounded: boolean,
  xMax: number,
  yMax: number,
): Point[] {
  if (vertices.length === 0) {
    return [];
  }
  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  const minX = xs.reduce((a, b) => (b.lt(a) ? b : a)).ceil();
  const minY = ys.reduce((a, b) => (b.lt(a) ? b : a)).ceil();
  const maxX = (
    bounded ? xs.reduce((a, b) => (b.gt(a) ? b : a)) : Fraction.fromNumber(xMax)
  ).floor();
  const maxY = (
    bounded ? ys.reduce((a, b) => (b.gt(a) ? b : a)) : Fraction.fromNumber(yMax)
  ).floor();
  const points: Point[] = [];
  const limit = 5000;
  for (let x = minX; x.le(maxX); x = x.add(Fraction.ONE)) {
    for (let y = minY; y.le(maxY); y = y.add(Fraction.ONE)) {
      const p = { x, y };
      if (lines.every((l) => satisfies(l, p))) {
        points.push(p);
        if (points.length >= limit) {
          return points;
        }
      }
    }
  }
  return points;
}
