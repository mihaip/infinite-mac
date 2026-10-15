"""Reproduce the LisaEm native bringup with private, tagged disk images.

    python3 scripts/lisa.py fetch
    python3 scripts/lisa.py prepare-native baseline
    python3 scripts/lisa.py run-native baseline

Media stays outside the checkout. Set LISA_WORK_DIR to choose another location.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
WORK = Path(os.environ.get("LISA_WORK_DIR", "~/Developer/Retro/Lisa")).expanduser()
REFERENCE = "https://raw.githubusercontent.com/iosdevzone/LisaOnline/b0e8e8c41e43930b782dbd4cccf2273ee2326680/"
SOURCES = {
    "boot.ROM": (
        REFERENCE + "boot.ROM",
        "4eb245a5a133a202cb07757a7430437a996d91acddfba2c1a3b787e8b5b9d8f5",
    ),
    "LisaOfficeHardDisk.dc42": (
        REFERENCE + "LisaOfficeHardDisk.dc42",
        "f8888f2f101ee553e206b81a6580450f48eb8e2a3ea034eb636c5cb194f54d84",
    ),
    "Apple Lisa Software - Disk Images.zip": (
        "https://mirrors.apple2.org.za/ftp.apple.asimov.net/images/applelisa/"
        "Apple%20Lisa%20Software%20-%20Disk%20Images.zip",
        "1a05abc342b0946c096e25568516da9c358b6c15534770d48d891dcdedc0de96",
    ),
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def checksum(data):
    result = 0
    for (word,) in struct.iter_unpack(">H", data):
        result = (result + word) & 0xFFFFFFFF
        result = (result >> 1) | ((result & 1) << 31)
    return result


def inspect_dc42(path):
    image = path.read_bytes()
    if len(image) < 84 or image[82:84] != b"\x01\x00":
        raise ValueError(f"Not a DC42 image: {path}")
    data_size, tag_size, data_sum, tag_sum = struct.unpack(">IIII", image[64:80])
    if data_size % 512 or len(image) != 84 + data_size + tag_size:
        raise ValueError(f"Invalid DC42 lengths: {path}")
    sectors = data_size // 512
    if not sectors or tag_size % sectors:
        raise ValueError(f"Invalid DC42 tags: {path}")
    tags_per_sector = tag_size // sectors
    actual_data_sum = checksum(image[84:84 + data_size])
    # Disk Copy skips the first sector's tags when computing this checksum.
    actual_tag_sum = checksum(image[84 + data_size + tags_per_sector:])
    return {
        "name": image[1:1 + image[0]].decode("mac_roman"),
        "sectors": sectors,
        "dataBytes": data_size,
        "tagBytesPerSector": tags_per_sector,
        "dataChecksumValid": actual_data_sum == data_sum,
        "tagChecksumValid": actual_tag_sum == tag_sum,
        "sha256": sha256(path),
    }


def fetch():
    originals = WORK / "originals"
    originals.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, (url, expected) in SOURCES.items():
        path = originals / name
        if not path.exists():
            temporary = path.with_name(path.name + ".download")
            print(f"Downloading {name}", flush=True)
            urllib.request.urlretrieve(url, temporary)
            if sha256(temporary) != expected:
                raise ValueError(f"SHA256 mismatch: {temporary}")
            temporary.rename(path)
        if sha256(path) != expected:
            raise ValueError(f"SHA256 mismatch: {path}")
        manifest[name] = {"url": url, "sha256": expected, "bytes": path.stat().st_size}
        if path.suffix == ".dc42":
            manifest[name]["dc42"] = inspect_dc42(path)
        print(f"Verified {name}")
    (originals / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def run_path(name):
    if Path(name).name != name or name in (".", ".."):
        raise ValueError("Run name must be a single directory name")
    return WORK / "runs" / name


def prepare_floppies():
    """Use libdc42's DART decoder; never discard Lisa sector tags."""
    tools = list((ROOT / "lisaem" / "bin").glob("*/lisafsh-tool"))
    if len(tools) != 1:
        raise ValueError("Build the native LisaEm tools first")
    destination = WORK / "prepared" / "floppies"
    destination.mkdir(parents=True, exist_ok=True)
    manifest = {}
    with zipfile.ZipFile(WORK / "originals" / "Apple Lisa Software - Disk Images.zip") as archive:
        for name in archive.namelist():
            if name.startswith("__MACOSX/") or name.endswith("/") or "Pascal Workshop" in name:
                continue
            basename = Path(name).name.replace(":", "")
            dart = destination / (basename + ".dart")
            dc42 = Path(str(dart) + ".dc42")
            if not dc42.exists():
                dart.write_bytes(archive.read(name))
                with (destination / (basename + ".log")).open("w") as log:
                    subprocess.run([str(tools[0]), str(dart)], input="quit\n", text=True,
                                   stdout=log, stderr=log, check=True)
            info = inspect_dc42(dc42)
            if not info["dataChecksumValid"] or not info["tagChecksumValid"]:
                raise ValueError(f"Converted image checksum failed: {dc42}")
            manifest[dc42.name] = {"archiveMember": name, **info}
            print(f"Verified {dc42.name}: {info['sectors']} sectors, {info['tagBytesPerSector']} tag bytes")
    (destination / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def prepare_native(name, iorom):
    run = run_path(name)
    run.mkdir(parents=True, exist_ok=False)
    originals = WORK / "originals"
    for filename in ("boot.ROM", "LisaOfficeHardDisk.dc42"):
        if sha256(originals / filename) != SOURCES[filename][1]:
            raise ValueError(f"Original changed: {filename}")
        shutil.copyfile(originals / filename, run / filename)
    serial = "ff000000000000ff0000000000000000"
    config = (
        f"ROMFILE={run / 'boot.ROM'}\nMemoryKB=1536\nioromver={iorom}\n"
        f"serialnumber={serial}\nkeyboardid=bf2f\ncheatromtests=1\n"
        "[parallelport]\nparallelport=PROFILE\n"
        f"path={run / 'LisaOfficeHardDisk.dc42'}\n"
        "[seriala]\nconnecta=NOTHING\n[serialb]\nconnectb=NOTHING\n"
    )
    (run / "lisaem.conf").write_text(config)
    (run / "initial.conf").write_text(config)
    for filename in ("keyboard.txt", "mouse.txt"):
        (run / filename).touch()
    revision = subprocess.check_output(
        ["git", "-C", str(ROOT / "lisaem"), "rev-parse", "HEAD"], text=True
    ).strip()
    (run / "manifest.json").write_text(json.dumps({
        "emulatorRevision": revision, "ioRom": iorom, "serial": serial,
        "memoryKB": 1536, "initialPram": "absent (firmware initializes it)",
        "romSHA256": sha256(run / "boot.ROM"),
        "disk": inspect_dc42(run / "LisaOfficeHardDisk.dc42"),
    }, indent=2) + "\n")
    print(run)


def run_native(name):
    run = run_path(name)
    if not (run / "lisaem.conf").exists():
        raise ValueError(f"Prepare this run first: {run}")
    candidates = list((ROOT / "lisaem" / "bin").glob("LisaEm.app/Contents/MacOS/lisaem-*-wx*"))
    if len(candidates) != 1:
        raise ValueError(f"Expected one native binary, found {candidates}")
    env = dict(os.environ)
    env.update({
        "LISAEM_SCREEN_DUMP": str(run / "screen.png"),
        "LISAEM_KEYBOARD_FILE": str(run / "keyboard.txt"),
        "LISAEM_MOUSE_FILE": str(run / "mouse.txt"),
        "LISAEM_RAM_DUMP": str(run / "ram.bin"),
        "LISAEM_MOUSE_MOVE_AT": "20",
        "LISAEM_NO_DIALOGS": "1",
    })
    command = [str(candidates[0]), "-c", str(run / "lisaem.conf"), "-p", "-q", "-s-", "-z", "1"]
    print(f"Running in {run}; output in native.log", flush=True)
    with (run / "native.log").open("a") as log:
        subprocess.run(command, cwd=run, env=env, stdout=log, stderr=log, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("fetch")
    commands.add_parser("prepare-floppies")
    inspect_parser = commands.add_parser("inspect")
    inspect_parser.add_argument("image", type=Path)
    prepare = commands.add_parser("prepare-native")
    prepare.add_argument("name")
    prepare.add_argument("--iorom", choices=("88", "a8"), default="88")
    run = commands.add_parser("run-native")
    run.add_argument("name")
    args = parser.parse_args()
    if args.command == "fetch":
        fetch()
    elif args.command == "prepare-floppies":
        prepare_floppies()
    elif args.command == "inspect":
        print(json.dumps(inspect_dc42(args.image), indent=2))
    elif args.command == "prepare-native":
        prepare_native(args.name, args.iorom)
    else:
        run_native(args.name)


if __name__ == "__main__":
    main()
