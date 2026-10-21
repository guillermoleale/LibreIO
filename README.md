# LibreIO

Software libre y didáctico de Investigación Operativa para la cátedra de la UTN Facultad Regional Rosario. Reemplaza GLP (método gráfico), LINDO (lenguaje de modelos y reporte de texto) y WinQSB (suite de módulos). Licencia GPL-3.0-or-later.

## Usar

- Web, sin instalar nada: https://guillermoleale.com/LibreIO/
- Escritorio: instaladores para Windows, macOS y Linux en [Releases](https://github.com/guillermoleale/LibreIO/releases). Para máquinas sin permisos de instalación hay un `.exe` portable de Windows

Los instaladores no están firmados. En Windows, SmartScreen muestra un aviso: elegir "Más información" y después "Ejecutar de todas formas". En macOS, Gatekeeper bloquea la primera apertura: clic derecho sobre la app y "Abrir", o en Privacidad y seguridad elegir "Abrir de todas formas".

## Qué hace la versión 1.0

Programación lineal, que reemplaza a GLP y LINDO:

- Lenguaje de modelos compatible con LINDO, con errores en español y número de línea
- Simplex tableau con dos fases o Big M (M simbólica), regla de Dantzig o Bland, y traza completa: cada tableau con la variable que entra, la que sale, el pivote y las razones mínimas
- Modo guiado: el alumno elige la variable que entra y opcionalmente la que sale, y el programa valida la elección
- Detección de óptimo, ilimitado, infactible, óptimos alternativos y degeneración, con mensajes explicativos
- Sensibilidad: costos reducidos, precios sombra y duales, rangos de coeficientes y de lado derecho. Formulación y solución del dual
- Reporte combinado en español con las columnas de WinQSB y reporte clásico de LINDO en inglés, exportables a `.txt` y `.md`
- Método gráfico para dos variables con región factible, vértices exactos, recta de Z desplazable, zoom, arrastre del lado derecho de una restricción y exportación a SVG y PNG
- Aritmética exacta con fracciones y vista decimal opcional

## Qué agrega la versión 1.1

- Análisis paramétrico del lado derecho de una fila o del coeficiente de una variable, con tramos, quiebres, gráfico de Z y formato clásico de LINDO PARA
- Programación entera por ramificación y acotamiento con el árbol completo navegable, grilla de puntos enteros en el gráfico y reporte clásico con `NEW INTEGER SOLUTION` y `ENUMERATION COMPLETE`
- Transporte con esquina noroeste, mínimo de matriz, de fila y de columna, Vogel y Russell, MODI iteración por iteración con el ciclo resaltado, balanceo automático, rutas prohibidas y rangos de costos
- Transbordo reducido a transporte con buffer y asignación por el método húngaro con cada reducción y cobertura
- Entrada tabular estilo WinQSB sincronizada con el texto y archivos `.io.json` para los módulos no lineales

## Qué agrega la versión 1.2

- Redes: camino mínimo con Dijkstra y traza de etiquetas, flujo máximo con caminos de aumento y corte mínimo, árbol de expansión mínima por Kruskal y Prim, y viajante exacto hasta 10 nodos con vecino más cercano e inserción más barata como comparación. Grafo dibujado por capas con la solución resaltada paso a paso
- PERT/CPM: tiempos tempranos y tardíos, holguras total y libre, caminos críticos, PERT con tres estimaciones y probabilidades, compresión al mínimo costo con curva de costo contra duración, red de actividades en nodos y Gantt

## Qué agrega la versión 1.3

- Colas: M/M/1, M/M/s, M/M/1/K, M/M/s/K, M/M/s con población finita, M/G/1, M/D/1 y M/Ek/1 con todas las medidas exactas en fracciones, tabla de Pn, análisis de costos y de capacidad variando s, λ, μ o K
- Inventarios: EOQ básico, con faltantes, con tasa de producción finita, con tiempo de entrega y con descuentos por cantidad; una sola compra con demanda discreta, uniforme o normal; revisión continua con stock de seguridad; gráficos de nivel y de costos contra Q
- Decisiones: tabla de pagos con maximax, maximin, Laplace, Hurwicz, Savage, valor esperado, arrepentimiento esperado y VEIP; revisión bayesiana con VEIM y eficiencia; árboles de decisión dibujados y resueltos hacia atrás; juegos de suma cero con punto de silla, dominancia, resolución gráfica y programación lineal

## Qué agregan las versiones 1.4 y 1.5

- 1.4: programación dinámica (mochila con varias unidades y diligencia con etapas dadas o deducidas, con la tabla de cada etapa) y cadenas de Markov (clasificación de estados, distribución en n pasos, estado estable, tiempos medios de primer paso y de recurrencia y análisis de estados absorbentes), todo en fracciones exactas
- 1.5: manual para alumnos en [docs/manual.md](docs/manual.md), versión web que funciona sin conexión después de la primera carga (PWA con service worker) y cortes de Gomory como método alternativo para programación entera, con la traza de cada corte

## Modelos

Los modelos se escriben en el formato de LINDO clásico, así que las guías de ejercicios existentes sirven tal cual:

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

El detalle del lenguaje y de cada módulo está en [SPEC.md](SPEC.md).

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

Estructura: `packages/core` tiene el núcleo en TypeScript puro (aritmética exacta con fracciones, parser, algoritmos y reportes), `apps/ui` la interfaz en React que se distribuye como web y como app Tauri, `examples/` los modelos de ejemplo y `docs/` las notas de diseño. Las decisiones tomadas sin consultar están en [DECISIONS.md](DECISIONS.md).
