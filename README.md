# Infinite Mac

TODO

## Development

Common development tasks, all done via `npm run`:

-   `start`: Run local dev server (will be running at http://localhost:3127)
-   `import-basilisk-ii`: Copy generated WebAssembly from a https://github.com/mihaip/macemu checkout (assumed to be in a sibling directory to this repo).
-   `import-basilisk-ii-data`: Variant of the above for the data files. The `broli` CLI tool is assumed to be installed (e.g. via `brew install brotli`).
-   `build-library-manifest`: Rebuild the combined manifest file used for the software library (should be done when updating the contents of `public/Library`)

Common deployment tasks (also done via `npm run`)

-   `build`: Rebuild for either local use (in the `build/` directory) or for Cloudflare Worker use
-   `worker-preview`: Preview built assets in a Cloudflare Worker (requires a separate `build` invocation)
-   `worker-deploy`: Deploy built assets to the live version of the Cloudflare Worker (requires a separate `build` invocation)
