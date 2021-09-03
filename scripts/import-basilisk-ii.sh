#!/bin/bash

# Assumes that https://github.com/mihaip/macemu is in a sibling directory and
# it has been built

ROOT_DIR="`dirname "${BASH_SOURCE[0]}"`/.."
BASILISK_II_DIR="${ROOT_DIR}/../macemu/BasiliskII/src/Unix"
SRC_DIR="${ROOT_DIR}/src"
DATA_DIR="${SRC_DIR}/Data"
PUBLIC_DIR="${ROOT_DIR}/public"
BASILISK_II_DESTINATION_DIR="${SRC_DIR}/BasiliskII"

# Build output
cp "${BASILISK_II_DIR}/BasiliskII" "${BASILISK_II_DESTINATION_DIR}/BasiliskII.jsz"
cp "${BASILISK_II_DIR}/BasiliskII.wasm" "${BASILISK_II_DESTINATION_DIR}/BasiliskII.wasmz"
# Source map needs massaging and needs to be put into the public directory (we
# don't control the URL that it's referenced under).
scripts/rewrite-basilisk-ii-source-map.py "${BASILISK_II_DIR}/BasiliskII.wasm.map" "${PUBLIC_DIR}/BasiliskII.wasm.map"
