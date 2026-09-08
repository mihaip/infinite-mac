#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Requires the existing macemu_emsdk Docker image; generated assets are committed.
scripts/docker-shell.sh -c '
set -euo pipefail
source /emsdk/emsdk_env.sh
cd /pict/wasm
export CARGO_TARGET_DIR=/tmp/pict-target
export RUSTFLAGS="-C link-arg=-sMODULARIZE -C link-arg=-sEXPORT_ES6 -C link-arg=-sEXPORT_NAME=createPictRenderer -C link-arg=-sENVIRONMENT=web -C link-arg=-sALLOW_MEMORY_GROWTH -C link-arg=-sMAXIMUM_MEMORY=268435456 -C link-arg=-sSTACK_SIZE=1048576 -C link-arg=-sFILESYSTEM=0 -C link-arg=-sEXPORTED_FUNCTIONS=[_pict_allocate,_pict_free,_pict_decode] -C link-arg=-sEXPORTED_RUNTIME_METHODS=[HEAPU8,HEAPU32]"
cargo build --locked --release --target wasm32-unknown-emscripten
cp "$CARGO_TARGET_DIR/wasm32-unknown-emscripten/release/pict-renderer.js" /pict/generated/pict.js
cp "$CARGO_TARGET_DIR/wasm32-unknown-emscripten/release/pict_renderer.wasm" /pict/generated/pict.wasm
'
