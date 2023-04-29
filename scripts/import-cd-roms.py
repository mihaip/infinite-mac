#!/usr/bin/env python3

import glob
import hashlib
import io
import json
import os
import paths
import shutil
import sys
import typing
import urls

from PIL import Image

MAX_COVER_SIZE = 512


class InputManifest(typing.TypedDict):
    name: str
    src_url: str
    cover_image: str
    cover_image_type: typing.NotRequired[str]


class OutputManifest(typing.TypedDict):
    name: str
    srcUrl: str
    coverImageType: typing.NotRequired[str]
    coverImageSize: typing.Tuple[int, int]
    coverImageHash: str
    fileSize: int


def load_manifests() -> typing.Dict[str, InputManifest]:
    for manifest_path in glob.iglob(os.path.join(paths.CD_ROMS_DIR, "**",
                                                 "*.json"),
                                    recursive=True):
        folder_path, _ = os.path.splitext(
            os.path.relpath(manifest_path, paths.CD_ROMS_DIR))
        _, name = os.path.split(folder_path)
        sys.stderr.write("Importing %s\n" % folder_path)
        with open(manifest_path, "r") as manifest:
            manifest_json = json.load(manifest)
            manifest_json["name"] = name
            yield folder_path, manifest_json


def get_output_manifest(input_manifest: InputManifest) -> OutputManifest:
    src_url = input_manifest["src_url"]
    headers = urls.read_url_headers(src_url)
    file_size = int(headers["Content-Length"])
    accepts_ranges = headers["Accept-Ranges"] == "bytes"
    if not accepts_ranges:
        sys.stderr.write("  WARNING: %s does not support range requests\n" %
                         src_url)

    cover_image_hash, cover_image_size = load_cover_image(
        input_manifest["cover_image"])
    output_manifest = {
        "name": input_manifest["name"],
        "srcUrl": src_url,
        "fileSize": file_size,
        "coverImageHash": cover_image_hash,
        "coverImageSize": cover_image_size,
    }
    if "cover_image_type" in input_manifest:
        output_manifest["coveImageType"] = input_manifest["cover_image_type"]

    return output_manifest


def load_cover_image(
        cover_image_url: str) -> typing.Tuple[str, typing.Tuple[int, int]]:
    cover_image_path = urls.read_url_to_path(cover_image_url)
    with Image.open(cover_image_path) as cover_image:
        cover_image.thumbnail((MAX_COVER_SIZE, MAX_COVER_SIZE), Image.LANCZOS)

        cover_image_output = io.BytesIO()
        cover_image.save(cover_image_output, format="JPEG")
        cover_image_content = cover_image_output.getvalue()
        cover_image_hash = hashlib.sha256(cover_image_content).hexdigest()
        cover_image_path = os.path.join(paths.COVERS_DIR,
                                        f"{cover_image_hash}.jpeg")

        with open(cover_image_path, "wb") as f:
            f.write(cover_image_content)

        return cover_image_hash, cover_image.size


def main():
    shutil.rmtree(paths.COVERS_DIR, ignore_errors=True)
    os.mkdir(paths.COVERS_DIR)

    input_manifests = load_manifests()
    output_manifests = {}
    for folder_path, input_manifest in input_manifests:
        output_manifest = get_output_manifest(input_manifest)
        output_manifests[folder_path] = output_manifest

    with open(os.path.join(paths.DATA_DIR, "CD-ROMs.json"), "w") as f:
        json.dump(output_manifests, f, indent=4)


if __name__ == "__main__":
    main()
