# Infinite Mac

80's, 90's and early 2000s classic Macs that load instantly in a browser and have access to a large software library. The full collection is at [infinitemac.org](https://infinitemac.org). Shortcuts are available for [System 6](https://system6.app/), [System 7](https://system7.app/), [Mac OS 8](https://macos8.app/), [Mac OS 9](https://macos9.app/) and [KanjiTalk](https://kanjitalk7.app) (Japanese). For a high-level overview and the backstory, see [the launch blog post](https://blog.persistent.info/2022/03/blog-post.html) and [subsequent ones](https://blog.persistent.info/search/label/Infinite%20Mac).

Infinite Mac-powered emulated Macs can also be embedded in other websites and controlled programmatically. See [the embedding guide](https://infinitemac.org/embed-docs) and [this blog post](https://blog.persistent.info/2025/07/infinite-mac-embedding.html) for more details.

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
    - `snow`: Snow from https://github.com/mihaip/snow
    - `lisaem`: LisaEm from https://github.com/mihaip/lisaem
- `import-disks`: Build disk images for serving. There are two types of disk images: OS images (which get some lightweight customization with dynamic content) and "Infinite HD" images (which contain third-party software from `Library/`). To prepare them for serving both types get get chunked and a JSON manifest with metadata is generated and placed in `src/Data`.
    - `placeholder` may be passed in as an argument to only build System 1 through 7.5.5, to skip populating the "Infinite HD" disk image.
    - This will invoke the native macOS versions of Mini vMac and Basilisk II as a final step, to ensure that the generated disk has a valid desktop database. If they are not installed, a warning will be logged and the generated disk may take longer to mount.
    - To speed up the Mini vMac building step, you can change its speed: press Control-S to bring up the speed menu, and then the A to choose "All Out"
    - Both emulators need to be manually and cleanly shut down and quit once they have successfully mounted Infinite HD.
- `import-cd-roms`: Build CD-ROM and floppy libraries (most CD-ROMs are hosted on other sites, while floppies and local media are self-hosted)
    - `placeholder` may be passed in as an argument to make an empty CD-ROM library
    - CD-ROM manifests are JSON files, notable options are:
        - `"self_hosted": true` to opt-in into self-hosting. This also allows post-processing to extract items from compressed disks (see the `src_member` manifest option).
        - `data_offset` (and optional `data_size`) select a filesystem within a CD at runtime, if it's a multi-track CD where the first track is not the desired one.
        - `platform` allows the guests to have subsets of the library: `"Macintosh"` (the default), `"NeXT"`, or `"BeOS"`.
    - `--sync-media` may be passed in to sync self-hosted media files to the Cloudflare R2 bucket (this is separate from the disk image sync process done by `sync-disks.sh`)
- `import-library`: Build downloads library (actual downloads are hosted on macintoshgarden.org and other sites, the library contains metadata)
    - `placeholder` may be passed in as an argument to make the script generate a minimal library that does not depend on a Macintosh Garden data dump.

Common deployment tasks (also done via `npm run`):

- `build`: Rebuild for either local use (in the `build/` directory) or for Cloudflare Worker use
- `preview`: Serve built assets locally using Vite's server (will be running at https://localhost:4127)
- `worker-dev`: Preview built assets in a local Cloudflare Worker (requires a separate `build` invocation, result will be running at http://localhost:3128)
- `worker-deploy`: Build and deploy assets to the live version of the Cloudflare Worker
- `sync-disks`: Sync disk images to a Cloudflare R2 bucket.
    - Requires that [rclone](https://rclone.org/) installed, it can be obtained via `sudo -v ; curl https://rclone.org/install.sh | sudo bash`
    - Should be done after disks are rebuilt with `import-disks` (and before `worker-deploy`).

Common checker and style tasks (also done via `npm run`):

- `check`: Check TypeScript types, lint rules, and formatting across `src` and `worker`.
- `typecheck`: Check TypeScript types only.
- `lint`: Check Oxlint rules (has a `lint:fix` counterpart).
- `format`: Check Oxfmt formatting (has a `format:fix` counterpart).

Lint and format settings live in `vite.config.ts`. Type checking still uses
the project's TypeScript compiler; type-aware lint rules use Vite+'s native checker.

`scripts/pre-commit.sh` runs all checks across the whole project. You can add it as a pre-commit hook:

```sh
ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit
```

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

[Basilisk II](https://github.com/mihaip/macemu/tree/infinite-mac-kanjitalk755/BasiliskII), [SheepShaver](https://github.com/mihaip/macemu/tree/infinite-mac-kanjitalk755/SheepShaver), [Mini vMac](https://github.com/mihaip/minivmac/), [DingusPPC](https://github.com/mihaip/dingusppc), [Previous](https://github.com/mihaip/previous), [PearPC](https://github.com/mihaip/pearpc), and [Snow](https://github.com/mihaip/snow) are the original 68K and PowerPC emulators that enable this project. They are hosted in separate repos and are included via Git submodules. Rebuilding them is only required when making changes to the emulator core, the generated files are in `src/emulator/worker/emscripten` and included in the Git repository.

To begin, ensure that you have a Docker image built with the Emscripten toolchain and supporting libraries:

```sh
docker build -t macemu_emsdk .
```

To rebuild all the emulators, run the following script which automate all of the steps below:

```sh
scripts/rebuild-emulators.sh
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

#### DingusPPC

```sh
cd /dingusppc
mkdir -p build
cd build
emcmake cmake -DCMAKE_BUILD_TYPE=Release ..
make dingusppc -j8
```

Once it has built, use `npm run import-emulator dingusppc` from the host to update the files in `src/emulator`.

#### Previous

```sh
cd /previous
mkdir -p build
cd build
emcmake cmake -DCMAKE_BUILD_TYPE=Release -DENABLE_RENDERING_THREAD=0 ..
make previous -j8
```

Once it has built, use `npm run import-emulator previous` from the host to update the files in `src/emulator`.

#### PearPC

```sh
cd /pearpc
./_emconfigure.sh
make -j8
```

Once it has built, use `npm run import-emulator pearpc` from the host to update the files in `src/emulator`.

#### Snow

```sh
cd /snow
cargo build -r -p snow_frontend_im --target wasm32-unknown-emscripten
```

Once it has built, use `npm run import-emulator snow` from the host to update the files in `src/emulator`.

#### LisaEm

The Infinite Mac frontend builds the portable core without wxWidgets, host
serial devices, or threads. Inside the Docker shell:

```sh
emcmake cmake -S /lisaem/src/host/im -B /lisaem/build-im-wasm -DCMAKE_BUILD_TYPE=Release
cmake --build /lisaem/build-im-wasm -j8
```

Run `npm run import-emulator lisaem` on the host. For the local LOS 3.1 disk:

```sh
python3 scripts/lisa.py fetch
python3 scripts/lisa.py prepare-web
```

With the development server running, open
[the Lisa bringup](http://localhost:3127/run?machine=Lisa+2&disk=Lisa+Office+System+3.1).
The machine and disk are available by explicit URL, outside the public timeline.
The disk uses the existing browser persistence layer. Its DC42 header and 20-byte
sector tags are preserved; do not treat it as a raw Macintosh/HFS image.

For a native macOS reference, build the maintained wx frontend and prepare a
private writable copy:

```sh
lisaem/scripts/build-native-macos.sh clean build
python3 scripts/lisa.py prepare-native baseline
python3 scripts/lisa.py run-native baseline
```

wxWidgets 3.2.11 is downloaded and built outside the checkout; override its
location with `LISAEM_NATIVE_DEPS`. Media, run configurations, logs, screenshots,
and input files live in `~/Developer/Retro/Lisa` (`LISA_WORK_DIR` overrides this).
The helper pins source URLs and SHA-256 hashes. `prepare-native NAME --blank`
creates a private blank ProFile, and `run-native NAME --floppy PATH` boots a
private installer copy. `prepare-floppies --rle` converts the alternate Lisa 7/7
installer archive with libdc42 while preserving its tags. The first archive's
LZH-converted boot disk currently fails with error 10726; valid container
checksums alone do not establish bootability.
Use `insert-native NAME PATH` to queue a private copy of the next floppy;
insertion waits until the guest ejects the previous disk. This avoids a native
file picker during multi-disk installation tests.
The RLE archive's disk 3 is an 800 KB capture of a single-sided disk. Preparation
also creates `Office Sys 3 side 0.dc42` by extracting side 0 track by track, with
its tags, and records that transformation in the media manifest. Use that derived
image for a Lisa with a 400 KB drive.

For frontend comparisons without wxWidgets:

```sh
cmake -S lisaem/src/host/im -B lisaem/build-im-native -DCMAKE_BUILD_TYPE=Release
cmake --build lisaem/build-im-native -j8
# Run in a private run directory; this writes the disk and pram.bin.
/path/to/lisaem/build-im-native/lisaem-im boot.ROM disk.dc42 120 screen.pgm
```

After building the native frontend and tools, `python3 scripts/lisa.py
install-headless NAME` creates a private blank ProFile, replays the five-disk
installation, returns to disk 1 for final setup, and selects Finished → Start Up.
It preserves `installed.dc42` with `installed-pram.bin`, then cold-boots a working
copy and writes `boot-screen.pgm`. Inspect that framebuffer to verify the guest
result. Stopping before the final setup can leave an image that fails with 10738.
The installer calls itself 3.0; the installed desktop contains Release 3.1.
Add `--with-lisadraw` to copy LisaDraw, its stationery, and examples from a private
master floppy, create and save a rectangle document, power off, and reopen it
after a cold boot. The resulting `boot-screen.pgm` should show that rectangle.

The initial browser frontend targets a Lisa 2/5 configuration: H boot ROM, A8 I/O
ROM, 1536 KB RAM, one ProFile, and a 720×364 framebuffer. It loads tagged DC42
images into RAM, writes changed sectors through `workerApi.disks`, and refreshes
DC42 checksums before worker periodic tasks. Guest beeps use signed 8-bit mono
PCM at 44.1 kHz; the native harness can capture the same stream by setting
`LISAEM_AUDIO_DUMP` to a raw `.s8` filename. Printers, serial/network
devices, alternate machine configurations, and display aspect correction remain
outside this initial bringup.
Browser PRAM persistence is also deferred; guest restarts currently close the run
cleanly, and a new run performs a cold boot. Native replay accepts an optional
input file (`select-disk.txt` and `install-los.txt` in the frontend directory are
examples), and `LISAEM_BOOT_FLOPPY` selects a floppy boot.

The Lisa Floppies drawer contains 14 tagged DC42 images from the Internet
Archive's [Apple Lisa collection](https://archive.org/details/apple-lisa_202111)
and [LOS 3.1 installer set](https://archive.org/details/los-3.1-en). They use the
normal `CD-ROMs/*.json` import and self-hosted media pipeline with `platform:
"Lisa"`; the importer checks geometry and both DC42 checksums. Rebuild the
catalog with `npm run import-cd-roms`. The collection includes the seven office
applications (LisaWrite occupies two disks), LisaGuide, and five installer
disks. Container validation is not a claim that every application or installer
has been exercised in the guest.

Select a disk in the drawer, load a tagged `.dc42`/`.image` file, or use Load
from URL. A floppy specified in the run URL is also inserted at startup while
the ProFile remains the boot disk. Further selections queue until the drive is
empty. In the Lisa desktop, use **Housekeeping → Eject Micro Diskette** (Apple-E).
The frontend waits for the eject interrupt to clear and allows a one-second
guest disk-change interval before inserting the next image.

After ejection, **More → Save Ejected Floppy…** downloads the most recently
ejected disk, including guest writes, tags, and refreshed checksums. Save it
before ejecting another disk or closing the run. This is a session download;
the drawer's source images remain pristine. A browser-exported LisaDraw disk
has been checked for valid data/tag checksums and reopened in the native
frontend, showing its application, stationery, and examples. Browser checks
also cover an initial floppy supplied through the run URL, queued LisaDraw →
LisaCalc swaps, and reimporting the exported LisaDraw disk. Saved HD and browser
PRAM work remain deferred.

### Internal test pages

There are some internal pages available to make development easier:

- `/_controls` ([dev](http://localhost:3127/_controls), [prod](https://infinitemac.org/_controls)): previewing of all the custom UI controls in all of the appearance types (Classic, Platinum, Aqua, etc.)
- `/_emulators` ([dev](http://localhost:3127/_emulators), [prod](https://infinitemac.org/_emulators)) for an N-up view of multiple emulators, useful when making broad changes.
