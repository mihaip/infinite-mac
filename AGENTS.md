# Infinite Mac

Infinite Mac is a web-based multi-emulator platform for running classic Macintosh operating systems and software in a browser using WebAssembly. See README.md for more information about the project, including build and development instructions.

## Code organization

Put main entrypoints and public APIs first in each file. Place secondary helper functions and their supporting implementation details toward the bottom, so readers encounter the main behavior before the helpers.

## Working with emulator cores

When working with emulators that live in Git submodules (e.g. `macemu/` for Baslisk II and SheepShaver, `dingusppc/` for DingusPPC, `snow/` for Snow, etc.), reference the `AGENTS.md` file in the respective submodule before doing anything else.
