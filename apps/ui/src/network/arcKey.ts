// SPDX-License-Identifier: GPL-3.0-or-later
/** Clave de un arco para los mapas de resaltado del grafo. */
export function arcKey(from: string, to: string): string {
  return `${from}|${to}`;
}
