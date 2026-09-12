#!/usr/bin/env python3

import argparse
import os.path
import struct
import tempfile
import zipfile

import basilisk
import disks
import library
import machfs
import macresources
import minivmac
import paths
import placeholders
import stickies


def parse_args():
    parser = argparse.ArgumentParser(
        description="Load placeholder files into system disk images."
    )
    parser.add_argument(
        "--system6",
        action="store_true",
        help="Boot from System 6 (to avoid creating System 7-style desktop DBs)."
    )
    parser.add_argument(
        "--fsck",
        action="store_true",
        help="Run fsck on the generated placeholder disk image.",
    )
    return parser.parse_args()


def build_placeholder_image(system6: bool = False) -> bytes:
    volume = machfs.Volume()

    # Use a full system disk image as the template so that the generated tools
    # disk can also be the boot disk.
    template_image_name = "System 6.0.8 HD.dsk" if system6 else "System 7.1 HD.dsk"
    template_image_path = os.path.join(paths.IMAGES_DIR, template_image_name)
    with open(template_image_path, "rb") as f:
        volume.read(f.read())
    # But remove things that might get confusing.
    for item_name in ("Desktop Folder", "Utilities Folder", "Read Me"):
        if item_name in volume:
            del volume[item_name]

    volume.name = "Infinite Mac Placeholders"

    stickies_file = machfs.File()
    stickies_file.data = stickies.generate_placeholder()
    stickies_file.type = b"notz"
    stickies_file.creator = b"notz"
    volume["Stickies file"] = stickies_file

    ttxt_file = machfs.File()
    ttxt_file.data = stickies.generate_ttxt_placeholder()
    ttxt_file.type = b"TEXT"
    ttxt_file.creator = b"ttxt"
    volume["Welcome!"] = ttxt_file

    # Template scrn resource (and ResEdit to inject it with) so that we can
    # replace it with the appropriate dynamically-generated resource for the
    # selected video card and resolution.
    screen_file = machfs.File()
    screen_file.rsrc = macresources.make_file(
        [
            macresources.Resource(
                type=b"scrn",
                id=0,
                data=placeholders.SCRN_RESOURCE,
            )
        ]
    )
    screen_file.type = b"rsrc"
    screen_file.creator = b"RSED"
    volume["Screen Settings"] = screen_file
    volume["ResEdit"] = load_resedit()

    # Include Speed Disk so the target disks can be defragmented after
    # their placeholder files are copied. This ensures that the files are
    # written as contiguous chunks for import-disks.py to replace in place.
    volume["Speed Disk"] = load_speed_disk()

    return volume.write(
        size=40 * 1024 * 1024,
        align=512,
        # desktopdb=True,
        bootable=True,
    )

def load_resedit() -> machfs.File:
    resedit_zip_path = os.path.join(paths.LIBRARY_DIR, "Developer", "ResEdit.zip")
    resedit_folder = library.import_zip(resedit_zip_path)
    return resedit_folder["ResEdit"]

def load_speed_disk() -> machfs.File:
    resedit_zip_path = os.path.join(paths.LIBRARY_DIR, "Utilities", "Norton Utilities 3.2.1.zip")
    resedit_folder = library.import_zip(resedit_zip_path)
    return resedit_folder["Norton Tools"]["Speed Disk"]

def main() -> None:
    args = parse_args()

    with tempfile.TemporaryDirectory() as temp_dir:
        output_path = os.path.join(temp_dir, "Placeholders.dsk")
        with open(output_path, "wb") as output_file:
            output_file.write(build_placeholder_image(system6=args.system6))

        print(f"Wrote placeholder files to disk image {output_path}")
        if args.fsck:
            print("Running fsck on the generated placeholder disk image...")
            library.fsck_hfs_image(output_path)
            print("fsck completed successfully.")

        system_disks = disks.ALL_DISKS
        disk_filter = os.getenv("DEBUG_SYSTEM_FILTER")
        if disk_filter:
            system_disks = [disk for disk in system_disks if disk_filter in disk.name]

        instructions = (
            "\n\nManual steps:"
            "\n- Copy 'Stickies file' to each Preferences folder and/or the Welcome! file to the desktop."
            "\n- Use the included ResEdit to copy 'scrn' resource ID 0 from "
            "'Screen Settings' into each target System file."
        )
        target_paths = [disk.path() for disk in system_disks]
        disk_paths = [output_path] + target_paths

        if args.system6:
            print(
                f"Starting Mini vMac under System 6 with "
                f"{len(system_disks)} disk images. {instructions}"
            )
            minivmac.run(disk_paths)
        else:
            print(
                f"Starting Basilisk II with {len(system_disks)} disk images. "
                f"{instructions}"
            )
            basilisk.run(disk_paths, modelid=30)


if __name__ == "__main__":
    main()
