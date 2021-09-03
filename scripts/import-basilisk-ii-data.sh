#!/bin/bash

# Assumes that https://github.com/mihaip/macemu is in a sibling directory and
# it has been built

ROOT_DIR="`dirname "${BASH_SOURCE[0]}"`/.."
BASILISK_II_DIR="${ROOT_DIR}/../macemu/BasiliskII/src/Unix"
DATA_DIR="${ROOT_DIR}/src/Data"

# ROM and disk images
brotli -q 11 -k "${BASILISK_II_DIR}/Quadra-650.rom" "${BASILISK_II_DIR}/Macintosh HD.dsk"
mv "${BASILISK_II_DIR}/Quadra-650.rom.br" "${BASILISK_II_DIR}/Macintosh HD.dsk.br" "${DATA_DIR}/"
