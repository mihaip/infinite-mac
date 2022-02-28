#!/usr/local/bin/python3

import glob
import hashlib
import json
import machfs
import os
import struct
import sys
import typing
import urllib.request
import zipfile

LIBRARY_DIR = os.path.join(os.path.dirname(__file__), "..", "Library")
CACHE_DIR = os.path.join("/tmp", "infinite-mac-cache")

input_path = sys.argv[1]
output_dir = sys.argv[2]
manifest_dir = sys.argv[3]

DISK_SIZE = 300 * 1024 * 1024
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
    import_folders = {}
    import_folders.update(import_manifests())
    import_folders.update(import_zips())
    return import_folders


def import_manifests() -> typing.Dict[str, machfs.Folder]:
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
    return import_folders


def import_zips() -> typing.Dict[str, machfs.Folder]:
    sys.stderr.write("Importing .zips\n")
    import_folders = {}

    for zip_path in glob.iglob(os.path.join(LIBRARY_DIR, "**", "*.zip")):
        folder_path, _ = os.path.splitext(
            os.path.relpath(zip_path, LIBRARY_DIR))
        sys.stderr.write("  Importing %s\n" % folder_path)

        folder = machfs.Folder()
        files_by_path = {}
        with zipfile.ZipFile(zip_path, "r") as zip:
            for zip_info in zip.infolist():
                if zip_info.is_dir():
                    continue
                file_data = zip.read(zip_info)
                if zip_info.filename == "DInfo":
                    folder.usrInfo = file_data[0:16]
                    folder.fndrInfo = file_data[16:]
                    continue
                path = zip_info.filename
                if ".rsrc/" in path:
                    path = path.replace(".rsrc/", "")
                    files_by_path.setdefault(path,
                                             machfs.File()).rsrc = file_data
                    continue
                if ".finf/" in path:
                    # May actually be the DInfo for a folder, check for that.
                    path = path.replace(".finf/", "")
                    try:
                        # Will throw if there isn't a corresponding directory,
                        # no need to actually do anything with the return value.
                        zip.getinfo(path + "/")
                        nested_folder_path, nested_folder_name = os.path.split(
                            path)
                        parent = traverse_folders(folder, nested_folder_path)
                        nested_folder = machfs.Folder()
                        (nested_folder.usrInfo,
                         nested_folder.fndrInfo) = struct.unpack(
                             '>16s16s', file_data)
                        parent[fix_name(nested_folder_name)] = nested_folder
                        continue
                    except KeyError:
                        pass
                    file = files_by_path.setdefault(path, machfs.File())
                    (file.type, file.creator, file.flags, file.x, file.y, _,
                     file.fndrInfo) = struct.unpack('>4s4sHhhH16s', file_data)
                    continue
                files_by_path.setdefault(path, machfs.File()).data = file_data

        for path, file in files_by_path.items():
            file_folder_path, file_name = os.path.split(path)
            parent = traverse_folders(folder, file_folder_path)

            parent[fix_name(file_name)] = file

        import_folders[folder_path] = folder

    return import_folders


def traverse_folders(parent: machfs.Folder, folder_path: str) -> machfs.Folder:
    if folder_path:
        folder_path_pieces = folder_path.split(os.path.sep)
        for folder_path_piece in folder_path_pieces:
            folder_path_piece = fix_name(folder_path_piece)
            if folder_path_piece not in parent:
                parent[folder_path_piece] = machfs.Folder()
            parent = parent[folder_path_piece]
    return parent


def fix_name(name: str) -> str:
    return name.replace(":", "/")


import_folders = get_import_folders()

with open(input_path, "rb") as input_file:
    v = machfs.Volume()
    v.read(input_file.read(), preserve_desktopdb=True)
    v.name = "Infinite HD"

    for folder_path, folder in import_folders.items():
        parent_folder_path, folder_name = os.path.split(folder_path)
        parent = traverse_folders(v["Library"], parent_folder_path)
        parent[folder_name] = folder

    flat = v.write(
        size=DISK_SIZE,
        align=512,
        desktopdb=False,
        bootable=True,
    )

    chunks = []
    chunk_signatures = set()
    salt = b'raw'
    for i in range(0, DISK_SIZE, CHUNK_SIZE):
        sys.stderr.write("Chunking %s: %.1f%%\r" %
                         (input_file_name,
                          ((i + CHUNK_SIZE) / DISK_SIZE) * 100))
        chunk = flat[i:i + CHUNK_SIZE]
        total_size += len(chunk)
        chunk_signature = hashlib.blake2b(chunk, digest_size=16,
                                          salt=salt).hexdigest()
        chunks.append(chunk_signature)
        if chunk_signature in chunk_signatures:
            continue
        chunk_signatures.add(chunk_signature)
        chunk_path = os.path.join(output_dir, f"{chunk_signature}.chunk")
        if os.path.exists(chunk_path):
            # An earlier run of this script (e.g. for a different base image)
            # may have already created this file.
            continue
        with open(chunk_path, "wb+") as chunk_file:
            chunk_file.write(chunk)

sys.stderr.write("\n")

manifest_path = os.path.join(manifest_dir, f"{input_file_name}.json")
with open(manifest_path, "w+") as manifest_file:
    json.dump(
        {
            "totalSize": total_size,
            "chunks": chunks,
            "chunkSize": CHUNK_SIZE,
        },
        manifest_file,
        indent=4)
