# PICT previews

`renderPict(bytes)` returns an RGBA bitmap using the pinned
`third-party/oxideav-pict` fork. The crate is built with `default-features = false`;
there are no third-party runtime crates beyond the decoder itself. Its MIT license
is in the submodule. `third-party/` is for supporting libraries, separate from the
existing top-level emulator submodules.

The Emscripten assets load on the first request; decoding runs on the main thread. Identical
consecutive byte arrays reuse one result. Inputs are copied; neither the Wasm
heap nor emulator memory is retained by the UI. Input/output limits are 4 MiB/16 MiB and Wasm memory is capped at
256 MiB. The UI rejects incomplete captures and keeps the hex view on errors.
PICT text uses the library's substitute font. QuickTime-containing pictures are
currently rejected rather than displaying a potentially incomplete canvas.

## Building

Initialize the pinned fork if needed:

```
git submodule update --init third-party/oxideav-pict
```

With the existing `macemu_emsdk` Docker image installed:

```
scripts/build-pict-renderer.sh
node scripts/test-pict-renderer.mjs
```

The script builds `wasm/` for `wasm32-unknown-emscripten` and updates
`generated/pict.js` and `generated/pict.wasm`. Commit these two generated files
alongside wrapper or submodule updates; normal frontend builds need no Rust or
Docker setup. `generated/pict.d.ts` describes our small exported ABI and is
maintained by hand. The build uses the SDK/Rust versions in the same Docker image
as the emulators, the checked-in Cargo lockfile, and the pinned submodule revision.

The asset tests exercise real decoding, palette indexing, truncated input and
repeated allocation/free cycles. They contain synthetic PICT data, not guest files.
