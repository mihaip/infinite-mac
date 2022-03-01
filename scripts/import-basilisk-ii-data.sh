#!/bin/bash

# Assumes that the https://github.com/mihaip/macemu submodule has been fetched
# and it has been built.

ROOT_DIR="`dirname "${BASH_SOURCE[0]}"`/.."
BASILISK_II_DIR="${ROOT_DIR}/macemu/BasiliskII/src/Unix"
DATA_DIR="${ROOT_DIR}/src/Data"
PUBLIC_DIR="${ROOT_DIR}/public"

# ROM
cp "${BASILISK_II_DIR}/Quadra-650.rom" "${DATA_DIR}/"

rm -rf "${PUBLIC_DIR}/Disk"
mkdir "${PUBLIC_DIR}/Disk"
scripts/build-disk-image.py "${BASILISK_II_DIR}/System 7.5.3 HD.dsk" "${PUBLIC_DIR}/Disk" "${DATA_DIR}/"
scripts/build-disk-image.py "${BASILISK_II_DIR}/Mac OS 8.1 HD.dsk" "${PUBLIC_DIR}/Disk" "${DATA_DIR}/"
