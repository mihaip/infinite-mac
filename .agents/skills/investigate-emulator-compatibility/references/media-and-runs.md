# Media and repeatable runs

Commands below run from the Infinite Mac repository root unless stated otherwise.
Use new output paths; application data and OS disks are writable test inputs.

## Limited Infinite HD

Find the library entry first, for example:

```sh
rg --files Library | rg 'Barrack|Abuse|Solarian'
```

Use the repository Python environment (dependencies are pinned in
`pyproject.toml`/`uv.lock`):

```sh
mkdir -p /tmp/game-investigation
DEBUG_LIBRARY_FILTER=Abuse uv run scripts/build-infinite-hd.py /tmp/game-investigation/Game.dsk
```

`DEBUG_LIBRARY_FILTER` is a **case-sensitive substring of the full manifest/ZIP
path**, not a regex or comma-separated list. Both `.json` imports and library
`.zip` imports honor it. `X` has a special OS X meaning; don't use it as a normal
search fragment. The builder retains the base Infinite HD folders and utilities.
Check its import output and inspect the resulting volume to confirm the app is
present; a successful process alone doesn't establish that the filter matched.

The CLI writes the System 7 library variant, a bare, nonbootable HFS volume.
Filtering reduces imported software, **not image capacity**: `library.build_images`
currently constructs 400, 2000, and 2500 MiB variants and the CLI selects the
middle one. Allow memory for all three. JSON entries may need downloads and
archive tools configured in `scripts/paths.py`; use the repo importer to retain
resource forks and Finder metadata instead of host-unzipping a Mac application.

For a small game, optionally reserialize the filtered bare HFS volume to a
smaller capacity rather than changing production library sizes:

```sh
uv run python - <<'PY'
from pathlib import Path
import machfs
source = Path('/tmp/game-investigation/Game.dsk')
v = machfs.Volume()
v.read(source.read_bytes())
image = v.write(size=64 * 1024 * 1024, align=512,
                desktopdb=False, bootable=False)
with Path('/tmp/game-investigation/Game-small.dsk').open('xb') as f:
    f.write(image)
PY
```

64 MiB worked for Abuse; choose space for the actual payload and guest writes.
This is a recipe for the **nonbootable game volume**, not arbitrary boot disks.
Read back important files and both forks when validating a conversion.

## Native device wrappers and OS copies

Images in `Images/` and `/Users/mihai/Developer/Retro/Infinite Mac Images` are
source media. Do not boot native emulators directly against those writable
originals. An extension such as `.dsk` does not tell you whether an image is bare
HFS or a complete device; inspect the partition map before wrapping it.

For a bare HFS image on the tested old SCSI Power Macs:

```sh
python3 scripts/make-device-image.py \
  'Images/System 7.5.5 HD.dsk' /tmp/game-investigation/System.hda --scsi-4.3-driver
python3 scripts/make-device-image.py \
  /tmp/game-investigation/Game-small.dsk /tmp/game-investigation/Game.hda --scsi-4.3-driver
```

The wrapper writes a new image with an Apple partition map and driver. Without
that flag it uses the all-drivers header. Match the guest controller and existing
known-good setup; don't double-wrap a device image or apply this HDD recipe to
CD media. Native DingusPPC needs a device layout where Infinite Mac's browser
integration may supply the wrapper automatically.

Use an OS known to support the selected machine. Barrack's successful 6100 run
used the universal `System 7.5.3 HD.dsk`, not the separate `(PPC)` image. That is
an observed baseline, not a rule that every `(PPC)` image is bad. Later New World
systems also depend on the installed `System Folder:Mac OS ROM` matching the OS
and hardware, independently of the physical BootROM.

## Boot configuration and persistent state

Example native 6100 setup, with an actual ROM path selected from the local
archive:

```sh
repo_dir="$PWD"
rom_path='/absolute/path/to/the/selected/6100.ROM'
cd /tmp/game-investigation
"$repo_dir/dingusppc/build-xcode/bin/RelWithDebInfo/dingusppc.app/Contents/MacOS/dingusppc" \
  --machine pm6100 -b "$rom_path" --mon_id=Multiscan17in \
  --rambank1_size=32 --log-to-stderr \
  --hdd_img /tmp/game-investigation/System.hda:/tmp/game-investigation/Game.hda \
  2>native.log
```

This is a reproduction example, not a preferred configuration for every report.
Quote ROM filenames containing spaces or `&`. DingusPPC uses colon-separated HDD
paths here. Run from a dedicated directory because `pram.bin` and, on applicable
machines, `nvram.bin` are resolved relative to the working directory. The 6100
uses Cuda's 256-byte PRAM without a separate NVRAM file. Record whether seeds are
absent, zeroed, browser-derived, or copied from a previous run. Preserve initial
seeds separately from their post-run versions; a retry can otherwise test changed
firmware and disk state.

Inspect existing emulator processes and their command lines before starting
another CPU-heavy run. Stop your own obsolete runs; don't kill the user's other
sessions without authorization. Don't attach two running instances to the same
writable image. A debugger-attached process can remain stopped after a kill;
check its tracer and actual CPU use before assuming another live emulator remains.

The optional archive's `scripts/dingus_boot_run.py` automates private copies,
provenance and bounded debugger captures. It does not infer RAM/clock modes,
classify boot success, or copy writable paths hidden inside extra CLI arguments.
