#!/bin/bash
set -euo pipefail

# Invoked inside macemu_emsdk by build-stuffit-decoder.sh.
cd /stuffit/wasm
export CARGO_TARGET_DIR=/tmp/stuffit-target

# We don't have Clippy set up in CI, for now just check it every time we build.
cargo clippy \
    --locked \
    --release \
    --target wasm32-unknown-unknown \
    --no-deps \
    -- \
    -D warnings


cargo build --locked --release --target wasm32-unknown-unknown
wasm-bindgen \
    --target web \
    --omit-default-module-path \
    --out-dir /stuffit/generated \
    --out-name stuffit \
    "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/stuffit_decoder.wasm"

# Have slightly nicer file names.
mv /stuffit/generated/stuffit_bg.wasm /stuffit/generated/stuffit.wasm
mv /stuffit/generated/stuffit_bg.wasm.d.ts /stuffit/generated/stuffit.wasm.d.ts
