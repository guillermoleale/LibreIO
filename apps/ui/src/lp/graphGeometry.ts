// SPDX-License-Identifier: GPL-3.0-or-later
// Geometría en punto flotante para dibujar: recorte de semiplanos y rectas a la vista.

export interface Pt {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

export interface HalfPlane {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly relation: "<=" | ">=" | "=";
}

const EPS = 1e-9;

export function rectPolygon(r: Rect): Pt[] {
  return [
    { x: r.xMin, y: r.yMin },
    { x: r.xMax, y: r.yMin },
    { x: r.xMax, y: r.yMax },
    { x: r.xMin, y: r.yMax },
  ];
}

/** Recorta un polígono convexo con un semiplano (Sutherland–Hodgman). Una igualdad no recorta. */
export function clipPolygon(polygon: Pt[], h: HalfPlane): Pt[] {
  if (h.relation === "=") {
    return polygon;
  }
  const sign = h.relation === "<=" ? 1 : -1;
  const inside = (p: Pt): boolean =>
    sign * (h.a * p.x + h.b * p.y - h.c) <= EPS;
  const out: Pt[] = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i]!;
    const next = polygon[(i + 1) % polygon.length]!;
    const cIn = inside(current);
    const nIn = inside(next);
    if (cIn) {
      out.push(current);
    }
    if (cIn !== nIn) {
      const fc = h.a * current.x + h.b * current.y - h.c;
      const fn = h.a * next.x + h.b * next.y - h.c;
      const tt = fc / (fc - fn);
      out.push({
        x: current.x + tt * (next.x - current.x),
        y: current.y + tt * (next.y - current.y),
      });
    }
  }
  return out;
}

/** Segmento de la recta a x + b y = c dentro del rectángulo, o null si no lo cruza. */
export function clipLine(
  h: { a: number; b: number; c: number },
  r: Rect,
): [Pt, Pt] | null {
  const points: Pt[] = [];
  const push = (p: Pt) => {
    if (
      p.x >= r.xMin - EPS &&
      p.x <= r.xMax + EPS &&
      p.y >= r.yMin - EPS &&
      p.y <= r.yMax + EPS
    ) {
      if (
        !points.some(
          (q) => Math.abs(q.x - p.x) < 1e-7 && Math.abs(q.y - p.y) < 1e-7,
        )
      ) {
        points.push(p);
      }
    }
  };
  if (Math.abs(h.b) > EPS) {
    push({ x: r.xMin, y: (h.c - h.a * r.xMin) / h.b });
    push({ x: r.xMax, y: (h.c - h.a * r.xMax) / h.b });
  }
  if (Math.abs(h.a) > EPS) {
    push({ x: (h.c - h.b * r.yMin) / h.a, y: r.yMin });
    push({ x: (h.c - h.b * r.yMax) / h.a, y: r.yMax });
  }
  if (points.length < 2) {
    return null;
  }
  return [points[0]!, points[1]!];
}

/** Paso "redondo" para las marcas de los ejes. */
export function niceStep(span: number, targetTicks = 8): number {
  const raw = span / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const factor =
    normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
  return factor * magnitude;
}

export function centroid(points: Pt[]): Pt {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
}

export function formatTick(value: number): string {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
