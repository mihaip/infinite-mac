#!/usr/local/bin/python3

import datetime
import glob
import hashlib
import json
import machfs
import os
import shutil
import struct
import sys
import tempfile
import typing
import urllib.request
import zipfile
import subprocess
import time
import unicodedata

ROOT_DIR = os.path.join(os.path.dirname(__file__), "..")
BASILISK_II_DIR = os.path.join(ROOT_DIR, "macemu", "BasiliskII", "src", "Unix")
LIBRARY_DIR = os.path.join(ROOT_DIR, "Library")
DISK_DIR = os.path.join(ROOT_DIR, "public", "Disk")
DATA_DIR = os.path.join(ROOT_DIR, "src", "Data")
CACHE_DIR = os.path.join("/tmp", "infinite-mac-cache")
XADMASTER_PATH = os.path.join(ROOT_DIR, "XADMaster-build", "Release")
UNAR_PATH = os.path.join(XADMASTER_PATH, "unar")
LSAR_PATH = os.path.join(XADMASTER_PATH, "lsar")

CHUNK_SIZE = 256 * 1024


def read_url(url: str) -> bytes:
    cache_path = read_url_to_path(url)
    return open(cache_path, "rb").read()


def read_url_to_path(url: str) -> str:
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)
    cache_key = hashlib.sha256(url.encode()).hexdigest()
    cache_path = os.path.join(CACHE_DIR, cache_key)
    if not os.path.exists(cache_path):
        response = urllib.request.urlopen(url)
        response_body = response.read()
        with open(cache_path, "wb+") as f:
            f.write(response_body)
    return cache_path


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
        src_url = manifest_json["src_url"]
        _, src_ext = os.path.splitext(src_url)
        if src_ext in [".img", ".dsk", ".iso"]:
            folder = import_disk_image(manifest_json)
        elif src_ext in [".hqx", ".sit", ".bin"]:
            folder = import_archive(manifest_json)
        else:
            assert False, "Unexpected manifest URL extension: %s" % src_ext

        import_folders[folder_path] = folder
    return import_folders


def import_disk_image(
        manifest_json: typing.Dict[str, typing.Any]) -> machfs.Folder:
    return import_disk_image_data(read_url(manifest_json["src_url"]),
                                  manifest_json)


def import_disk_image_data(
        data: bytes, manifest_json: typing.Dict[str,
                                                typing.Any]) -> machfs.Folder:
    v = machfs.Volume()
    v.read(data)
    if "src_folder" in manifest_json:
        folder = v[manifest_json["src_folder"]]
        clear_folder_window_position(folder)
    elif "src_denylist" in manifest_json:
        denylist = manifest_json["src_denylist"]
        folder = machfs.Folder()
        for name, item in v.items():
            if name not in denylist:
                folder[name] = item
    else:
        folder = machfs.Folder()
        for name, item in v.items():
            folder[name] = item
    return folder


def import_archive(
        manifest_json: typing.Dict[str, typing.Any]) -> machfs.Folder:
    def normalize(name: str) -> str:
        # Replaces : with /, to undo the escaping that unar does for path
        # separators.
        # Normalizes accented characters to their combined form, since only
        # those have an equivalent in the MacRoman encoding that HFS ends up
        # using.
        return unicodedata.normalize("NFC", name.replace(":", "/"))

    src_url = manifest_json["src_url"]
    archive_path = read_url_to_path(src_url)
    root_folder = machfs.Folder()
    with tempfile.TemporaryDirectory() as tmp_dir_path:
        unar_code = subprocess.call([
            UNAR_PATH, "-no-directory", "-output-directory", tmp_dir_path,
            archive_path
        ],
                                    stdout=subprocess.DEVNULL)
        if unar_code != 0:
            assert False, "Could not unpack archive: %s:" % src_url

        # While unar does set some Finder metadata, it appears to be a lossy
        # process (e.g. locations are not preserved). Get the full parsed
        # information for each file in the archive from lsar and use that to
        # populate the HFS file and folder metadata.
        lsar_output = subprocess.check_output(
            [LSAR_PATH, "-json", archive_path])
        lsar_json = json.loads(lsar_output)
        lsar_entries_by_path = {}
        for entry in lsar_json["lsarContents"]:
            lsar_entries_by_path[entry["XADFileName"]] = entry

        def get_lsar_entry(
                path: str) -> typing.Optional[typing.Dict[str, typing.Any]]:
            rel_path = os.path.relpath(path, tmp_dir_path)
            if rel_path not in lsar_entries_by_path:
                rel_path = normalize(rel_path)
            if rel_path not in lsar_entries_by_path:
                sys.stderr.write(
                    "Could not find lsar entry for %s, all entries:\n%s\n" %
                    (rel_path, "\n".join(lsar_entries_by_path.keys())))
            return lsar_entries_by_path[rel_path]

        # Most archives are of a folder, detect that and add the folder
        # directly, preserving its Finder metadata.
        root_dir_path = None
        tmp_dir_contents = os.listdir(tmp_dir_path)
        if len(tmp_dir_contents) == 1:
            single_item_path = os.path.join(tmp_dir_path, tmp_dir_contents[0])
            if os.path.isdir(single_item_path):
                root_dir_path = single_item_path
                update_folder_from_lsar_entry(root_folder,
                                              get_lsar_entry(root_dir_path))
                clear_folder_window_position(root_folder)

        if "src_image" in manifest_json:
            with open(os.path.join(tmp_dir_path, manifest_json["src_image"]),
                      "rb") as f:
                return import_disk_image_data(f.read(), manifest_json)

        if root_dir_path is None:
            root_dir_path = tmp_dir_path

        if "src_folder" in manifest_json:
            src_folder_name = manifest_json["src_folder"]
            root_dir_path = os.path.join(root_dir_path, src_folder_name)
            update_folder_from_lsar_entry(root_folder,
                                          get_lsar_entry(root_dir_path))
            clear_folder_window_position(root_folder)

        for dir_path, dir_names, file_names in os.walk(root_dir_path):
            # Ignore Spotlight disabling directory that appears in some archives
            # and/or when running on modern Mac OS.
            if ".FBCLockFolder" in dir_names:
                dir_names.remove(".FBCLockFolder")
            folder = root_folder
            dir_rel_path = os.path.relpath(dir_path, root_dir_path)
            if dir_rel_path != ".":
                folder_path_pieces = []
                for folder_name in dir_rel_path.split(os.path.sep):
                    folder_path_pieces.append(folder_name)
                    folder_name = normalize(folder_name)
                    if folder_name not in folder:
                        new_folder = folder[folder_name] = machfs.Folder()
                        update_folder_from_lsar_entry(
                            new_folder,
                            get_lsar_entry(
                                os.path.join(root_dir_path,
                                             *folder_path_pieces)))
                    folder = folder[folder_name]
            for file_name in file_names:
                # Ignore hidden files used for extra metadata storage that did
                # not exit in the Classic Mac days.
                if file_name in [".DS_Store"]:
                    continue
                file_path = os.path.join(dir_path, file_name)
                file = machfs.File()
                with open(file_path, "rb") as f:
                    file.data = f.read()
                resource_fork_path = os.path.join(file_path, "..namedfork",
                                                  "rsrc")
                if os.path.exists(resource_fork_path):
                    with open(resource_fork_path, "rb") as f:
                        file.rsrc = f.read()

                update_file_from_lsar_entry(file, get_lsar_entry(file_path))

                folder[normalize(file_name)] = file
    return root_folder


def update_file_from_lsar_entry(file: machfs.File,
                                entry: typing.Dict[str, typing.Any]) -> None:
    update_file_or_folder_from_lsar_entry(file, entry)

    def convert_os_type(os_type: int) -> bytes:
        return os_type.to_bytes(4, byteorder="big")

    file.type = convert_os_type(entry["XADFileType"])
    file.creator = convert_os_type(entry["XADFileCreator"])

    file.flags = entry["XADFinderFlags"]
    if "XADFinderLocationX" in entry:
        file.x = entry["XADFinderLocationX"]
        file.y = entry["XADFinderLocationY"]
    else:
        file.x = file.y = 0


def update_folder_from_lsar_entry(folder: machfs.Folder,
                                  entry: typing.Dict[str, typing.Any]) -> None:
    update_file_or_folder_from_lsar_entry(folder, entry)

    flags = entry.get("XADFinderFlags", 0)
    if "XADFinderWindowTop" in entry:
        rect_top = entry["XADFinderWindowTop"]
        rect_left = entry["XADFinderWindowLeft"]
        rect_bottom = entry["XADFinderWindowBottom"]
        rect_right = entry["XADFinderWindowRight"]
    else:
        rect_top = rect_left = rect_bottom = rect_right = 0
    if "XADFinderLocationX" in entry:
        window_x = entry["XADFinderLocationX"]
        window_y = entry["XADFinderLocationY"]
    else:
        window_x = window_y = 0

    # 0x127 appears to be the default icon view
    view = entry.get("XADFinderWindowView", 0x127)
    folder.usrInfo = struct.pack(">hhhhHhhH", rect_top, rect_left, rect_bottom,
                                 rect_right, flags, window_y, window_x, view)


def update_file_or_folder_from_lsar_entry(
        file_or_folder: typing.Union[machfs.File, machfs.Folder],
        entry: typing.Dict[str, typing.Any]) -> None:
    def convert_date(date_str: str) -> int:
        # Dates produced by lsar/XADMaster are not quite ISO 8601 compliant in
        # the way they represent timezones.
        date_str = date_str.replace(" +0000", " +00:00")
        parsed = datetime.datetime.fromisoformat(date_str)
        t = int(min(time.time(), parsed.timestamp()))
        # 2082844800 is the number of seconds between the Mac epoch (January 1 1904)
        # and the Unix epoch (January 1 1970). See
        # http://justsolve.archiveteam.org/wiki/HFS/HFS%2B_timestamp
        return t + 2082844800

    if "XADLastModificationDate" in entry:
        file_or_folder.mddate = convert_date(entry["XADLastModificationDate"])

    if "XADCreationDate" in entry:
        file_or_folder.crdate = convert_date(entry["XADCreationDate"])


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
                    (file.type, file.creator, file.flags, file.y, file.x, _,
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


def clear_folder_window_position(folder: machfs.Folder) -> None:
    # Clear x/y position so that the Finder computes a layout for us.
    (rect_top, rect_left, rect_bottom, rect_right, flags, window_y, window_x,
     view) = struct.unpack(">hhhhHhhH", folder.usrInfo)
    window_x = -1
    window_y = -1
    folder.usrInfo = struct.pack(">hhhhHhhH", rect_top, rect_left, rect_bottom,
                                 rect_right, flags, window_y, window_x, view)


def write_chunked_image(image: bytes, input_file_name: str) -> None:
    total_size = 0
    chunks = []
    chunk_signatures = set()
    salt = b'raw'
    disk_size = len(image)
    for i in range(0, disk_size, CHUNK_SIZE):
        sys.stderr.write("Chunking %s: %.1f%%\r" %
                         (input_file_name,
                          ((i + CHUNK_SIZE) / disk_size) * 100))
        chunk = image[i:i + CHUNK_SIZE]
        total_size += len(chunk)
        chunk_signature = hashlib.blake2b(chunk, digest_size=16,
                                          salt=salt).hexdigest()
        chunks.append(chunk_signature)
        if chunk_signature in chunk_signatures:
            continue
        chunk_signatures.add(chunk_signature)
        chunk_path = os.path.join(DISK_DIR, f"{chunk_signature}.chunk")
        if os.path.exists(chunk_path):
            # An earlier run of this script (e.g. for a different base image)
            # may have already created this file.
            continue
        with open(chunk_path, "wb+") as chunk_file:
            chunk_file.write(chunk)

    sys.stderr.write("\n")

    manifest_path = os.path.join(DATA_DIR, f"{input_file_name}.json")
    with open(manifest_path, "w+") as manifest_file:
        json.dump(
            {
                "name": os.path.splitext(input_file_name)[0],
                "totalSize": total_size,
                "chunks": chunks,
                "chunkSize": CHUNK_SIZE,
            },
            manifest_file,
            indent=4)


def copy_system_image(name: str) -> None:
    input_path = os.path.join(BASILISK_II_DIR, name)
    with open(input_path, "rb") as image:
        write_chunked_image(image.read(), name)


def build_library_image(base_name: str) -> None:
    import_folders = get_import_folders()

    v = machfs.Volume()
    with open(os.path.join(BASILISK_II_DIR, base_name), "rb") as base:
        v.read(base.read(), preserve_desktopdb=True)
    v.name = "Infinite HD"

    for folder_path, folder in import_folders.items():
        parent_folder_path, folder_name = os.path.split(folder_path)
        parent = traverse_folders(v, parent_folder_path)
        if folder_name in parent:
            sys.stderr.write(
                "  Skipping %s, already installed in the image\n" %
                folder_path)
            continue
        parent[folder_name] = folder

    image = v.write(
        size=1024 * 1024 * 1024,
        align=512,
        desktopdb=False,
        bootable=False,
    )
    write_chunked_image(image, base_name)


if __name__ == "__main__":
    shutil.rmtree(DISK_DIR, ignore_errors=False)
    os.mkdir(DISK_DIR)
    copy_system_image("System 7.5.3 HD.dsk")
    copy_system_image("KanjiTalk 7.5.3 HD.dsk")
    copy_system_image("Mac OS 8.1 HD.dsk")
    build_library_image("Infinite HD.dsk")
