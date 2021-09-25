#!/usr/local/bin/python3

import brotli
import glob
import hashlib
import json
import machfs
import os
import struct
import sys
import typing
import urllib.request

LIBRARY_DIR = os.path.join(os.path.dirname(__file__), "..", "Library")
CACHE_DIR = os.path.join("/tmp", "infinite-mac-cache")

input_path = sys.argv[1]
output_dir = sys.argv[2]
manifest_dir = sys.argv[3]

DISK_SIZE = 100 * 1024 * 1024
CHUNK_SIZE = 256 * 1024
chunk_count = 0
total_size = 0

input_file_name = os.path.basename(input_path)


def read_url(url: str) -> bytes:
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)
    cache_key = hashlib.sha256(url.encode()).hexdigest()
    cache_path = os.path.join(CACHE_DIR, cache_key)
    if os.path.exists(cache_path):
        return open(cache_path, "rb").read()
    response = urllib.request.urlopen(url)
    response_body = response.read()
    with open(cache_path, "wb+") as f:
        f.write(response_body)
    return response_body


def get_import_folders() -> typing.Dict[str, machfs.Folder]:
    sys.stderr.write("Importing other images\n")

    import_folders = {}
    for manifest_path in glob.iglob(os.path.join(LIBRARY_DIR, "**", "*.json")):
        folder_path, _ = os.path.splitext(
            os.path.relpath(manifest_path, LIBRARY_DIR))
        sys.stderr.write("  Importing %s\n" % folder_path)
        with open(manifest_path, "r") as manifest:
            manifest_json = json.load(manifest)
        v = machfs.Volume()
        v.read(read_url(manifest_json["src_url"]))
        if "src_folder" in manifest_json:
            folder = v[manifest_json["src_folder"]]
            # Clear x/y position so that the Finder computes a layout for us.
            (rect_x, rect_y, rect_width, rect_height, flags, window_x,
             window_y, view) = struct.unpack(">hhhhHhhH", folder.usrInfo)
            window_x = -1
            window_y = -1
            folder.usrInfo = struct.pack(">hhhhHhhH", rect_x, rect_y,
                                         rect_width, rect_height, flags,
                                         window_x, window_y, view)
        elif "src_denylist" in manifest_json:
            denylist = manifest_json["src_denylist"]
            folder = machfs.Folder()
            for name, item in v.items():
                if name not in denylist:
                    folder[name] = item
        else:
            assert False, "Unexpected manifest format: %s" % json.dumps(
                manifest_json)
        import_folders[folder_path] = folder
        sys.stderr.flush()

    sys.stderr.write("\n")
    return import_folders


import_folders = get_import_folders()

hash = hashlib.sha256()

sys.stderr.write("Chunking and compressing %s" % input_file_name)
sys.stderr.flush()

with open(input_path, "rb") as input_file:
    v = machfs.Volume()
    v.read(input_file.read(), preserve_desktopdb=True)
    v.name = "Macintosh HD"

    for folder_path, folder in import_folders.items():
        parent = v["Library"]
        folder_path_pieces = folder_path.split(os.path.sep)
        for folder_path_piece in folder_path_pieces[:-1]:
            parent = parent[folder_path_piece]
        parent[folder_path_pieces[-1]] = folder

    flat = v.write(
        size=DISK_SIZE,
        align=512,
        desktopdb=False,
        bootable=True,
    )

    for i in range(0, DISK_SIZE, CHUNK_SIZE):
        chunk = flat[i:i + CHUNK_SIZE]
        total_size += len(chunk)
        chunk_compressed = brotli.compress(chunk, quality=0)  # NOCOMMIT
        chunk_path = os.path.join(output_dir,
                                  f"{input_file_name}.{chunk_count}.br")
        # Use compressed version for the version hash so that if we change the
        # compression quality we can trigger a re-download.
        hash.update(chunk_compressed)
        with open(chunk_path, "wb+") as chunk_file:
            chunk_file.write(chunk_compressed)
        chunk_count += 1
        sys.stderr.write(".")
        sys.stderr.flush()

sys.stderr.write("\n")

manifest_path = os.path.join(manifest_dir, f"{input_file_name}.json")
with open(manifest_path, "w+") as manifest_file:
    json.dump(
        {
            "totalSize": total_size,
            "chunkCount": chunk_count,
            "chunkSize": CHUNK_SIZE,
            "version": hash.hexdigest()
        },
        manifest_file,
        indent=4)
