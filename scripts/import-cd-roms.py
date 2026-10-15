#!/usr/bin/env python3

import argparse
import glob
import hashlib
import io
import json
import os
import paths
import shutil
import struct
import subprocess
import sys
import tempfile
import typing
import urllib.parse
import urls
import zipfile

from PIL import Image

MAX_COVER_SIZE = 512
MEDIA_R2_PREFIX = "media"
DEFAULT_MEDIA_RCLONE_REMOTE = "cf:infinite-mac-disk"
RCLONE_CONFIG = "scripts/rclone.conf"
MEDIA_FILE_EXTENSIONS = (
    ".bin",
    ".dc42",
    ".cdr",
    ".dsk",
    ".image",
    ".img",
    ".iso",
    ".moof",
    ".toast",
)
MEDIA_ARCHIVE_EXTENSIONS = (".zip", ".sit", ".sitx", ".7z", ".rar", ".tar")


class InputManifest(typing.TypedDict):
    name: str
    src_url: typing.NotRequired[str]
    src_file: typing.NotRequired[str]
    src_member: typing.NotRequired[str]
    src_file_member: typing.NotRequired[str]
    src_ext: typing.NotRequired[str]
    origin_url: typing.NotRequired[str]
    cover_image: typing.NotRequired[str]
    cover_image_type: typing.NotRequired[str]
    mode: typing.NotRequired[str]
    data_offset: typing.NotRequired[int]
    data_size: typing.NotRequired[int]
    platform: typing.NotRequired[typing.Literal["Macintosh", "NeXT", "BeOS", "Lisa"]]
    is_floppy: typing.NotRequired[bool]
    self_hosted: typing.NotRequired[bool]
    _manifest_path: typing.NotRequired[str]


class OutputManifest(typing.TypedDict):
    name: str
    srcUrl: str
    originalSrcUrl: typing.NotRequired[str]
    srcExtension: str
    coverImageType: typing.NotRequired[str]
    coverImageSize: typing.NotRequired[typing.Tuple[int, int]]
    coverImageHash: typing.NotRequired[str]
    fileSize: int
    mode: typing.NotRequired[str]
    dataOffset: typing.NotRequired[int]
    dataSize: typing.NotRequired[int]
    platform: typing.NotRequired[typing.Literal["Macintosh", "NeXT", "BeOS", "Lisa"]]
    isFloppy: typing.NotRequired[bool]


def load_manifest(manifest_path: str) -> typing.Tuple[str, InputManifest]:
    folder_path, _ = os.path.splitext(
        os.path.relpath(manifest_path, paths.CD_ROMS_DIR))
    # Windows does not allow colons in filenames. To allow the repo to
    # be checked out in Windows, we use a "small colon" Unicode variant
    # in the filesystem, but replace it with a normal colon now.
    if ":" in folder_path:
        sys.stderr.write(
            "  WARNING: %s contains a colon in its path, it may not be accessible in Windows checkouts"
            % folder_path)
    folder_path = folder_path.replace("﹕", ":")
    _, name = os.path.split(folder_path)
    sys.stderr.write("Importing %s\n" % folder_path)
    with open(manifest_path, "r") as manifest:
        manifest_json = json.load(manifest)
        manifest_json["name"] = name
        manifest_json["_manifest_path"] = manifest_path
        return folder_path, manifest_json


def load_manifests(
        manifest_paths: typing.Optional[typing.Iterable[str]] = None
) -> typing.Iterator[typing.Tuple[str, InputManifest]]:
    if manifest_paths is None:
        manifest_paths = glob.iglob(os.path.join(paths.CD_ROMS_DIR, "**",
                                                 "*.json"),
                                    recursive=True)
    for manifest_path in manifest_paths:
        yield load_manifest(manifest_path)


def get_output_manifest(
    input_manifest: InputManifest,
    write_cover: bool = True,
    write_media: bool = True,
    sync_media: bool = False,
    media_rclone_remote: str = DEFAULT_MEDIA_RCLONE_REMOTE,
) -> OutputManifest:
    src_url, src_extension, file_size = get_source_info(
        input_manifest,
        write_media=write_media,
        sync_media=sync_media,
        media_rclone_remote=media_rclone_remote,
    )
    output_manifest = {
        "name": input_manifest["name"],
        "srcUrl": src_url,
        "srcExtension": src_extension.lower(),
        "fileSize": file_size,
    }
    if "src_url" in input_manifest and src_url != input_manifest["src_url"]:
        output_manifest["originalSrcUrl"] = input_manifest["src_url"]
    if "cover_image" in input_manifest:
        cover_image_hash, cover_image_size = load_cover_image(
            input_manifest["cover_image"],
            input_manifest.get("cover_image_inset"),
            write_cover=write_cover)
        output_manifest["coverImageHash"] = cover_image_hash
        output_manifest["coverImageSize"] = cover_image_size
    if "cover_image_type" in input_manifest:
        output_manifest["coverImageType"] = input_manifest["cover_image_type"]
    if "mode" in input_manifest:
        output_manifest["mode"] = input_manifest["mode"]
    decoded_size = (file_size // 2352 * 2048
                    if input_manifest.get("mode") == "MODE1/2352" else file_size)
    data_offset = input_manifest.get("data_offset", 0)
    if type(data_offset) is not int or not 0 <= data_offset < decoded_size:
        raise Exception("data_offset must be a byte offset within the decoded CD image")
    data_size = input_manifest.get("data_size", decoded_size - data_offset)
    if (type(data_size) is not int or data_size <= 0 or
            data_offset + data_size > decoded_size):
        raise Exception("data_size must select bytes within the decoded CD image")
    if "data_offset" in input_manifest:
        output_manifest["dataOffset"] = data_offset
    if "data_size" in input_manifest:
        output_manifest["dataSize"] = data_size
    if "platform" in input_manifest:
        if input_manifest["platform"] not in {"Macintosh", "NeXT", "BeOS", "Lisa"}:
            raise Exception("Unsupported CD-ROM platform: %s" % input_manifest["platform"])
        output_manifest["platform"] = input_manifest["platform"]
    if "is_floppy" in input_manifest:
        output_manifest["isFloppy"] = input_manifest["is_floppy"]
    return output_manifest


def get_source_info(
    input_manifest: InputManifest,
    write_media: bool = True,
    sync_media: bool = False,
    media_rclone_remote: str = DEFAULT_MEDIA_RCLONE_REMOTE,
) -> typing.Tuple[str, str, int]:
    has_src_url = "src_url" in input_manifest
    has_src_file = "src_file" in input_manifest
    if has_src_url == has_src_file:
        raise Exception("Manifest must have exactly one of src_url or src_file")
    if has_src_file:
        media, src_extension = load_media_file(input_manifest)
        if input_manifest.get("platform") == "Lisa":
            validate_lisa_floppy(media)
        hosted_url, file_size, = get_self_hosted_source_info(
            media, write_media, sync_media, media_rclone_remote)
        return hosted_url, input_manifest.get("src_ext", src_extension), file_size

    src_url = input_manifest["src_url"]
    src_name = urllib.parse.unquote(urllib.parse.urlsplit(src_url).path)
    _, src_extension = os.path.splitext(src_name)
    if input_manifest.get("is_floppy") or input_manifest.get("self_hosted"):
        src_path = urls.read_url_to_path(
            src_url,
            on_cache_miss=lambda: sys.stderr.write(
                "  Downloading media for self-hosting: %s\n" % src_url),
        )
        media, src_extension = load_media_path(src_path, src_name, input_manifest)
        if input_manifest.get("platform") == "Lisa":
            validate_lisa_floppy(media)
        hosted_url, file_size = get_self_hosted_source_info(
            media, write_media, sync_media, media_rclone_remote)
        return hosted_url, input_manifest.get("src_ext", src_extension), file_size

    if input_manifest.get("src_member") or input_manifest.get("src_file_member"):
        raise Exception("Remote archive members require self_hosted: true")

    headers = urls.read_url_headers(src_url)
    file_size = int(headers["Content-Length"])
    accepts_ranges = headers.get("Accept-Ranges") == "bytes"
    if not accepts_ranges:
        sys.stderr.write("  WARNING: %s does not support range requests\n" %
                         src_url)
    return src_url, src_extension, file_size


def validate_lisa_floppy(media: bytes) -> None:
    # Lisa needs the sector tags; a raw Macintosh-style data image is not enough.
    if len(media) < 84 or media[0] > 63 or media[82:84] != b"\x01\x00":
        raise ValueError("Lisa floppies must be tagged Disk Copy 4.2 images")
    data_size, tag_size, data_sum, tag_sum = struct.unpack(">IIII", media[64:80])
    if (data_size not in {400 * 1024, 800 * 1024} or
            tag_size != data_size // 512 * 12 or
            len(media) != 84 + data_size + tag_size):
        raise ValueError("Lisa floppies require 400K/800K data and 12-byte sector tags")

    def checksum(data):
        value = 0
        for (word,) in struct.iter_unpack(">H", data):
            value = (value + word) & 0xFFFFFFFF
            value = (value >> 1) | ((value & 1) << 31)
        return value

    if (checksum(media[84:84 + data_size]) != data_sum or
            checksum(media[84 + data_size + 12:]) != tag_sum):
        raise ValueError("Lisa floppy has invalid DC42 data/tag checksums")


def get_self_hosted_source_info(
    media: bytes,
    write_media: bool,
    sync_media: bool,
    media_rclone_remote: str,
) -> typing.Tuple[str, int]:
    media_hash = hashlib.sha256(media).hexdigest()
    media_key = f"{MEDIA_R2_PREFIX}/{media_hash}.media"
    if write_media:
        write_local_media(media_key, media)
    if sync_media:
        sync_media_to_r2(media_key, media, media_rclone_remote)
    return f"r2://{media_key}", len(media)


def write_local_media(media_key: str, media: bytes) -> None:
    media_path = os.path.join(paths.CD_ROMS_BUILD_DIR, media_key)
    os.makedirs(os.path.dirname(media_path), exist_ok=True)
    if os.path.isfile(media_path) and os.path.getsize(media_path) == len(media):
        return
    temp_path = media_path + ".tmp"
    with open(temp_path, "wb") as f:
        f.write(media)
    os.replace(temp_path, media_path)


def load_media_file(input_manifest: InputManifest) -> typing.Tuple[bytes, str]:
    manifest_path = input_manifest.get("_manifest_path")
    if not manifest_path:
        raise Exception("Cannot resolve src_file without manifest path")
    src_file = input_manifest["src_file"]
    src_path = os.path.normpath(
        os.path.join(os.path.dirname(manifest_path), src_file))
    if not os.path.isfile(src_path):
        raise Exception("src_file does not exist: %s" % src_file)
    return load_media_path(src_path, src_file, input_manifest)


def load_media_path(
    src_path: str,
    src_name: str,
    input_manifest: InputManifest,
) -> typing.Tuple[bytes, str]:
    if zipfile.is_zipfile(src_path):
        return load_media_from_zip(src_path, src_name, input_manifest)
    _, src_extension = os.path.splitext(src_name)
    if (src_extension.lower() in MEDIA_ARCHIVE_EXTENSIONS or
            input_manifest.get("src_member") or
            input_manifest.get("src_file_member")):
        return load_media_from_archive(src_path, src_name, input_manifest)
    with open(src_path, "rb") as f:
        return f.read(), src_extension


def load_media_from_zip(
    src_path: str,
    src_name: str,
    input_manifest: InputManifest,
) -> typing.Tuple[bytes, str]:
    with zipfile.ZipFile(src_path, "r") as zip_file:
        filenames = [
            info.filename for info in zip_file.infolist()
            if not info.is_dir()
        ]
        member = select_media_member(filenames, src_name, input_manifest)
        _, src_extension = os.path.splitext(member)
        return zip_file.read(member), src_extension


def load_media_from_archive(
    src_path: str,
    src_name: str,
    input_manifest: InputManifest,
) -> typing.Tuple[bytes, str]:
    if not os.path.isfile(paths.LSAR_PATH) or not os.path.isfile(paths.UNAR_PATH):
        raise Exception("Archive extraction requires lsar and unar "
                        "(build them with npm run build-tools)")
    listing = json.loads(subprocess.check_output(
        [paths.LSAR_PATH, "-json", src_path]))
    files = [entry for entry in listing["lsarContents"]
             if not entry.get("XADIsDirectory") and
             not entry.get("XADIsResourceFork")]
    member = select_media_member(
        [entry["XADFileName"] for entry in files], src_name, input_manifest)
    entry = next(entry for entry in files if entry["XADFileName"] == member)
    # Extract only the data fork. Selecting by index avoids matching the
    # resource fork with the same name, and stdout avoids filesystem metadata
    # and sidecar files being mistaken for disk image bytes.
    result = subprocess.run(
        [paths.UNAR_PATH, "-quiet", "-no-directory", "-no-recursion",
         "-output-directory", "-", "-indexes", src_path,
         str(entry["XADIndex"])],
        capture_output=True,
    )
    if result.returncode != 0:
        raise Exception("Could not extract %s from %s: %s" %
                        (member, src_name, result.stderr.decode(errors="replace")))
    if len(result.stdout) != entry["XADFileSize"]:
        raise Exception("Extracted size mismatch for %s in %s" % (member, src_name))
    _, src_extension = os.path.splitext(member)
    return result.stdout, src_extension


def select_media_member(
    filenames: typing.List[str],
    src_name: str,
    input_manifest: InputManifest,
) -> str:
    member = input_manifest.get("src_member") or input_manifest.get("src_file_member")
    if member:
        if filenames.count(member) != 1:
            raise Exception("Archive member must exist exactly once in %s: %s" %
                            (src_name, member))
        return member
    candidates = [name for name in filenames
                  if is_media_file(name) and not name.startswith("__MACOSX/") and
                  not os.path.basename(name).startswith("._")]
    if len(candidates) != 1:
        raise Exception("%s has %d media candidates (%s), specify src_member" %
                        (src_name, len(candidates), ", ".join(candidates)))
    return candidates[0]


def is_media_file(filename: str) -> bool:
    return filename.lower().endswith(MEDIA_FILE_EXTENSIONS)


def sync_media_to_r2(key: str, media: bytes, media_rclone_remote: str) -> None:
    existing_size = get_r2_object_size(key, media_rclone_remote)
    if existing_size == len(media):
        sys.stderr.write("  R2 media already exists: %s\n" % key)
        return
    if existing_size is not None:
        sys.stderr.write(
            "  R2 media size mismatch for %s (%d != %d), uploading\n" %
            (key, existing_size, len(media)))
    else:
        sys.stderr.write("  Uploading R2 media: %s\n" % key)

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_file.write(media)
            temp_path = temp_file.name
        subprocess.run(
            [
                "rclone",
                "--config=%s" % RCLONE_CONFIG,
                "copyto",
                "--s3-no-check-bucket",
                "--no-update-modtime",
                temp_path,
                "%s/%s" % (media_rclone_remote, key),
            ],
            check=True,
        )
    finally:
        if temp_path:
            os.unlink(temp_path)


def get_r2_object_size(key: str,
                       media_rclone_remote: str) -> typing.Optional[int]:
    result = subprocess.run(
        [
            "rclone",
            "--config=%s" % RCLONE_CONFIG,
            "lsjson",
            "--stat",
            "%s/%s" % (media_rclone_remote, key),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    try:
        stat = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None
    if isinstance(stat, list):
        if not stat:
            return None
        stat = stat[0]
    if stat.get("IsDir"):
        return None
    size = stat.get("Size")
    return size if isinstance(size, int) and size >= 0 else None


def load_cover_image(
    cover_image_url: str, inset: typing.Union[int, typing.Tuple[int, int, int,
                                                                int]],
    write_cover: bool = True,
) -> typing.Tuple[str, typing.Tuple[int, int]]:
    cover_image_path = urls.read_url_to_path(cover_image_url)
    with Image.open(cover_image_path) as cover_image:
        if inset is not None:
            if isinstance(inset, int):
                inset_left = inset_top = inset_right = inset_bottom = inset
            else:
                inset_left, inset_top, inset_right, inset_bottom = inset
            cover_image = cover_image.crop(box=(
                inset_left,
                inset_top,
                cover_image.width - inset_right,
                cover_image.height - inset_bottom,
            ))

        cover_image.thumbnail((MAX_COVER_SIZE, MAX_COVER_SIZE), Image.LANCZOS)

        # Ensure that we can write the output as JPEG, even if it's a palettized
        # PNG or GIF.
        if cover_image.mode != "RGB":
            cover_image = cover_image.convert("RGB")

        cover_image_output = io.BytesIO()
        cover_image.save(cover_image_output, format="JPEG")
        cover_image_content = cover_image_output.getvalue()
        cover_image_hash = hashlib.sha256(cover_image_content).hexdigest()
        if write_cover:
            cover_image_path = os.path.join(paths.COVERS_DIR,
                                            f"{cover_image_hash}.jpeg")

            with open(cover_image_path, "wb") as f:
                f.write(cover_image_content)

        return cover_image_hash, cover_image.size


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "placeholder",
        nargs="?",
        choices=["placeholder"],
        help="generate a stub output manifest",
    )
    parser.add_argument(
        "--validate",
        nargs="*",
        metavar="MANIFEST",
        help=(
            "validate all manifests, or only the provided CD-ROMs/*.json "
            "manifest paths, without writing generated outputs"
        ),
    )
    parser.add_argument(
        "--sync-media",
        action="store_true",
        help="upload self-hosted media to Cloudflare R2 if missing",
    )
    parser.add_argument(
        "--media-rclone-remote",
        default=DEFAULT_MEDIA_RCLONE_REMOTE,
        help="rclone remote used by --sync-media",
    )
    args = parser.parse_args()

    if args.validate is not None:
        input_manifests = load_manifests(args.validate or None)
        had_errors = False
        for _, input_manifest in input_manifests:
            try:
                get_output_manifest(
                    input_manifest,
                    write_cover=False,
                    write_media=False,
                    sync_media=args.sync_media,
                    media_rclone_remote=args.media_rclone_remote,
                )
            except Exception as e:
                sys.stderr.write("  ERROR: %s\n" % e)
                had_errors = True
        return 1 if had_errors else 0

    placeholder_mode = args.placeholder == "placeholder"
    shutil.rmtree(paths.COVERS_DIR, ignore_errors=True)
    os.mkdir(paths.COVERS_DIR)
    shutil.rmtree(paths.CD_ROMS_BUILD_DIR, ignore_errors=True)
    os.mkdir(paths.CD_ROMS_BUILD_DIR)

    output_manifests = {}
    if not placeholder_mode:
        input_manifests = load_manifests()
        for folder_path, input_manifest in input_manifests:
            try:
                output_manifest = get_output_manifest(
                    input_manifest,
                    sync_media=args.sync_media,
                    media_rclone_remote=args.media_rclone_remote,
                )
            except Exception as e:
                sys.stderr.write("  ERROR, will be skipped: %s\n" % e)
                continue
            output_manifests[folder_path] = output_manifest

    with open(os.path.join(paths.DATA_DIR, "CD-ROMs.json"), "w") as f:
        json.dump(output_manifests, f, indent=4)


if __name__ == "__main__":
    sys.exit(main())
