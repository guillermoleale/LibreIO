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
