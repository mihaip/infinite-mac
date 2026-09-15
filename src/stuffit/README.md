# StuffIt decoding

JavaScript wrapper for the `stuffit` Rust crate, so we can decompress `.sit` StuffIt archives and extract any disk images contained within them.

We generate bindings via `wasm-bindgen`. The wasm module is loaded on demand, and gets run inline.

Input archives are limited to 100 MB and individual expanded entries to 128 MB. Inputs and extracted entries are copied across the Wasm boundary; archive allocations need to be explicitly released.

## Building

With the existing `macemu_emsdk` Docker image installed (see the top-level `README.md`):

```
scripts/build-stuffit-decoder.sh
```

The script builds `wasm/` for `wasm32-unknown-unknown` and updates the committed JavaScript, TypeScript, and Wasm files in `generated/`. We commit those artifacts to the repository, since they change infrequently. This way normal web builds don't need Docker or the Rust toolchain.
