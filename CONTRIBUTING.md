# Cómo colaborar

Gracias por el interés en LibreIO. Hay tres formas de ayudar.

## Reportar un error o un resultado distinto al esperado

Abrí un issue con el modelo que usaste (el texto `.lp` o el archivo `.io.json`), el resultado que obtuviste y el que esperabas, con la fuente (libro, guía de la cátedra o cálculo a mano). Si el error aparece en la app de escritorio, indicá el sistema operativo y la versión de LibreIO, que figura en la pantalla Acerca de.

## Aportar ejercicios

Los ejemplos viven en `examples/<módulo>/` y se cargan solos en el menú de la app. Para agregar uno, copiá un archivo `.lp` o `.io.json` con un nombre descriptivo y, si se puede, la solución esperada en un comentario o en el título. Los ejercicios de guías de la cátedra son bienvenidos siempre que no tengan derechos de terceros que impidan publicarlos bajo GPL.

## Cambiar código

1. Leé `SPEC.md`, que es la fuente de verdad funcional, y `docs/notas-de-diseno.md`.
2. Cada módulo de `packages/core` expone `parse`, `solve` y `report`, y `solve` devuelve `status`, `solution` y `trace`. El núcleo no importa nada del DOM ni de React y trabaja con fracciones exactas.
3. Escribí primero el test con un ejemplo de libro de texto y la solución esperada, después el código. Nunca se ajusta el valor esperado para que el test pase.
4. Un cambio está listo cuando `pnpm test`, `pnpm typecheck`, `pnpm lint` y `pnpm e2e` están en verde.
5. Identificadores en inglés; comentarios, interfaz, documentación y mensajes de commit en español. Commits convencionales: `feat(lp): ...`, `fix(parser): ...`, `docs: ...`.
6. Encabezado `// SPDX-License-Identifier: GPL-3.0-or-later` en cada archivo fuente. Toda dependencia nueva tiene que tener licencia compatible (MIT, Apache-2.0, BSD, LGPL, MPL) y justificarse en el commit.
7. Nada de llamadas a internet, telemetría ni funciones que anden solo en la web o solo en el escritorio.

Al enviar un pull request aceptás que tu aporte se distribuya bajo GPL-3.0-or-later.
