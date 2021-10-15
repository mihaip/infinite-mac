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

Dependencies can be installed with:

```
npm install
pip3 install -r requirements.txt
brew install brotli
```
