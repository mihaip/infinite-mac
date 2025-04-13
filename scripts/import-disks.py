#!/usr/bin/env python3

import copy
import basilisk
import disks
import hashlib
import json
import library
import logging
import minivmac
import os
import paths
import shutil
import sys
import tempfile
import typing
import zipfile
import subprocess
import stickies

CHUNK_SIZE = 256 * 1024


class ImageDef(typing.NamedTuple):
    name: str
    path: str


def write_image_def(image: bytes, name: str, dest_dir: str) -> ImageDef:
    image_path = os.path.join(dest_dir, name)
    with open(image_path, "wb") as image_file:
        image_file.write(image)
    return ImageDef(name, image_path)


ZERO_CHUNK = b"\0" * CHUNK_SIZE


def write_chunked_image(image: ImageDef) -> None:
    total_size = 0
    chunks = []
    chunk_signatures = set()
    zero_chunk_count = 0
    salt = b'raw'
    with open(image.path, "rb") as image_file:
        image_bytes = image_file.read()
    disk_size = len(image_bytes)
    for i in range(0, disk_size, CHUNK_SIZE):
        sys.stderr.write("Chunking %s: %.1f%%\r" %
                         (image.name, ((i + CHUNK_SIZE) / disk_size) * 100))
        chunk = image_bytes[i:i + CHUNK_SIZE]
        total_size += len(chunk)
        # Don't bother storing zero-ed out chunks (common for the saved HD),
        # the signature takes up space, and we don't need to load them
        if chunk == ZERO_CHUNK:
            chunks.append("")
            zero_chunk_count += 1
            continue
        chunk_signature = hashlib.blake2b(chunk, digest_size=16,
                                          salt=salt).hexdigest()
        chunks.append(chunk_signature)
        if chunk_signature in chunk_signatures:
            continue
        chunk_signatures.add(chunk_signature)
        chunk_path = os.path.join(paths.DISK_DIR, f"{chunk_signature}.chunk")
        if os.path.exists(chunk_path):
            # An earlier run of this script (e.g. for a different base image)
            # may have already created this file.
            continue
        with open(chunk_path, "wb+") as chunk_file:
            chunk_file.write(chunk)

    if len(chunks) > 0:
        sys.stderr.write(
            "Chunked %s: %d%% unique chunks, %d%% zero chunks\n" % (
                image.name,
                round(len(chunk_signatures) / len(chunks) * 100),
                round(zero_chunk_count / len(chunks) * 100),
            ))
    else:
        sys.stderr.write("Chunked %s: 0 chunks\n" % image.name)

    manifest_path = os.path.join(paths.DATA_DIR, f"{image.name}.json")
    with open(manifest_path, "w+") as manifest_file:
        json.dump(
            {
                "name": os.path.splitext(image.name)[0],
                "totalSize": total_size,
                "chunks": chunks,
                "chunkSize": CHUNK_SIZE,
            },
            manifest_file,
            indent=4)


def build_system_image(
    disk: disks.Disk,
    dest_dir: str,
) -> ImageDef:
    sys.stderr.write("Building system image %s\n" % (disk.name, ))

    input_path = disk.path()
    if not os.path.exists(input_path):
        logging.warning("File for disk image %s (%s) does not exist, using placeholder", disk.name, input_path)
        image_data = bytes()
    elif disk.compressed:
        with zipfile.ZipFile(input_path, "r") as zip:
            image_data = zip.read(disk.name)
    else:
        with open(input_path, "rb") as image:
            image_data = image.read()

    stickies_placeholder = stickies.generate_placeholder()
    stickies_index = image_data.find(stickies_placeholder)
    use_ttxt = False
    if stickies_index == -1:
        use_ttxt = True
        stickies_placeholder = stickies.generate_ttxt_placeholder()
        stickies_index = image_data.find(stickies_placeholder)
    if stickies_index == -1:
        use_ttxt = True
        stickies_placeholder = stickies.generate_next_placeholder()
        stickies_index = image_data.find(stickies_placeholder)

    if stickies_index == -1:
        logging.warning(
            "Placeholder file not found in disk image %s, skipping customization",
            disk.name)
    else:
        customized_stickies = copy.deepcopy(STICKIES)
        with open("CHANGELOG.md", "r") as changelog_file:
            changelog = changelog_file.read()
        if disk.welcome_sticky_override:
            customized_stickies[-1] = copy.deepcopy(
                disk.welcome_sticky_override)
        for sticky in customized_stickies:
            sticky.text = sticky.text.replace("CHANGELOG", changelog)
            if disk.stickies_encoding == "shift_jis":
                # Bullets are not directly representable in Shift-JIS, replace
                # them with a KATAKANA MIDDLE DOT.
                sticky.text = sticky.text.replace("•", "・")

        stickies_file = stickies.StickiesFile(stickies=customized_stickies)
        if use_ttxt:
            stickies_data = stickies_file.to_ttxt_bytes(disk.stickies_encoding)
        else:
            stickies_data = stickies_file.to_bytes(disk.stickies_encoding)

        if len(stickies_data) > len(stickies_placeholder):
            logging.warning(
                "Stickies file is too large (%d, placeholder is only %d), "
                "skipping customization for %s", len(stickies_data),
                len(stickies_placeholder), disk.name)
        else:
            # Replace the leftover placeholder data, so that TextText does not
            # render it (not needed for Stickies since they have a length
            # field, but it doesn't hurt either).
            image_data = image_data[:stickies_index] + stickies_data + \
                disk.sticky_placeholder_overwrite_byte * (len(stickies_placeholder) - len(stickies_data)) + \
                image_data[stickies_index + len(stickies_placeholder):]

    return write_image_def(image_data, disk.name, dest_dir)


def build_library_images(dest_dir: str) -> typing.Tuple[ImageDef, ImageDef, ImageDef]:
    image6, image, imageX = library.build_images()

    image6_def = write_image_def(image6, "Infinite HD6.dsk", dest_dir)
    image_def = write_image_def(image, "Infinite HD.dsk", dest_dir)
    imageX_def = write_image_def(imageX, "Infinite HDX.dsk", dest_dir)

    return image6_def, image_def, imageX_def


def build_passthrough_image(base_name: str, dest_dir: str, compressed: bool = False) -> ImageDef:
    input_path = os.path.join(paths.IMAGES_DIR, base_name)
    if compressed:
        with zipfile.ZipFile(input_path + ".zip", "r") as zip:
            image_data = zip.read(base_name)
    else:
        with open(input_path, "rb") as image:
            image_data = image.read()
    return write_image_def(image_data, base_name, dest_dir)


def build_saved_hd_image(base_name: str, dest_dir: str) -> ImageDef:
    # The disk image is compressed since it's mostly empty space and we don't
    # want to pay for a lot of Git LFS storage.
    with zipfile.ZipFile(os.path.join(paths.IMAGES_DIR, base_name + ".zip"),
                         "r") as zip:
        image_data = zip.read(base_name)

    # Also use the Stickies placeholder file to inject the Saved HD Read Me
    readme_placeholder = stickies.generate_ttxt_placeholder()
    readme_index = image_data.find(readme_placeholder)

    if readme_index != -1:
        readme_data = read_strings("saved-hd.txt").replace(
            "\n", "\r").encode("macroman")

        if len(readme_data) > len(readme_placeholder):
            logging.warning(
                "Read Me file is too large (%d, placeholder is only %d), "
                "skipping customization for %s", len(readme_data),
                len(readme_placeholder), base_name)
        else:
            # Replace the leftover placeholder data, so that TextText does not
            # render.
            image_data = image_data[:readme_index] + readme_data + \
                b"\x00" * (len(readme_placeholder) - len(readme_data)) + \
                image_data[readme_index + len(readme_placeholder):]
    else:
        logging.warning(
            "Placeholder file not found in disk image %s, skipping Read Me",
            base_name)

    return write_image_def(image_data, base_name, dest_dir)


def build_desktop_db6(images: typing.List[ImageDef]) -> None:
    sys.stderr.write("Building System 6 Desktop for %s...\n" %
                     ",".join([i.name for i in images]))
    try:
        minivmac.run([disks.SYSTEM_608.path()] + [i.path for i in images])
    except subprocess.CalledProcessError as e:
        sys.stderr.write("Failed to build System 6 Desktop, will continue.\n")


def build_desktop_db(images: typing.List[ImageDef]) -> None:
    sys.stderr.write("Rebuilding Desktop DB for %s...\n" %
                     ",".join([i.name for i in images]))
    try:
        basilisk.run(
            # Boot from Mac OS 8.1 to ensure that the Desktop database that's
            # created is acceptable to all classic Mac OS versions (one generated by
            # System 7 is not).
            ["*" + disks.MAC_OS_81.path()] + [i.path for i in images])
    except subprocess.CalledProcessError as e:
        sys.stderr.write("Failed to build Desktop DB, will continue.\n")


def read_strings(name: str) -> str:
    with open(os.path.join(paths.STRINGS_DIR, name), "r") as f:
        return f.read()


STICKIES = [
    stickies.Sticky(
        top=238,
        left=462,
        bottom=442,
        right=642,
        color=stickies.Color.GRAY,
        text="CHANGELOG",
    ),
    stickies.Sticky(
        top=316,
        left=22,
        bottom=553,
        right=280,
        color=stickies.Color.PURPLE,
        skip_in_ttxt=True,
        text=read_strings("tips.txt"),
    ),
    stickies.Sticky(
        top=316,
        left=22,
        bottom=553,
        right=280,
        color=stickies.Color.PURPLE,
        skip_in_stickies=True,
        text=read_strings("tips-no-outside-world.txt"),
    ),
    stickies.Sticky(
        top=352,
        left=296,
        bottom=532,
        right=482,
        color=stickies.Color.PINK,
        text=read_strings("networking.txt"),
        skip_in_ttxt=True,
    ),
    stickies.Sticky(
        top=119,
        left=494,
        bottom=235,
        right=671,
        color=stickies.Color.GREEN,
        text=read_strings("intro.txt"),
    ),
    stickies.Sticky(
        top=66,
        left=454,
        bottom=126,
        right=640,
        font=stickies.Font.HELVETICA,
        size=18,
        style={stickies.Style.BOLD},
        text='Welcome to Infinite Macintosh!',
    ),
]

if __name__ == "__main__":
    system_filter = os.getenv("DEBUG_SYSTEM_FILTER")
    library_filter = os.getenv("DEBUG_LIBRARY_FILTER")
    if not library_filter and not system_filter:
        shutil.rmtree(paths.DISK_DIR, ignore_errors=True)
        os.mkdir(paths.DISK_DIR)
    with tempfile.TemporaryDirectory() as temp_dir:
        images = []
        if not library_filter:
            for disk in disks.ALL_DISKS:
                if system_filter and system_filter not in disk.name:
                    continue
                images.append(build_system_image(disk, temp_dir))
        if not system_filter:
            infinite_hd6_image, infinite_hd_image, infinite_hdX_image = build_library_images(temp_dir)
            images.append(infinite_hd6_image)
            images.append(infinite_hd_image)
            images.append(infinite_hdX_image)
            if not library_filter:
                build_desktop_db6([infinite_hd6_image])
                build_desktop_db([infinite_hd_image, infinite_hdX_image])

            images.append(
                build_passthrough_image("Infinite HD (MFS).dsk",
                                        dest_dir=temp_dir))
            images.append(
                build_passthrough_image("Infinite HD (NeXT).dsk",
                                        dest_dir=temp_dir,
                                        compressed=True))

        images.append(build_saved_hd_image("Saved HD.dsk", dest_dir=temp_dir))

        for image in images:
            write_chunked_image(image)
