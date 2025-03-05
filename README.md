# Infinite Mac

80's, 90's and early 2000s classic Macs that load instantly in a browser and have access to a large software library. The full collection is at [infinitemac.org](https://infinitemac.org). Shortcuts are available for [System 6](https://system6.app/), [System 7](https://system7.app/), [Mac OS 8](https://macos8.app/), [Mac OS 9](https://macos9.app/) and [KanjiTalk](https://kanjitalk7.app) (Japanese). For a high-level overview and the backstory, see [the launch blog post](https://blog.persistent.info/2022/03/blog-post.html) and [subsequent ones](https://blog.persistent.info/search/label/Infinite%20Mac).

## Development

This project uses [Git LFS](https://git-lfs.github.com/), ensure that the LFS tooling is installed before cloning the repo.

This project uses submodules, use `git clone --recursive https://github.com/mihaip/infinite-mac.git` to clone it (or run `git submodule update --init --recursive` if you have an existing checkout).

Common development tasks, all done via `npm run`:

-   `start`: Run local dev server (will be running at http://localhost:3127). Requires [dependencies](#dependencies) being installed and built.
-   `import-emulator <emulator>`: Copy generated WebAssembly from an emulator submodule (only necessary if modifying the emulator cores, see [below](#building-the-emulators) for how to rebuild them). The following emulators are supported:
    -   `basiliskii`: Basilisk II from https://github.com/mihaip/macemu
    -   `sheepshaver`: SheepShaver from https://github.com/mihaip/macemu
    -   `minivmac-Plus` (and others): Mini vMac variants from https://github.com/mihaip/minivmac
    -   `dingusppc`: DingusPPC from https://github.com/mihaip/dingusppc
    -   `previous`: Previous from https://github.com/mihaip/previous
    -   `pearpcc`: PearPC from https://github.com/mihaip/pearpc
-   `import-disks`: Build disk images for serving. Copies base OS images for the above emulators, and imports other software (found in `Library/`) into an "Infinite HD" disk image. Chunks disk images and generates a manifest for serving. This requires the macOS versions of Basilisk II and Mini vMac to be installed, since they are used as part of the image building process.
-   `import-cd-roms`: Build CD-ROM library (actual CD-ROMs are hosted on archive.org and other sites, the library contains metadata)
-   `import-library`: Build downloads library (actual downloads are hosted on macintoshgarden.org and other sites, the library contains metadata)

Common deployment tasks (also done via `npm run`)

-   `build`: Rebuild for either local use (in the `build/` directory) or for Cloudflare Worker use
-   `preview`: Serve built assets locally using Vite's server (will be running at https://localhost:4127)
-   `worker-dev`: Preview built assets in a local Cloudflare Worker (requires a separate `build` invocation, result will be running at http://localhost:3128)
-   `worker-deploy`: Deploy built assets to the live version of the Cloudflare Worker (requires a separate `build` invocation)
-   `sync-disks`: Sync disk images to a Cloudflare R2 bucket. Should be done after disks are rebuilt with `import-disks` (and before `worker-deploy`).

### Dependencies

Dependencies can be installed with:

```
npm install
pip3 install -r requirements.txt
npm run build-tools
sudo -v ; curl https://rclone.org/install.sh | sudo bash
```

Supporting data files need to be generated.

Build the system boot disks and Infinite HD disk image:

```
npm run import-disks
```

Load metadata for the CD-ROM library:

```
npm run import-cd-roms
```

Load metadata for the [Macintosh Garden](https://macintoshgarden.org/) library. If you do not have a local copy of the library dump, you can use `placeholder` as the path to to generate a placeholder instead:

```
npm run import-library path/to/library/dump
```

### Building the emulators

Basilisk II, SheepShaver, Mini vMac and DingusPPC are the original 68K and PowerPC emulators that enable this project. They are hosted in [separate](https://github.com/mihaip/minivmac/) [repos](https://github.com/mihaip/macemu/) and are included via Git submodules. Rebuilding them is only required when making changes to the emulator core, the generated files are in `src/emulator` and included in the Git repository.

To begin, ensure that you have a Docker image built with the Emscripten toolchain and supporting libraries:

```sh
docker build -t macemu_emsdk .
```

Open a shell into the Docker container:

```sh
docker run --rm -it \
    -v `realpath macemu`:/macemu \
    -v `realpath minivmac`:/minivmac \
    -v `realpath dingusppc`:/dingusppc \
    -v `realpath previous`:/previous \
    -v `realpath pearpc`:/pearpc \
    --entrypoint bash macemu_emsdk
```

Once in that container, you can use a couple of helper scripts to build them:

#### Basilisk II

```sh
cd /macemu/BasiliskII/src/Unix
# Bootstrap Basilisk II, to generate the CPU emulator code
./_embootstrap.sh
# Switch into building for WASM
./_emconfigure.sh
# Actually compile Basilisk II targeting WASM
make -j8
```

Once it has built, use `npm run import-emulator basiliskii` from the host to update the files in `src/emulator`.

#### SheepShaver

```sh
cd /macemu/SheepShaver/src/Unix
# Configure for building for WASM
./_emconfigure.sh
# Actually compile SheepShaver targeting WASM
make -j8
```

Once it has built, use `npm run import-emulator sheepshaver` from the host to update the files in `src/emulator`.

#### Mini vMac

See [this page](https://www.gryphel.com/c/minivmac/options.html) for the full set set of build options (and [this one](https://www.gryphel.com/c/minivmac/develop.html) for more estoeric ones).

```sh
cd /minivmac
# Configure for building for WASM
./emscripten_setup.sh
# This configures the Mac Plus model by default, alternative outputs can be
# configured with additional arguments:
# - `-m 128K -speed z`: Mac 128K (uses 1x speed by default to be more realistic)
# - `-m 512Ke`: Mac 512ke
# - `-m SE`: Mac SE
# - `-m II`: Mac II
# Actually compile Mini vMac targeting WASM
make -j8
```

Once it has built, use `npm run import-emulator minivmac-<model>` from the host to update the files in `src/emulator`.

### DingusPPC

```sh
cd /dingusppc
mkdir -p build
cd build
emcmake cmake -DCMAKE_BUILD_TYPE=Release ..
make dingusppc -j8
```

Once it has built, use `npm run import-emulator dingusppc` from the host to update the files in `src/emulator`.

### Previous

```sh
cd /previous
mkdir -p build
cd build
emcmake cmake -DCMAKE_BUILD_TYPE=Release -DENABLE_RENDERING_THREAD=0 ..
make previous -j8
```

Once it has built, use `npm run import-emulator previous` from the host to update the files in `src/emulator`.

### PearPC

```sh
cd /pearpc
# Configure for building for WASM
./_emconfigure.sh
# Actually compile PearPC targeting WASM
make -j8
```

Once it has built, use `npm run import-emulator pearpc` from the host to update the files in `src/emulator`.
