// SPDX-License-Identifier: GPL-3.0-or-later
// Dependencias de terceros que llegan al usuario final, con sus licencias.

export interface Dependency {
  readonly name: string;
  readonly license: string;
  readonly url: string;
  readonly scope: "web y escritorio" | "solo escritorio";
}

export const dependencies: readonly Dependency[] = [
  {
    name: "React",
    license: "MIT",
    url: "https://react.dev",
    scope: "web y escritorio",
  },
  {
    name: "Tauri",
    license: "MIT o Apache-2.0",
    url: "https://tauri.app",
    scope: "solo escritorio",
  },
  {
    name: "tauri-plugin-dialog",
    license: "MIT o Apache-2.0",
    url: "https://tauri.app/plugin/dialog/",
    scope: "solo escritorio",
  },
  {
    name: "tauri-plugin-fs",
    license: "MIT o Apache-2.0",
    url: "https://tauri.app/plugin/file-system/",
    scope: "solo escritorio",
  },
  {
    name: "tauri-plugin-log",
    license: "MIT o Apache-2.0",
    url: "https://tauri.app/plugin/logging/",
    scope: "solo escritorio",
  },
];

export const repositoryUrl = "https://github.com/guillermoleale/LibreIO";
export const appVersion: string = __APP_VERSION__;
