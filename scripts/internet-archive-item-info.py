#!/usr/bin/env python3

import argparse
import json
import os.path
import sys
import typing
import urllib.parse

import urls
from PIL import Image


METADATA_URL = "https://archive.org/metadata/{identifier}"
DOWNLOAD_URL = "https://archive.org/download/{identifier}/{filename}"

RAW_IMAGE_EXTENSIONS = {
    ".2mg",
    ".adf",
    ".bin",
    ".cdr",
    ".cue",
    ".dc42",
    ".dmg",
    ".dsk",
    ".hda",
    ".hdv",
    ".hfs",
    ".hfv",
    ".ima",
    ".image",
    ".img",
    ".iso",
    ".moof",
    ".raw",
    ".toast",
    ".woz",
}

COVER_IMAGE_EXTENSIONS = {
    ".gif",
    ".jpeg",
    ".jpg",
    ".png",
    ".tif",
    ".tiff",
}


def archive_file_to_output(
    identifier: str, archive_file: dict[str, typing.Any]
) -> dict[str, typing.Any]:
    filename = archive_file["name"]
    output = {
        "name": filename,
        "src_url": DOWNLOAD_URL.format(
            identifier=urllib.parse.quote(identifier, safe=""),
            filename=urllib.parse.quote(filename, safe="/"),
        ),
    }
    for key in ["size", "format", "source", "md5", "crc32", "sha1"]:
        if key in archive_file:
            output[key] = archive_file[key]
    if "size" in output:
        output["size"] = int(output["size"])
    return output


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Fetch Internet Archive item metadata and list raw disk image "
            "files and possible cover images."
        )
    )
    parser.add_argument(
        "items",
        nargs="*",
        help=(
            "archive.org item URL(s), download URL(s), metadata URL(s), or raw "
            "item identifier(s)"
        ),
    )
    parser.add_argument(
        "--input-file",
        help=(
            "read additional item URLs or identifiers from a file, one per line; "
            "blank lines and # comments are ignored"
        ),
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="emit compact JSON instead of pretty-printed JSON",
    )
    args = parser.parse_args()

    item_args = list(args.items)
    if args.input_file:
        with open(args.input_file) as f:
            item_args.extend(
                line.strip()
                for line in f
                if line.strip() and not line.lstrip().startswith("#")
            )
    if not item_args:
        print(
            "Usage: %s [--input-file URLS.txt] <archive.org URL or identifier>..."
            % sys.argv[0],
            file=sys.stderr,
        )
        return 1

    items = []
    for item in item_args:
        parsed = urllib.parse.urlparse(item)
        if not parsed.scheme and not parsed.netloc:
            if "/" in item:
                raise ValueError(
                    "Expected an archive.org URL or bare identifier: %s" % item
                )
            identifier = item
        elif parsed.netloc.endswith("archive.org"):
            path_parts = [
                urllib.parse.unquote(part)
                for part in parsed.path.split("/")
                if part
            ]
            if len(path_parts) < 2 or path_parts[0] not in {
                "details",
                "download",
                "embed",
                "metadata",
                "stream",
            }:
                raise ValueError(
                    "Could not determine item identifier from URL: %s" % item
                )
            identifier = path_parts[1]
        else:
            raise ValueError("Expected an archive.org URL: %s" % item)

        metadata_url = METADATA_URL.format(
            identifier=urllib.parse.quote(identifier, safe="")
        )
        metadata = json.loads(urls.read_url(metadata_url))
        raw_image_files = []
        cover_image_files = []
        for archive_file in metadata.get("files", []):
            filename = archive_file.get("name")
            if not filename:
                continue
            basename = os.path.basename(filename.lower())
            _, extension = os.path.splitext(basename)
            if extension in RAW_IMAGE_EXTENSIONS:
                raw_image_files.append(archive_file_to_output(identifier, archive_file))
            if (
                extension in COVER_IMAGE_EXTENSIONS
                and not basename.endswith("_thumb%s" % extension)
            ):
                cover_image = archive_file_to_output(identifier, archive_file)
                cover_image_path = urls.read_url_to_path(cover_image["src_url"])
                with Image.open(cover_image_path) as image:
                    width, height = image.size
                cover_image["width"] = width
                cover_image["height"] = height
                cover_image["aspect_ratio"] = round(width / height, 4)

                format_name = cover_image.get("format", "").lower()
                if basename == "__ia_thumb.jpg":
                    name_rank = 30
                elif (
                    "front" in basename
                    or "cover" in basename
                    or "artwork" in basename
                ):
                    name_rank = 0
                elif "disc" in basename or "disk" in basename or "cd" in basename:
                    name_rank = 1
                else:
                    name_rank = 10
                if "back" in basename or "rear" in basename:
                    name_rank += 20

                cover_image["_sort_key"] = (
                    1 if "thumb" in format_name or "thumb" in basename else 0,
                    name_rank,
                    0 if extension in {".jpg", ".jpeg", ".png"} else 1,
                    0 if cover_image.get("source") == "original" else 1,
                )
                cover_image_files.append(cover_image)

        cover_image_files.sort(key=lambda cover_image: cover_image["_sort_key"])
        for cover_image in cover_image_files:
            del cover_image["_sort_key"]
        item_info = {
            "identifier": identifier,
            "title": metadata.get("metadata", {}).get("title") or identifier,
            "item_url": "https://archive.org/details/%s"
            % urllib.parse.quote(identifier, safe=""),
            "metadata_url": metadata_url,
            "raw_image_files": raw_image_files,
        }
        if cover_image_files:
            item_info["best_cover_image"] = cover_image_files[0]["src_url"]
            item_info["cover_image_files"] = cover_image_files
        items.append(item_info)

    output = items[0] if len(items) == 1 else items
    json.dump(output, sys.stdout, indent=None if args.compact else 4)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
