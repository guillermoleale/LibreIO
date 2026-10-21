// SPDX-License-Identifier: GPL-3.0-or-later
// Descarga de archivos de texto y binarios con el mismo código en web y escritorio.
import { isTauri, saveTextFile } from "./files";

export async function downloadText(
  text: string,
  name: string,
  extension: string,
  filterName: string,
): Promise<void> {
  await saveTextFile(text, name, [extension], filterName);
}

export async function downloadBinary(
  bytes: Uint8Array,
  name: string,
  extension: string,
  filterName: string,
  mime: string,
): Promise<void> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: name,
      filters: [{ name: filterName, extensions: [extension] }],
    });
    if (path) {
      await writeFile(path, bytes);
    }
    return;
  }
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Convierte un SVG a PNG dibujándolo en un canvas. */
export function svgToPng(
  svgText: string,
  width: number,
  height: number,
  background: string,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Sin contexto de canvas"));
        return;
      }
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (!png) {
          reject(new Error("No se pudo generar el PNG"));
          return;
        }
        png
          .arrayBuffer()
          .then((buffer) => resolve(new Uint8Array(buffer)))
          .catch(reject);
      }, "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar el SVG"));
    };
    image.src = url;
  });
}
