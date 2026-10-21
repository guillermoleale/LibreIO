// SPDX-License-Identifier: GPL-3.0-or-later
import { es, type StringKey } from "./es";

/** Devuelve el texto de interfaz para la clave. Preparado para agregar idiomas. */
export function t(key: StringKey): string {
  return es[key];
}

export type { StringKey };
