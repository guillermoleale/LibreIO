# LibreIO

Software libre y didáctico de Investigación Operativa para la cátedra de la UTN Facultad Regional Rosario. Reemplaza GLP (método gráfico), LINDO (lenguaje de modelos y reporte de texto) y WinQSB (suite de módulos). El nombre es provisorio.

Leé `SPEC.md` antes de cualquier tarea. Es la fuente de verdad funcional. Si una decisión no está en el spec, tomala según la política de autonomía de más abajo y anotala en `DECISIONS.md`. No preguntes.

## Principios

1. Didáctico antes que rápido. Cada algoritmo expone su traza completa: iteraciones, pivotes, nodos del árbol, ciclos. El alumno tiene que poder seguir a mano lo que hace el programa.
2. Aritmética exacta. El núcleo trabaja con fracciones sobre BigInt. Los decimales son solo una vista.
3. Núcleo sin interfaz. `packages/core` no importa nada del DOM ni de React. Se puede usar desde Node, desde tests o desde cualquier otra interfaz.
4. Un solo código, dos distribuciones: app de escritorio (Tauri) y versión web (GitHub Pages). No se agregan funciones que anden en una sola de las dos.
5. Sin red. La app no hace llamadas a internet, no tiene telemetría ni cuentas. Funciona sin conexión.
6. Software libre. Licencia GPL-3.0-or-later. Toda dependencia nueva tiene que ser compatible (MIT, Apache-2.0, BSD, LGPL, MPL). Ante la duda, no se agrega.

## Stack

- pnpm workspaces. TypeScript strict en todo el repo
- `packages/core`: TypeScript puro, sin dependencias de runtime
- `apps/ui`: Vite + React + TypeScript. Gráficos en SVG propio, sin librerías de charting
- `apps/ui/src-tauri`: Tauri 2 como envoltorio mínimo. Sin lógica de negocio en Rust
- Tests: Vitest. Verificación cruzada contra `highs` (WASM) solo como devDependency
- CI: GitHub Actions. Builds de escritorio para Windows, macOS (x64 y arm64) y Linux. Deploy web a GitHub Pages

## Estructura

```
libreio/
  packages/core/src/
    rational/      Fraction sobre BigInt
    parser/        formato LINDO, errores con número de línea
    lp/            forma estándar, simplex, dos fases, Big M, pivoteo manual, sensibilidad, dual, paramétrico
    ilp/           branch and bound, árbol
    transport/     transporte, transbordo y asignación
    network/       camino mínimo, flujo máximo, árbol de expansión mínima, viajante
    pert/          PERT, CPM y compresión
    queueing/      modelos de colas y análisis de costos
    inventory/     modelos de inventario
    decision/      tablas de pagos, Bayes, árboles de decisión, juegos de suma cero
    dp/            programación dinámica
    markov/        cadenas de Markov
    report/        reportes de texto por módulo, combinado y clásico
  packages/core/tests/
  apps/ui/src/     React, un directorio por módulo, componentes compartidos en common/
  apps/ui/src-tauri/
  examples/        modelos de ejemplo por módulo, cargados desde la UI
  docs/            manual para alumnos y notas de diseño
  DECISIONS.md     una línea por decisión tomada sin consultar: fecha, qué y por qué
  .github/workflows/
```

## Convenciones

- Identificadores en inglés. Comentarios, documentación, mensajes de commit e interfaz en español
- Cada módulo de `core` expone `parse`, `solve` y `report`. `solve` devuelve un objeto con `status`, `solution` y `trace`. `report` devuelve texto plano monoespaciado
- Un archivo por algoritmo con nombre descriptivo: `twoPhaseSimplex.ts`, `vogelApproximation.ts`, `hungarian.ts`
- Tests con ejemplos de libros de texto (Hillier y Lieberman, Taha, Winston) y la solución esperada escrita en el test. Tests golden para cada reporte de texto
- Commits convencionales: `feat(lp): ...`, `fix(parser): ...`, `docs: ...`, `ci: ...`
- Una tarea está terminada cuando `pnpm test`, `pnpm typecheck` y `pnpm lint` están en verde
- No se agregan dependencias sin justificarlo en el mensaje de commit
- Encabezado SPDX en cada archivo fuente: `// SPDX-License-Identifier: GPL-3.0-or-later`
- Sin rayas (—) ni coma de Oxford en textos. Sin las palabras "clave" ni "crucial"

## Comandos

```
pnpm install
pnpm dev            UI en navegador
pnpm tauri dev      app de escritorio
pnpm test
pnpm typecheck
pnpm lint
pnpm build:web      salida estática para GitHub Pages
pnpm tauri build    instaladores de la plataforma actual
```

## Flujo de trabajo

- Trabajar por fases según la sección 8 de `SPEC.md`. No se empieza una fase sin cerrar la anterior
- Cada módulo empieza por sus casos de aceptación del apéndice A de `SPEC.md`, escritos como tests antes del código. Después `solve`, después `report`, por último la interfaz
- Una fase cierra cuando todos sus casos de aceptación están en verde, CI pasa en las tres plataformas y hay un tag. Entonces se marca con X su casilla en `SPEC.md` y se sigue con la siguiente sin esperar
- Ante un cambio que afecte el formato de entrada o el layout de un reporte, actualizar `SPEC.md` en el mismo commit

## Política de autonomía

Objetivo inmediato: publicar `v1.0.0` (Fase 0 más Fase 1 completas, instaladores en Releases y web en Pages) lo antes posible, en una sola corrida y sin pausas.

Regla general: toda pregunta que tenga una respuesta aceptable por defecto se responde sola. Se decide, se anota una línea en `DECISIONS.md` y se sigue. Preguntar es la excepción, no el hábito.

Decisiones ya tomadas, no se reabren:

- Node LTS vigente y pnpm. Versiones estables más recientes de cada dependencia al momento de iniciar, fijadas en el lockfile
- ESLint con la configuración recomendada de TypeScript y Prettier con sus valores por defecto. No se discute estilo
- Nombre LibreIO hasta nuevo aviso. Identificador del bundle de Tauri `ar.edu.utn.frro.libreio`. Ventana inicial de 1200 por 800, redimensionable
- Base path de GitHub Pages `/libreio/`
- Vista numérica por defecto en fracciones. Método por defecto dos fases con regla de Dantzig. Ante empate, entra la variable de menor índice
- Versionado semver. Tags `v0.x.y` durante las fases 0 y 1, `v1.0.0` al cerrar la fase 1, un tag por fase después
- Una sola paleta neutra. Para el gráfico, un color por restricción tomado de una lista fija de ocho colores con buen contraste
- La entrada tabular se guarda en formato `.lp`
- Mínimo cinco ejemplos por módulo en `examples/`, que incluyen los casos de aceptación
- Si falta una herramienta (Rust, dependencias de Linux para Tauri, un runtime), se instala. Si no se puede instalar, se anota en `DECISIONS.md` y se sigue con todo lo que no dependa de ella

Se detiene y pregunta solo ante:

- Una acción irreversible fuera del repo: pagar algo, borrar un recurso externo, publicar en un registro que no sea GitHub Releases o Pages
- Una contradicción entre `SPEC.md` y un caso de aceptación que la aritmética no resuelva

Un caso de aceptación que no pasa después de tres enfoques distintos se marca `test.todo` con una nota en `DECISIONS.md` y la fase sigue. Nunca se ajusta el valor esperado para que el test pase.

No se pide confirmación para crear o borrar archivos del repo, instalar dependencias compatibles con la licencia, refactorizar, correr CI, crear tags ni publicar releases.
