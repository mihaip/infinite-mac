# Infinite Mac

A 90's era classic Mac with everything you'd want. Available in [System 7](https://system7.app/), [Mac OS 8](https://macos8.app/), [Mac OS 9](https://macos9.app/) and [KanjiTalk](https://kanjitalk7.app) (Japanese) flavors. For a high-level overview and the backstory, see [the launch blog post](https://blog.persistent.info/2022/03/blog-post.html) and [subsequent ones](https://blog.persistent.info/search/label/Infinite%20Mac).

## Development

This project uses [Git LFS](https://git-lfs.github.com/), ensure that the LFS tooling is installed before cloning the repo.

This project uses submodules, use `git clone --recursive https://github.com/mihaip/infinite-mac.git` to clone it (or run `git submodule update --init --recursive` if you have an existing checkout).

Common development tasks, all done via `npm run`:

-   `start`: Run local dev server (will be running at http://localhost:3127). Depends on having disk images built (`import-disks` needs to be run at least once).
-   `import-emulator <emulator>`: Copy generated WebAssembly from an emulator submodule (only necessary if modifying the emulator cores, see [below](#building-the-emulators) for how to rebuild them). The following emulators are supported:
    -   `basiliskii`: Basilisk II from https://github.com/mihaip/macemu
    -   `sheepshaver`: SheepShaver from https://github.com/mihaip/macemu
    -   `minivmac-Plus`: Mini vMac variants from https://github.com/mihaip/minivmac
-   `import-disks`: Build disk images for serving. Copies base OS images for the above emulators, and imports other software (found in `Library/`) into an "Infinite HD" disk image. Chunks disk images and generates a manifest for serving. This requires the macOS versions of Basilisk II and Mini vMac to be installed, since they are used as part of the image building process.

Common deployment tasks (also done via `npm run`)

-   `build`: Rebuild for either local use (in the `build/` directory) or for Cloudflare Worker use
-   `worker-dev`: Preview built assets in a local Cloudflare Worker (requires a separate `build` invocation, result will be running at http://localhost:3128)
-   `worker-deploy`: Deploy built assets to the live version of the Cloudflare Worker (requires a separate `build` invocation)

### Dependencies

Dependencies can be installed with:

```
npm install -g wrangler
npm install
pip3 install -r requirements.txt
npm run build-xadmaster
```

### Building the emulators

Basilisk II and SheepShaver the original 68K and PowerPC emulators that enable this project.They are hosted in [a separate repo](https://github.com/mihaip/macemu/) and are included via a Git submodule. Rebuilding them is only required when making changes to the emulator core, the generated files are in `src/emulator` and included in the Git repository.

To begin, ensure that you have a Docker image built with the Emscripten toolchain and supporting libraries:

```sh
docker build -t macemu_emsdk .
```

Open a shell into the Docker container:

```sh
docker run --rm -it -v `realpath macemu`:/macemu -v `realpath minivmac`:/minivmac --entrypoint bash macemu_emsdk
```

Once in that container, you can use a couple of helper scripts to build them:

#### Basilisk II

```sh
cd /macemu/BasiliskII/src/Unix
# Bootstrap Basilisk II, to generate the CPU emulator code
./_embootstrap.sh
# Switch into building for WASM
./_emconfigure.sh
# Actually compile Basilisk II targetting WASM
make -j8
```

Once it has built, use `npm run import-basilisk-ii` from the host to update the files in `src/emulator`.

#### SheepShaver

```sh
cd /macemu/SheepShaver/src/Unix
# Configure for building for WASM
./_emconfigure.sh
# Actually compile SheepShaver targetting WASM
make -j8
```

Once it has built, use `npm run import-sheepshaver` from the host to update the files in `src/emulator`.

#### Mini vMac

```sh
cd /minivmac
# Configure for building for WASM
./emscripten_setup.sh
# This configures the Mac Plus model by default, alternative outputs can be
# configured with additionl arguments:
# - `-m 128K -speed z`: Mac 128K (uses 1x speed by default to be more realistic)
# - `-m 512Ke`: Mac 512ke
# - `-m SE`: Mac SE
# - `-m II`: Mac II
# Actually compile Mini vMac targetting WASM
make -j8
```

Once it has built, use `npm run import-minivmac-<model>` from the host to update the files in `src/emulator`.
