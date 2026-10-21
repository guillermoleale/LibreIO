// SPDX-License-Identifier: GPL-3.0-or-later
// Abrir y guardar archivos con el mismo código en web y escritorio.
// En Tauri se usan los diálogos nativos. En el navegador, carga y descarga de archivos.

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export interface OpenedFile {
  readonly name: string;
  readonly text: string;
}

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" && window.__TAURI_INTERNALS__ !== undefined
  );
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}

export async function openTextFile(
  extensions: readonly string[],
  filterName: string,
): Promise<OpenedFile | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: filterName, extensions: [...extensions] }],
    });
    if (typeof selected !== "string") {
      return null;
    }
    const text = await readTextFile(selected);
    return { name: baseName(selected), text };
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = extensions.map((e) => `.${e}`).join(",");
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      file
        .text()
        .then((text) => resolve({ name: file.name, text }))
        .catch(() => resolve(null));
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

export async function saveTextFile(
  text: string,
  suggestedName: string,
  extensions: readonly string[],
  filterName: string,
): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: suggestedName,
      filters: [{ name: filterName, extensions: [...extensions] }],
    });
    if (!path) {
      return false;
    }
    await writeTextFile(path, text);
    return true;
  }
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
