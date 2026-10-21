# LibreIO

Software libre y didáctico de Investigación Operativa para la cátedra de la UTN Facultad Regional Rosario. Reemplaza GLP (método gráfico), LINDO (lenguaje de modelos y reporte de texto) y WinQSB (suite de módulos). Licencia GPL-3.0-or-later.

## Usar

- Web, sin instalar nada: https://guillermoleale.com/LibreIO/
- Escritorio: instaladores para Windows, macOS y Linux en [Releases](https://github.com/guillermoleale/LibreIO/releases). Para máquinas sin permisos de instalación hay un `.exe` portable de Windows

Los instaladores no están firmados. En Windows, SmartScreen muestra un aviso: elegir "Más información" y después "Ejecutar de todas formas". En macOS, Gatekeeper bloquea la primera apertura: clic derecho sobre la app y "Abrir", o en Privacidad y seguridad elegir "Abrir de todas formas".

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
