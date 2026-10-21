// SPDX-License-Identifier: GPL-3.0-or-later
// Lectura y escritura de proyectos PERT/CPM en JSON (.io.json).
import { Fraction } from "../rational/Fraction";
import { ParseError } from "../parser/ParseError";
import type { Activity, ProjectProblem } from "./types";

function fail(message: string): never {
  throw new ParseError(1, message);
}

function number(value: unknown, what: string): Fraction {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Fraction.fromNumber(value);
  }
  if (typeof value === "string") {
    try {
      return Fraction.parse(value);
    } catch {
      fail(`${what}: '${value}' no es un número`);
    }
  }
  fail(`${what} debe ser un número`);
}

function optional(value: unknown, what: string): Fraction | undefined {
  return value === undefined || value === null || value === ""
    ? undefined
    : number(value, what);
}

export function parseProjectFile(text: string): ProjectProblem {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    fail(`El archivo no es JSON válido: ${(e as Error).message}`);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    fail("El archivo debe ser un objeto JSON");
  }
  const root = data as Record<string, unknown>;
  if (root["type"] !== "project") {
    fail(`"type" debe ser "project"`);
  }
  const raw = root["activities"];
  if (!Array.isArray(raw) || raw.length === 0) {
    fail(`"activities" debe ser una lista de actividades`);
  }
  const activities: Activity[] = raw.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      fail(`La actividad ${i + 1} debe ser un objeto`);
    }
    const a = item as Record<string, unknown>;
    const id = a["id"];
    if (typeof id !== "string" || id.trim() === "") {
      fail(`La actividad ${i + 1} necesita un "id"`);
    }
    const predecessors = a["predecessors"] ?? [];
    if (
      !Array.isArray(predecessors) ||
      predecessors.some((p) => typeof p !== "string")
    ) {
      fail(`"predecessors" de ${id} debe ser una lista de identificadores`);
    }
    const optimistic = optional(a["optimistic"], `optimista de ${id}`);
    const mostLikely = optional(a["mostLikely"], `más probable de ${id}`);
    const pessimistic = optional(a["pessimistic"], `pesimista de ${id}`);
    let duration = optional(a["duration"], `duración de ${id}`);
    if (duration === undefined) {
      if (
        optimistic !== undefined &&
        mostLikely !== undefined &&
        pessimistic !== undefined
      ) {
        duration = optimistic
          .add(mostLikely.mul(Fraction.of(4)))
          .add(pessimistic)
          .div(Fraction.of(6));
      } else {
        fail(`La actividad ${id} necesita "duration" o las tres estimaciones`);
      }
    }
    const activity: Activity = {
      id,
      name:
        typeof a["name"] === "string" && a["name"] !== "" ? a["name"] : null,
      predecessors: predecessors as string[],
      duration,
      ...(optimistic !== undefined ? { optimistic } : {}),
      ...(mostLikely !== undefined ? { mostLikely } : {}),
      ...(pessimistic !== undefined ? { pessimistic } : {}),
    };
    const normalCost = optional(a["normalCost"], `costo normal de ${id}`);
    const crashDuration = optional(
      a["crashDuration"],
      `duración de quiebre de ${id}`,
    );
    const crashCost = optional(a["crashCost"], `costo de quiebre de ${id}`);
    const crashCostPerUnit = optional(
      a["crashCostPerUnit"],
      `costo por unidad de ${id}`,
    );
    return {
      ...activity,
      ...(normalCost !== undefined ? { normalCost } : {}),
      ...(crashDuration !== undefined ? { crashDuration } : {}),
      ...(crashCost !== undefined ? { crashCost } : {}),
      ...(crashCostPerUnit !== undefined ? { crashCostPerUnit } : {}),
    };
  });
  return {
    title:
      typeof root["title"] === "string" && root["title"] !== ""
        ? root["title"]
        : null,
    activities,
  };
}

export function serializeProjectFile(problem: ProjectProblem): string {
  const out = (f: Fraction | undefined) =>
    f === undefined ? undefined : f.isInteger() ? Number(f.num) : f.toString();
  return `${JSON.stringify(
    {
      type: "project",
      title: problem.title ?? undefined,
      activities: problem.activities.map((a) => ({
        id: a.id,
        name: a.name ?? undefined,
        predecessors: a.predecessors,
        duration: out(a.duration),
        optimistic: out(a.optimistic),
        mostLikely: out(a.mostLikely),
        pessimistic: out(a.pessimistic),
        normalCost: out(a.normalCost),
        crashDuration: out(a.crashDuration),
        crashCost: out(a.crashCost),
        crashCostPerUnit: out(a.crashCostPerUnit),
      })),
    },
    null,
    2,
  )}\n`;
}
