# Decisiones tomadas sin consultar

Una línea por decisión: fecha, qué y por qué. Ver la política de autonomía en `CLAUDE.md`.

- 2026-10-21. `CLAUDE.md` y `SPEC.md` se mueven de `_aux/` a la raíz del repo, porque `CLAUDE.md` los referencia ahí y la estructura de la sección "Estructura" los espera en la raíz.
- 2026-10-21. TypeScript 6.0.3 en lugar de 7.0.2, porque typescript-eslint 8.72 (necesario para la configuración recomendada de ESLint) exige `typescript <6.1.0`. Se sube a 7 cuando typescript-eslint lo soporte.
- 2026-10-21. Node 24 LTS (Krypton) en CI y en `engines`. pnpm 12.14.0 fijado en `packageManager`. Resto de dependencias en su última versión estable al 2026-10-21, fijadas en `pnpm-lock.yaml`.
- 2026-10-21. La máquina local no tiene sudo ni Rust, así que no se pueden instalar las dependencias de Linux de Tauri (webkit2gtk). Los builds de escritorio se verifican solo en GitHub Actions. Localmente se verifican tests, typecheck, lint, build web y Playwright.
- 2026-10-21. GitHub Pages habilitado por API con origen "GitHub Actions" (la cuenta es Pro, que admite Pages en repos privados). El sitio queda público aunque el repo sea privado. El dominio personalizado de la cuenta hace que la URL sea `guillermoleale.com/LibreIO/`. El base path `/libreio/` se mantiene porque Pages no distingue mayúsculas en el nombre del repo. Se verifica tras el primer deploy.
