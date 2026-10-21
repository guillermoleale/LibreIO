// SPDX-License-Identifier: GPL-3.0-or-later
// Evita una consola adicional en Windows en modo release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    libreio_lib::run();
}
