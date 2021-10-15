#!/bin/bash

# Assumes that the https://github.com/mihaip/macemu submodule has been fetched
# and it has been built.

ROOT_DIR="`dirname "${BASH_SOURCE[0]}"`/.."
BASILISK_II_DIR="${ROOT_DIR}/macemu/BasiliskII/src/Unix"
DATA_DIR="${ROOT_DIR}/src/Data"
PUBLIC_DIR="${ROOT_DIR}/public"

# ROM
brotli -q 11 -k "${BASILISK_II_DIR}/Quadra-650.rom"
mv "${BASILISK_II_DIR}/Quadra-650.rom.br"  "${DATA_DIR}/"

scripts/build-disk-image.py "${BASILISK_II_DIR}/Macintosh HD.dsk" "${PUBLIC_DIR}/Disk" "${DATA_DIR}/"
