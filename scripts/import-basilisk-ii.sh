#!/bin/bash

# Assumes that the https://github.com/mihaip/macemu submodule has been fetched
# and it has been built.

ROOT_DIR="`dirname "${BASH_SOURCE[0]}"`/.."
BASILISK_II_DIR="${ROOT_DIR}/macemu/BasiliskII/src/Unix"
SRC_DIR="${ROOT_DIR}/src"
PUBLIC_DIR="${ROOT_DIR}/public"
BASILISK_II_DESTINATION_DIR="${SRC_DIR}/BasiliskII"

if [ ! -f "${BASILISK_II_DIR}/BasiliskII.wasm" ]; then
    echo "Basilisk II has not been built. Refer to the README for details."
    exit
fi

# Build output
cp "${BASILISK_II_DIR}/BasiliskII" "${BASILISK_II_DESTINATION_DIR}/BasiliskII.jsz"
cp "${BASILISK_II_DIR}/BasiliskII.wasm" "${BASILISK_II_DESTINATION_DIR}/BasiliskII.wasmz"
# Source map needs massaging and needs to be put into the public directory (we
# don't control the URL that it's referenced under).
scripts/rewrite-basilisk-ii-source-map.py "${BASILISK_II_DIR}/BasiliskII.wasm.map" "${PUBLIC_DIR}/BasiliskII.wasm.map"
