# Infinite Mac

80's, 90's and early 2000s classic Macs that load instantly in a browser and have access to a large software library. The full collection is at [infinitemac.org](https://infinitemac.org). Shortcuts are available for [System 6](https://system6.app/), [System 7](https://system7.app/), [Mac OS 8](https://macos8.app/), [Mac OS 9](https://macos9.app/) and [KanjiTalk](https://kanjitalk7.app) (Japanese). For a high-level overview and the backstory, see [the launch blog post](https://blog.persistent.info/2022/03/blog-post.html) and [subsequent ones](https://blog.persistent.info/search/label/Infinite%20Mac).

## Development

### Getting Started

This project uses submodules, use `git clone --recursive https://github.com/mihaip/infinite-mac.git` to clone it (or run `git submodule update --init --recursive` if you have an existing checkout).

Dependencies need to be installed:

```sh
npm install
npm run build-tools
```

Supporting data files need to be generated. This will build a minimal set of files, sufficient for running System 1 through System 7.5.5.

```sh
npm run import-disks minimal
npm run import-cd-roms placeholder
npm run import-library placeholder
```

You can then run the local dev server:

```sh
npm run start
```

It will be running at http://localhost:3127.

### Command Reference

Common development tasks, all done via `npm run`:

- `start`: Run local dev server (at http://localhost:3127)
- `import-emulator <emulator>`: Copy generated WebAssembly from an emulator submodule (only necessary if modifying the emulator cores, see [below](#building-the-emulators) for how to rebuild them). The following emulators are supported:
    - `basiliskii`: Basilisk II from https://github.com/mihaip/macemu
    - `sheepshaver`: SheepShaver from https://github.com/mihaip/macemu
    - `minivmac-Plus` (and others): Mini vMac variants from https://github.com/mihaip/minivmac
    - `dingusppc`: DingusPPC from https://github.com/mihaip/dingusppc
    - `previous`: Previous from https://github.com/mihaip/previous
    - `pearpc`: PearPC from https://github.com/mihaip/pearpc
- `import-disks`: Build disk images for serving. Copies base OS images for the above emulators, and imports other software (found in `Library/`) into an "Infinite HD" disk image. Chunks disk images and generates a manifest for serving.
    - `placeholder` may be passed in as an argument to only build System 1 through 7.5.5, to skip populating the "Infinite HD" disk image.
    - This will invoke the native macOS versions of Mini vMac and Basilisk II as a final step, to ensure that the generated disk has a valid desktop database. If they are not installed, a warning will be logged and the generated disk may take longer to mount.
    - To speed up the Mini vMac building step, you can change its speed: press Control-S to bring up the speed menu, and then the A to choose "All Out"
    - Note that both Mini vMac and Basilisk II will be launched as part of this process. Once they seem done and you can see Infinite HD, use the "Shut Down" command to cleanly turn off the emulated machine and then quit the respective emulator so that the task can continue.
- `import-cd-roms`: Build CD-ROM library (actual CD-ROMs are hosted on archive.org and other sites, the library contains metadata)
    - `placeholder` may be passed in as an argument to make an empty CD-ROM library
- `import-library`: Build downloads library (actual downloads are hosted on macintoshgarden.org and other sites, the library contains metadata)
    - `placeholder` may be passed in as an argument to make the script generate a minimal library that does not depend on a Macintosh Garden data dump.

Common deployment tasks (also done via `npm run`)

- `build`: Rebuild for either local use (in the `build/` directory) or for Cloudflare Worker use
- `preview`: Serve built assets locally using Vite's server (will be running at https://localhost:4127)
- `worker-dev`: Preview built assets in a local Cloudflare Worker (requires a separate `build` invocation, result will be running at http://localhost:3128)
- `worker-deploy`: Build and deploy assets to the live version of the Cloudflare Worker
- `sync-disks`: Sync disk images to a Cloudflare R2 bucket.
    - Requires that [rclone](https://rclone.org/) installed, it can be obtained via `sudo -v ; curl https://rclone.org/install.sh | sudo bash`
    - Should be done after disks are rebuilt with `import-disks` (and before `worker-deploy`).

### Directory Structure

- `src/`: frontend React app and assets.
    - `app/`: main UI pages/components
    - `controls/`: reusable UI widgets (buttons, dialogs, inputs, etc).
    - `defs/`: type-safe data definitions for disks, machines, etc.
    - `lib/`: shared utilities and hooks
    - `net/`: networking helpers (Ethernet providers for emulator-to-emulator connectivity).
    - `emulator/`: emulator integration
        - `ui/`: code that runs in the main thread to drive emulators (config, files, audio/video, input).
        - `worker/`: emulator worker runtime and helpers.
            - `emscripten/`: generated WASM emulator binaries of emulator cores.
        - `common/`: shared types/utilities used by both UI and worker sides.
    - `Data/`: support data files, including ROMs and disk manifests (generated via `import-disks`)
    - `Images/` and `Fonts/`: bundled assets and manifests (ROMs, disk manifests, UI art, fonts).
    - `monkey/`: Infinite Monkey LLM-based computer use demonstration
- `worker/`: Cloudflare Worker code for SSR, asset serving, and APIs.
- `scripts/`: helper scripts for importing emulators/disks and deployment utilities.
- `public/`: static files served as-is
- `Library/`: Infinite HD library, used by `import-disks` (either JSON manifests of files to download or .zip archives of snapshotted directories)
- `CD-ROMs/`: CD-ROM library, used by `import-cd-roms`
- `Images/`: System disk images, used by `import-disks` (larger images are stored as [GitHub releases](https://github.com/mihaip/infinite-mac/releases))

### Building the emulators

[Basilisk II](https://github.com/mihaip/macemu/tree/infinite-mac-kanjitalk755/BasiliskII), [SheepShaver](https://github.com/mihaip/macemu/tree/infinite-mac-kanjitalk755/SheepShaver), [Mini vMac](https://github.com/mihaip/minivmac/), [DingusPPC](https://github.com/mihaip/dingusppc), [Previous](https://github.com/mihaip/previous) and [PearPC](https://github.com/mihaip/pearpc) are the original 68K and PowerPC emulators that enable this project. They are hosted in separate repos and are included via Git submodules. Rebuilding them is only required when making changes to the emulator core, the generated files are in `src/emulator/worker/emscripten` and included in the Git repository.

To begin, ensure that you have a Docker image built with the Emscripten toolchain and supporting libraries:

```sh
docker build -t macemu_emsdk .
```

To rebuild all the emulators, run the following script which automate all of the steps below:

```sh
scripts/rebuild-and-import-emulators.sh
```

To manually build individual emulators, open a shell into the Docker container:

```sh
scripts/docker-shell.sh
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
./_emconfigure.sh
make -j8
```

Once it has built, use `npm run import-emulator sheepshaver` from the host to update the files in `src/emulator`.

#### Mini vMac

See [this page](https://www.gryphel.com/c/minivmac/options.html) for the full set set of build options (and [this one](https://www.gryphel.com/c/minivmac/develop.html) for more esoteric ones).

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
# - `-m IIx -mem 32M`: Mac IIx
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
./_emconfigure.sh
make -j8
```

Once it has built, use `npm run import-emulator pearpc` from the host to update the files in `src/emulator`.
