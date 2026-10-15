#!/bin/bash

# Assumes that the emulator Git submodule has been fetched and it has been
# built.

ROOT_DIR="`dirname "${BASH_SOURCE[0]}"`/.."
JS_EXTENSION=""

lint_emulator() (
    # Run in a subshell so the cleanup trap does not affect the import script.
    # Oxlint selects its parser by extension, but some emulator outputs have none.
    local emulator_lint_dir
    emulator_lint_dir="$(mktemp -d)" || exit $?
    trap 'unlink "$emulator_lint_dir/emulator.js"; rmdir "$emulator_lint_dir"' EXIT
    cp "$1" "$emulator_lint_dir/emulator.js" || exit $?

    # Allow host APIs and Emscripten's optional, typeof-guarded Browser/GL/SDL
    # helpers, but reject missing dependencies before copying emulator artifacts.
    "${ROOT_DIR}/node_modules/.bin/vp" lint \
        --config "${ROOT_DIR}/scripts/emulator-lint.json" \
        --no-ignore "$emulator_lint_dir/emulator.js"
)

if [ "$1" = "basiliskii" ]; then
    EMULATOR="BasiliskII"
    EMULATOR_DIR="${ROOT_DIR}/macemu/${EMULATOR}/src/Unix"
elif [ "$1" = "sheepshaver" ]; then
    EMULATOR="SheepShaver"
    EMULATOR_DIR="${ROOT_DIR}/macemu/${EMULATOR}/src/Unix"
elif [[ "$1" =~ ^minivmac- ]]; then
    EMULATOR=$1
    EMULATOR_DIR="${ROOT_DIR}/minivmac"
elif [ "$1" = "dingusppc" ]; then
    EMULATOR=$1
    JS_EXTENSION=".js"
    EMULATOR_DIR="${ROOT_DIR}/dingusppc/build/bin"
elif [ "$1" = "previous" ]; then
    EMULATOR=$1
    JS_EXTENSION=".js"
    EMULATOR_DIR="${ROOT_DIR}/previous/build/src"
elif [ "$1" = "pearpc" ]; then
    EMULATOR=ppc
    EMULATOR_DIR="${ROOT_DIR}/pearpc/src"
elif [ "$1" = "snow" ]; then
    EMULATOR=snow
    JS_EXTENSION=".js"
    EMULATOR_DIR="${ROOT_DIR}/snow/target/wasm32-unknown-emscripten/release"
else
    echo "Unknown emulator $1"
    exit 1
fi

SRC_DIR="${ROOT_DIR}/src"
PUBLIC_DIR="${ROOT_DIR}/public"
EMULATOR_DESTINATION_DIR="${SRC_DIR}/emulator/worker/emscripten"

if [ ! -f "${EMULATOR_DIR}/${EMULATOR}.wasm" ]; then
    echo "${EMULATOR} has not been built. Refer to the README for details."
    exit
fi

# Check the linked JS for missing dependencies before importing any files.
lint_emulator "${EMULATOR_DIR}/${EMULATOR}${JS_EXTENSION}" || exit $?

mkdir -p "${EMULATOR_DESTINATION_DIR}"
# Build output
cp "${EMULATOR_DIR}/${EMULATOR}${JS_EXTENSION}" "${EMULATOR_DESTINATION_DIR}/${EMULATOR}.js"
cp "${EMULATOR_DIR}/${EMULATOR}.wasm" "${EMULATOR_DESTINATION_DIR}/${EMULATOR}.wasm"
# Source map needs massaging and needs to be put into the public directory (we
# don't control the URL that it's referenced under).
scripts/rewrite-emulator-source-map.py "${EMULATOR_DIR}/${EMULATOR}.wasm.map" "${PUBLIC_DIR}/${EMULATOR}.wasm.map"
