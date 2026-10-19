# StuffIt decoding

JavaScript wrapper for the `stuffit` Rust crate, so we can decompress `.sit` StuffIt archives and extract any disk images contained within them.

We generate bindings via `wasm-bindgen`. Each opened archive gets a dedicated worker that loads the Wasm module on demand, parses the archive, decompresses entries, and builds the output Blobs. Closing the archive terminates the worker and releases its Wasm memory.

The TypeScript code mirrors the emulator's directory structure:

- `ui/`: archive and entry proxies, worker requests, and lifecycle handling.
- `worker/`: archive parsing and decompression using the generated bindings.
- `common/`: message types, entry metadata, and archive size limits.

Input archives and individual expanded entries are limited to 700 MB. Inputs and extracted entries are copied across the Wasm boundary, but those copies happen in the worker. Decompression still buffers complete entries and reports only start/end progress.

## Building

With the existing `macemu_emsdk` Docker image installed (see the top-level `README.md`):

```
scripts/build-stuffit-decoder.sh
```

The script builds `wasm/` for `wasm32-unknown-unknown` and updates the committed JavaScript, TypeScript, and Wasm files in `generated/`. We commit those artifacts to the repository, since they change infrequently. This way normal web builds don't need Docker or the Rust toolchain.
