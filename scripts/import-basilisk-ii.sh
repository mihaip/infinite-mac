#!/bin/bash

# Assumes that https://github.com/mihaip/macemu is in a sibling directory and
# it has been built

ROOT_DIR="`dirname "${BASH_SOURCE[0]}"`/.."
BASILISK_II_DIR="${ROOT_DIR}/../macemu/BasiliskII/src/Unix"
SRC_DIR="${ROOT_DIR}/src"
DATA_DIR="${SRC_DIR}/Data"
BASILISK_II_DESTINATION_DIR="${SRC_DIR}/BasiliskII"

# Build output
cp "${BASILISK_II_DIR}/BasiliskII" "${BASILISK_II_DESTINATION_DIR}/BasiliskII.jsz"
cp "${BASILISK_II_DIR}/BasiliskII.wasm" "${BASILISK_II_DESTINATION_DIR}/BasiliskII.wasmz"
cp "${BASILISK_II_DIR}/BasiliskII.wasm.map" "${BASILISK_II_DESTINATION_DIR}/BasiliskII.wasm.map"

# ROM and disk images
gzip -k "${BASILISK_II_DIR}/Quadra-650.rom" "${BASILISK_II_DIR}/MacOS753.img" "${BASILISK_II_DIR}/Games.img"
mv "${BASILISK_II_DIR}/Quadra-650.rom.gz" "${BASILISK_II_DIR}/MacOS753.img.gz" "${BASILISK_II_DIR}/Games.img.gz" "${DATA_DIR}/"
