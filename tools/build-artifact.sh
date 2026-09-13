#!/usr/bin/env bash
# build-artifact.sh — arma el árbol publicable del artifact en un directorio.
#
# El artifact se publica como página + archivos de apoyo en sus mismas rutas
# relativas, así que "construir" es copiar: no hay bundler, nada se minifica y
# src/ llega tal cual está. Sirve además para revisar la piel del artifact en
# local antes de publicar.
#
#   tools/build-artifact.sh [destino]   (por defecto: build/)

set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="${1:-$AQUI/build}"

mkdir -p "$DESTINO/src/musica" "$DESTINO/host"

# index.html es la página; el resto son los archivos de apoyo que referencia.
cp "$AQUI/artifact/page.html" "$DESTINO/index.html"
cp "$AQUI/src/app.mjs"        "$DESTINO/src/app.mjs"
cp "$AQUI/src/app.css"        "$DESTINO/src/app.css"
cp "$AQUI/src/icon.svg"       "$DESTINO/src/icon.svg"
cp "$AQUI/src/iconos.mjs"     "$DESTINO/src/iconos.mjs"
cp "$AQUI/src/sonido.mjs"     "$DESTINO/src/sonido.mjs"
cp "$AQUI/src/fx.mjs"         "$DESTINO/src/fx.mjs"
cp "$AQUI/src/musica.mjs"     "$DESTINO/src/musica.mjs"
cp "$AQUI/src/idioma.mjs"     "$DESTINO/src/idioma.mjs"
cp "$AQUI/src/ranking.mjs"    "$DESTINO/src/ranking.mjs"
cp "$AQUI/src/musica/snake_cogue_pite.mp3" "$DESTINO/src/musica/snake_cogue_pite.mp3"
cp "$AQUI/host/boot.mjs"      "$DESTINO/host/boot.mjs"
cp "$AQUI/host/os-shim.mjs"   "$DESTINO/host/os-shim.mjs"

# host/shell.css NO se copia a propósito: es la piel de desarrollo local y
# artifact/page.html trae la suya. Cargar las dos las haría pelear en la cascada.

echo "Construido en: $DESTINO"
find "$DESTINO" -type f | sed "s#^$DESTINO#  .#" | sort
