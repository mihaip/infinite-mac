# Infinite Mac

TODO

## Development

This project uses submodules, use `git clone --recursive https://github.com/mihaip/infinite-mac.git` to clone it (or run `git submodule update --init --recursive` if you have an existing checkout).

Common development tasks, all done via `npm run`:

-   `start`: Run local dev server (will be running at http://localhost:3127).
-   `import-basilisk-ii`: Copy generated WebAssembly from the https://github.com/mihaip/macemu submodule.
-   `import-basilisk-ii-data`: Variant of the above for the data files. Also imports other disk images and extracted files from `Library/` into the main disk image and chunks it for serving.

Common deployment tasks (also done via `npm run`)

-   `build`: Rebuild for either local use (in the `build/` directory) or for Cloudflare Worker use
-   `worker-preview`: Preview built assets in a Cloudflare Worker (requires a separate `build` invocation)
-   `worker-deploy`: Deploy built assets to the live version of the Cloudflare Worker (requires a separate `build` invocation)

### Dependencies

Dependencies can be installed with:

```
npm install
pip3 install -r requirements.txt
brew install brotli
```

### Building Basilisk II

Ensure that you have a Docker image built with the Emscripten toolchain and supporting library:

```sh
docker build -t macemu_emsdk .
```

Open a shell into the Docker container:

```sh
docker run --rm -it -v `realpath macemu`:/macemu --entrypoint bash macemu_emsdk
```

Once in that container, you can use this cheat sheet to build (based on [the original instructions](https://github.com/mihaip/macemu/blob/bas-emscripten-release/BasiliskII/src/NOTES)):

```sh
cd /macemu/BasiliskII/src/Unix
# Bootstrap Basilisk II, to generate the CPU emulator code
macemujs_conf_cpu=1 macemujs_conf_native=1 ./_embuild.sh && make clean && make -j4
# Switch into building for WASM
macemujs_conf_cpu=1 macemujs_conf_wasm=1 ./_embuild.sh && make mostlyclean
# Actually compile Basilisk II targetting WASM
make -j6
```

Once you have it build, use `npm run import-basilisk-ii` from the host to update the files in `src/BasiliskII`.
