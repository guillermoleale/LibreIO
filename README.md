# LibreIO

Software libre y didáctico de Investigación Operativa para la cátedra de la UTN Facultad Regional Rosario. Reemplaza GLP (método gráfico), LINDO (lenguaje de modelos y reporte de texto) y WinQSB (suite de módulos). Licencia GPL-3.0-or-later.

Cada algoritmo muestra su traza completa (tableaux, pivotes, iteraciones, nodos del árbol, ciclos) para que el alumno pueda seguir a mano lo que hace el programa. La aritmética es exacta, con fracciones; los decimales son solo una vista. La app no usa internet ni tiene cuentas ni telemetría.

## Usar

- Web, sin instalar nada: https://guillermoleale.com/LibreIO/. Después de la primera carga funciona sin conexión
- Escritorio: instaladores para Windows, macOS y Linux en [Releases](https://github.com/guillermoleale/LibreIO/releases/latest). Para máquinas sin permisos de instalación hay un `.exe` portable de Windows
- Manual para alumnos: [docs/manual.md](docs/manual.md)

Los instaladores no están firmados. En Windows, SmartScreen muestra un aviso: elegir "Más información" y después "Ejecutar de todas formas". En macOS, Gatekeeper bloquea la primera apertura: clic derecho sobre la app y "Abrir", o en Privacidad y seguridad elegir "Abrir de todas formas".

## Qué hace

- Programación lineal y entera: lenguaje de modelos compatible con LINDO con errores en español y número de línea, simplex con dos fases o Big M (M simbólica), regla de Dantzig o Bland, modo guiado donde el alumno elige el pivote, detección de óptimo, ilimitado, infactible, óptimos alternativos y degeneración, sensibilidad y dual, reporte combinado en español y clásico de LINDO en inglés, método gráfico interactivo con exportación a SVG y PNG, análisis paramétrico, ramificación y acotamiento con el árbol navegable y cortes de Gomory con la traza de cada corte
- Transporte y asignación: esquina noroeste, mínimo de matriz, de fila y de columna, Vogel y Russell, MODI iteración por iteración con el ciclo resaltado, balanceo automático, rutas prohibidas, transbordo y método húngaro paso a paso
- Redes: camino mínimo, flujo máximo con corte mínimo, árbol de expansión mínima por Kruskal y Prim y viajante exacto hasta 10 nodos, con el grafo dibujado y la solución resaltada paso a paso
- PERT/CPM: tiempos y holguras, caminos críticos, PERT con tres estimaciones y probabilidades, compresión al mínimo costo, red de actividades y Gantt
- Colas: M/M/1, M/M/s, M/M/1/K, M/M/s/K, M/M/s con población finita, M/G/1, M/D/1 y M/Ek/1 con medidas exactas, tabla de Pn, costos y análisis de capacidad
- Inventarios: EOQ y sus variantes, una sola compra con demanda discreta, uniforme o normal y revisión continua con stock de seguridad, con gráficos de nivel y de costos
- Decisiones: tabla de pagos con todos los criterios, revisión bayesiana, árboles de decisión dibujados y resueltos hacia atrás y juegos de suma cero con punto de silla, dominancia, resolución gráfica y programación lineal
- Programación dinámica: mochila y diligencia con la tabla de cada etapa
- Cadenas de Markov: clasificación de estados, distribución en n pasos, estado estable, tiempos medios de primer paso y de recurrencia y análisis de estados absorbentes

Todos los módulos copian su reporte al portapapeles y lo exportan a `.txt` y `.md`. Ctrl+Enter resuelve en cualquier módulo. El historial de versiones está en [CHANGELOG.md](CHANGELOG.md).

## Modelos

Los modelos de programación lineal se escriben en el formato de LINDO clásico, así que las guías de ejercicios existentes sirven tal cual:

```
TITLE Ejemplo de la cátedra
! Comentario hasta fin de línea
MAX 3X + 2Y
SUBJECT TO
  capacidad) 2X + Y <= 100
  horas)     X + Y <= 80
  demanda)   X <= 40
END
```

Los demás módulos tienen entrada tabular y se guardan en archivos `.io.json`. El detalle del lenguaje y de cada módulo está en [SPEC.md](SPEC.md). Hay ejemplos de cada módulo en `examples/`, que se cargan desde el menú de la app; para agregar ejercicios propios alcanza con copiar archivos `.lp` o `.io.json` a esa carpeta.

## Desarrollo

Requiere Node 24 y pnpm 12 (`corepack enable` alcanza). Para la app de escritorio hacen falta además Rust estable y las [dependencias de Tauri](https://v2.tauri.app/start/prerequisites/).

```
pnpm install
pnpm dev            UI en navegador
pnpm tauri dev      app de escritorio
pnpm test
pnpm typecheck
pnpm lint
pnpm e2e            tests de interfaz con Playwright sobre la versión web
pnpm build:web      salida estática para GitHub Pages
pnpm tauri build    instaladores de la plataforma actual
```

Estructura: `packages/core` tiene el núcleo en TypeScript puro (aritmética exacta con fracciones, parser, algoritmos y reportes), `apps/ui` la interfaz en React que se distribuye como web y como app Tauri, `examples/` los modelos de ejemplo y `docs/` el manual y las notas de diseño. Las decisiones tomadas durante el desarrollo están en [DECISIONS.md](DECISIONS.md). Para colaborar, ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Cómo citar

Si usás LibreIO en una publicación o en material de cátedra, podés citarlo con los datos de [CITATION.cff](CITATION.cff): Leale, G. (2026). LibreIO: software libre y didáctico de Investigación Operativa. https://github.com/guillermoleale/LibreIO

## Licencia

GPL-3.0-or-later. Las dependencias de terceros y sus licencias se listan en la pantalla Acerca de.
