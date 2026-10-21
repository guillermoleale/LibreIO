// SPDX-License-Identifier: GPL-3.0-or-later
// Ejemplos incorporados: se leen de examples/ en tiempo de build, así hay una sola copia en el repo.

export interface Example {
  readonly id: string;
  readonly name: string;
  readonly text: string;
}

const files = import.meta.glob("../../../../examples/lp/*.lp", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function titleOf(text: string, fallback: string): string {
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*TITLE\s+(.*)$/i.exec(line);
    if (match) {
      return match[1]!.trim();
    }
  }
  return fallback;
}

export const lpExamples: readonly Example[] = Object.entries(files)
  .map(([path, text]) => {
    const file = path.split("/").pop() ?? path;
    const id = file.replace(/\.lp$/, "");
    return { id, name: titleOf(text, id), text };
  })
  .sort((a, b) => a.id.localeCompare(b.id, "es"));

const transportFiles = import.meta.glob(
  "../../../../examples/transport/*.io.json",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
) as Record<string, string>;

function jsonTitle(text: string, fallback: string): string {
  try {
    const parsed = JSON.parse(text) as { title?: unknown };
    return typeof parsed.title === "string" && parsed.title !== ""
      ? parsed.title
      : fallback;
  } catch {
    return fallback;
  }
}

export const transportExamples: readonly Example[] = Object.entries(
  transportFiles,
)
  .map(([path, text]) => {
    const file = path.split("/").pop() ?? path;
    const id = file.replace(/\.io\.json$/, "");
    return { id, name: jsonTitle(text, id), text };
  })
  .sort((a, b) => a.id.localeCompare(b.id, "es"));
