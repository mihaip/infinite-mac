"""Reproduce the LisaEm native bringup with private, tagged disk images.

    python3 scripts/lisa.py fetch
    python3 scripts/lisa.py prepare-native baseline
    python3 scripts/lisa.py run-native baseline

Media stays outside the checkout. Set LISA_WORK_DIR to choose another location.
"""

import argparse
import hashlib
import io
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
    "Apple Lisa Software - Disk Images_vol_2.zip": (
        "https://mirrors.apple2.org.za/ftp.apple.asimov.net/images/applelisa/"
        "Apple%20Lisa%20Software%20-%20Disk%20Images_vol_2.zip",
        "32c037c7a7170ad855cfb447057fc11903f1c8ede22aa9b89911591991cb9e76",
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


def prepare_floppies(rle=False):
    """Use libdc42's DART decoder; never discard Lisa sector tags."""
    tools = list((ROOT / "lisaem" / "bin").glob("*/lisafsh-tool"))
    if len(tools) != 1:
        raise ValueError("Build the native LisaEm tools first")
    destination = WORK / "prepared" / ("floppies-rle" if rle else "floppies")
    destination.mkdir(parents=True, exist_ok=True)
    manifest = {}
    archive_path = WORK / "originals" / ("Apple Lisa Software - Disk Images_vol_2.zip" if rle
                                          else "Apple Lisa Software - Disk Images.zip")
    if sha256(archive_path) != SOURCES[archive_path.name][1]:
        raise ValueError(f"Original changed: {archive_path}")
    source = archive_path
    if rle:
        with zipfile.ZipFile(archive_path) as outer:
            nested = next(name for name in outer.namelist()
                          if name.endswith("LisaOS3.zip") and not name.startswith("__MACOSX/"))
            source = io.BytesIO(outer.read(nested))
    with zipfile.ZipFile(source) as archive:
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
    if rle:
        # This archive's third installer is a double-sided capture of a
        # single-sided Lisa disk. Preserve the original conversion and derive
        # the 400K disk by taking side 0 of each track, including its tags.
        source = destination / "Office Sys 3.dart.dc42"
        image = source.read_bytes()
        info = inspect_dc42(source)
        if info["sectors"] != 1600 or info["tagBytesPerSector"] != 12:
            raise ValueError("Unexpected geometry for Office System disk 3")
        data = image[84:84 + 819200]
        tags = image[84 + 819200:]
        output_data, output_tags = bytearray(), bytearray()
        sector = 0
        for track in range(80):
            sectors = 12 - track // 16
            output_data.extend(data[sector * 512:(sector + sectors) * 512])
            output_tags.extend(tags[sector * 12:(sector + sectors) * 12])
            sector += sectors * 2
        header = bytearray(image[:84])
        header[64:80] = struct.pack(
            ">IIII", len(output_data), len(output_tags),
            checksum(output_data), checksum(output_tags[12:]))
        header[80:82] = bytes([0, 2])
        output = destination / "Office Sys 3 side 0.dc42"
        output.write_bytes(header + output_data + output_tags)
        manifest[output.name] = {
            "derivedFrom": source.name, "sourceSHA256": info["sha256"],
            "transformation": "Side 0 of each 800K track, retaining 12-byte sector tags",
            **inspect_dc42(output),
        }
        print(f"Prepared {output.name} for the single-sided Lisa drive")
    (destination / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def prepare_native(name, iorom, blank=False):
    run = run_path(name)
    run.mkdir(parents=True, exist_ok=False)
    originals = WORK / "originals"
    for filename in ("boot.ROM", "LisaOfficeHardDisk.dc42"):
        if sha256(originals / filename) != SOURCES[filename][1]:
            raise ValueError(f"Original changed: {filename}")
        shutil.copyfile(originals / filename, run / filename)
    if blank:
        # A 10 MB ProFile: DC42 stores data then 20-byte tags, not interleaved.
        label = b"-lisaem.sunder.net hd-"
        header = bytes([len(label)]) + label + bytes(63 - len(label))
        header += struct.pack(">IIII4B", 19456 * 512, 19456 * 20, 0, 0, 0x5D, 0x93, 1, 0)
        (run / "LisaOfficeHardDisk.dc42").write_bytes(header + bytes(19456 * 532))
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
    for filename in ("keyboard.txt", "mouse.txt", "floppy.txt"):
        (run / filename).touch()
    revision = subprocess.check_output(
        ["git", "-C", str(ROOT / "lisaem"), "rev-parse", "HEAD"], text=True
    ).strip()
    (run / "manifest.json").write_text(json.dumps({
        "emulatorRevision": revision, "ioRom": iorom, "serial": serial,
        "memoryKB": 1536, "initialPram": "absent (firmware initializes it)",
        "romSHA256": sha256(run / "boot.ROM"),
        "blankDisk": blank, "disk": inspect_dc42(run / "LisaOfficeHardDisk.dc42"),
    }, indent=2) + "\n")

    print(run)

def prepare_web():
    """Make local /Disk chunks using the same format as import-disks.py."""
    source = WORK / "originals" / "LisaOfficeHardDisk.dc42"
    if sha256(source) != SOURCES[source.name][1]:
        raise ValueError(f"Original changed: {source}")
    contents = source.read_bytes()
    destination = ROOT / "Images" / "build"
    destination.mkdir(parents=True, exist_ok=True)
    chunk_size = 256 * 1024
    chunks = []
    for offset in range(0, len(contents), chunk_size):
        chunk = contents[offset:offset + chunk_size]
        signature = hashlib.blake2b(chunk, digest_size=16, salt=b"raw").hexdigest()
        (destination / f"{signature}.chunk").write_bytes(chunk)
        chunks.append(signature)
    manifest = {"name": "Lisa Office System 3.1", "totalSize": len(contents),
                "chunks": chunks, "chunkSize": chunk_size}
    (ROOT / "src" / "Data" / "Lisa Office System 3.1.dc42.json").write_text(
        json.dumps(manifest, indent=4) + "\n")
    print("http://localhost:3127/run?machine=Lisa+2&disk=Lisa+Office+System+3.1")


def run_native(name, floppy=None):
    run = run_path(name)
    if not (run / "lisaem.conf").exists():
        raise ValueError(f"Prepare this run first: {run}")
    candidates = list((ROOT / "lisaem" / "bin").glob("LisaEm.app/Contents/MacOS/lisaem-*-wx*"))
    if len(candidates) != 1:
        raise ValueError(f"Expected one native binary, found {candidates}")
    launch = len(list(run.glob("launch-*.json"))) + 1
    for filename in ("keyboard.txt", "mouse.txt", "floppy.txt"):
        path = run / filename
        if path.exists():
            path.rename(run / f"{path.stem}-before-{launch}.txt")
        path.touch()
    (run / f"config-before-{launch}.conf").write_bytes((run / "lisaem.conf").read_bytes())
    (run / f"launch-{launch}.json").write_text(json.dumps({
        "binary": str(candidates[0]), "binarySHA256": sha256(candidates[0]),
        "diskSHA256": sha256(run / "LisaOfficeHardDisk.dc42"),
        "configSHA256": sha256(run / "lisaem.conf"),
        "floppy": str(floppy) if floppy else None,
        "floppySHA256": sha256(floppy) if floppy else None,
    }, indent=2) + "\n")
    env = dict(os.environ)
    env.update({
        "LISAEM_SCREEN_DUMP": str(run / "screen.png"),
        "LISAEM_KEYBOARD_FILE": str(run / "keyboard.txt"),
        "LISAEM_MOUSE_FILE": str(run / "mouse.txt"),
        "LISAEM_FLOPPY_FILE": str(run / "floppy.txt"),
        "LISAEM_RAM_DUMP": str(run / "ram.bin"),
        "LISAEM_MOUSE_MOVE_AT": "20",
        "LISAEM_NO_DIALOGS": "1",
    })
    command = [str(candidates[0]), "-c", str(run / "lisaem.conf"), "-p", "-q", "-s-", "-z", "1"]
    if floppy:
        # Floppies can be branded or written by the guest: boot a private copy.
        target = run / floppy.name
        if not target.exists():
            shutil.copyfile(floppy, target)
        command += ["-f", str(target)]
    else:
        command += ["-d"]
    print(f"Running in {run}; output in native.log", flush=True)
    with (run / "native.log").open("a") as log:
        subprocess.run(command, cwd=run, env=env, stdout=log, stderr=log, check=True)


def insert_native(name, floppy):
    run = run_path(name)
    if not (run / "floppy.txt").exists():
        raise ValueError("Launch the prepared run before inserting a floppy")
    inspect_dc42(floppy)
    target = run / floppy.name
    if not target.exists():
        shutil.copyfile(floppy, target)
    with (run / "floppy.txt").open("a") as commands:
        commands.write(str(target.resolve()) + "\n")
    print(f"Queued {target}; insertion waits for an empty floppy drive")


def install_headless(name):
    binary = ROOT / "lisaem/build-im-native/lisaem-im"
    if not binary.exists():
        raise ValueError("Build the native headless frontend first")
    prepare_floppies(rle=True)
    prepare_native(name, "a8", blank=True)
    run = run_path(name)
    media = WORK / "prepared/floppies-rle"
    for number in range(1, 6):
        source = media / ("Office Sys 3 side 0.dc42" if number == 3
                          else f"Office Sys {number}.dart.dc42")
        shutil.copyfile(source, run / f"sys{number}.dc42")
    replay = ROOT / "lisaem/src/host/im/install-los.txt"
    shutil.copyfile(replay, run / "install.txt")
    command = [str(binary), "boot.ROM", "LisaOfficeHardDisk.dc42", "2000",
               "install-screen.pgm", "install.txt"]
    (run / "install-manifest.json").write_text(json.dumps({
        "binarySHA256": sha256(binary), "replaySHA256": sha256(replay),
        "command": command,
        "floppies": {f"sys{n}.dc42": sha256(run / f"sys{n}.dc42") for n in range(1, 6)},
    }, indent=2) + "\n")
    print("Installing LOS in the native harness; output in install.log", flush=True)
    with (run / "install.log").open("w") as log:
        subprocess.run(command, cwd=run,
                       env={**os.environ, "LISAEM_BOOT_FLOPPY": "sys1.dc42"},
                       stdout=log, stderr=log, check=True)
    # Keep the completed installation and matching PRAM before the cold boot.
    shutil.copyfile(run / "LisaOfficeHardDisk.dc42", run / "installed.dc42")
    shutil.copyfile(run / "pram.bin", run / "installed-pram.bin")
    with (run / "boot.log").open("w") as log:
        env = dict(os.environ)
        env.pop("LISAEM_BOOT_FLOPPY", None)
        subprocess.run([str(binary), "boot.ROM", "LisaOfficeHardDisk.dc42", "120",
                        "boot-screen.pgm"], cwd=run, env=env,
                       stdout=log, stderr=log, check=True)
    print(f"Inspect {run / 'boot-screen.pgm'} to confirm the guest reached the desktop")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("fetch")
    commands.add_parser("prepare-web")
    floppies = commands.add_parser("prepare-floppies")
    floppies.add_argument("--rle", action="store_true", help="Use the alternate Lisa 7/7 RLE archive")
    inspect_parser = commands.add_parser("inspect")
    inspect_parser.add_argument("image", type=Path)
    prepare = commands.add_parser("prepare-native")
    prepare.add_argument("name")
    prepare.add_argument("--iorom", choices=("88", "a8"), default="a8")
    prepare.add_argument("--blank", action="store_true")
    run = commands.add_parser("run-native")
    run.add_argument("name")
    run.add_argument("--floppy", type=Path)
    insert = commands.add_parser("insert-native")
    insert.add_argument("name")
    insert.add_argument("floppy", type=Path)
    install = commands.add_parser("install-headless")
    install.add_argument("name")
    args = parser.parse_args()
    if args.command == "fetch":
        fetch()
    elif args.command == "prepare-web":
        prepare_web()
    elif args.command == "prepare-floppies":
        prepare_floppies(args.rle)
    elif args.command == "inspect":
        print(json.dumps(inspect_dc42(args.image), indent=2))
    elif args.command == "prepare-native":
        prepare_native(args.name, args.iorom, args.blank)
    elif args.command == "insert-native":
        insert_native(args.name, args.floppy)
    elif args.command == "install-headless":
        install_headless(args.name)
    else:
        run_native(args.name, args.floppy)


if __name__ == "__main__":
    main()
