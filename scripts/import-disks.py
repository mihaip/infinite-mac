#!/usr/bin/env python3

import copy
import basilisk
import datetime
import disks
import glob
import hashlib
import json
import logging
import machfs
import machfs.main
import minivmac
import os
import paths
import shutil
import struct
import sys
import tempfile
import typing
import zipfile
import subprocess
import stickies
import time
import unicodedata
import urls

CHUNK_SIZE = 256 * 1024

ImportFolders = typing.Tuple[
    typing.Dict[str, machfs.Folder], # Universal folders
    typing.Dict[str, machfs.Folder], # Folders that need System 7
]

def get_import_folders() -> ImportFolders:
    import_folders = {}
    import_folders7 = {}

    manifest_folders, manifest_folders7 = import_manifests()
    import_folders.update(manifest_folders)
    import_folders7.update(manifest_folders7)

    zip_folders, zip_folder7 = import_zips()
    import_folders.update(zip_folders)
    import_folders7.update(zip_folder7)

    return import_folders, import_folders7


def import_manifests() -> ImportFolders:
    sys.stderr.write("Importing other images\n")
    import_folders = {}
    import_folders7 = {}
    debug_filter = os.getenv("DEBUG_LIBRARY_FILTER")

    for manifest_path in glob.iglob(os.path.join(paths.LIBRARY_DIR, "**",
                                                 "*.json"),
                                    recursive=True):
        if debug_filter and debug_filter not in manifest_path:
            continue
        folder_path, _ = os.path.splitext(
            os.path.relpath(manifest_path, paths.LIBRARY_DIR))
        sys.stderr.write("  Importing %s\n" % folder_path)
        with open(manifest_path, "r") as manifest:
            manifest_json = json.load(manifest)
        src_url = manifest_json["src_url"]
        src_ext = manifest_json.get("src_ext")
        if not src_ext:
            _, src_ext = os.path.splitext(src_url.lower())

        if src_ext in [".img", ".dsk", ".iso"]:
            folder = import_disk_image(manifest_json)
        elif src_ext in [".hqx", ".sit", ".bin", ".zip"]:
            if not os.path.exists(paths.LSAR_PATH):
                sys.stderr.write("    Skipping archive import, lsar not found "
                                 "(build it with npm run build-xadmaster)\n")
                continue
            folder = import_archive(manifest_json)
        else:
            assert False, "Unexpected manifest URL extension: %s" % src_ext

        if manifest_json.get("needs_system_7"):
            import_folders7[folder_path] = folder
        else:
            import_folders[folder_path] = folder

    return import_folders, import_folders7


def import_disk_image(
        manifest_json: typing.Dict[str, typing.Any]) -> machfs.Folder:
    return import_disk_image_data(urls.read_url(manifest_json["src_url"]),
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
    archive_path = urls.read_url_to_path(src_url)
    root_folder = machfs.Folder()
    with tempfile.TemporaryDirectory() as tmp_dir_path:
        unar_code = subprocess.call([
            paths.UNAR_PATH, "-no-directory", "-output-directory",
            tmp_dir_path, archive_path
        ],
                                    stdout=subprocess.DEVNULL)
        if unar_code != 0:
            assert False, "Could not unpack archive: %s (cached at %s):" % (
                src_url, archive_path)

        # While unar does set some Finder metadata, it appears to be a lossy
        # process (e.g. locations are not preserved). Get the full parsed
        # information for each file in the archive from lsar and use that to
        # populate the HFS file and folder metadata.
        lsar_output = subprocess.check_output(
            [paths.LSAR_PATH, "-json", archive_path])
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
            try:
                with open(
                        os.path.join(tmp_dir_path, manifest_json["src_image"]),
                        "rb") as f:
                    return import_disk_image_data(f.read(), manifest_json)
            except FileNotFoundError:
                sys.stderr.write("Directory contents:\n")
                for f in os.listdir(tmp_dir_path):
                    sys.stderr.write("  %s\n" % f)
                raise

        if "src_images" in manifest_json:
            folder = machfs.Folder()
            for src_image in manifest_json["src_images"]:
                try:
                    with open(os.path.join(tmp_dir_path, src_image),
                              "rb") as f:
                        image_folder = import_disk_image_data(
                            f.read(), manifest_json)
                        folder[src_image] = image_folder
                except FileNotFoundError:
                    sys.stderr.write("Directory contents:\n")
                    for f in os.listdir(tmp_dir_path):
                        sys.stderr.write("  %s\n" % f)
                    raise
            return folder

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
                # not exist in the Classic Mac days.
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

    if "XADFileType" in entry:
        file.type = convert_os_type(entry["XADFileType"])
        file.creator = convert_os_type(entry["XADFileCreator"])

    if "XADFinderFlags" in entry:
        file.flags = entry["XADFinderFlags"]
    if "XADFinderLocationX" in entry:
        file.x = entry["XADFinderLocationX"]
        file.y = entry["XADFinderLocationY"]
    else:
        file.flags &= ~machfs.main.FinderFlags.kHasBeenInited
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
        flags &= ~machfs.main.FinderFlags.kHasBeenInited
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
        t = int(max(min(time.time(), parsed.timestamp()), 0))
        # 2082844800 is the number of seconds between the Mac epoch (January 1 1904)
        # and the Unix epoch (January 1 1970). See
        # http://justsolve.archiveteam.org/wiki/HFS/HFS%2B_timestamp
        return t + 2082844800

    if "XADLastModificationDate" in entry:
        file_or_folder.mddate = convert_date(entry["XADLastModificationDate"])

    if "XADCreationDate" in entry:
        file_or_folder.crdate = convert_date(entry["XADCreationDate"])


SYSTEM7_ZIP_PATHS = {
    "Games/Bungie/Marathon Infinity",
    "Graphics/Adobe Photoshop 3.0",
    "Graphics/Canvas 3.5",
    "Graphics/Infini-D",
}

def import_zips() -> ImportFolders:
    sys.stderr.write("Importing .zips\n")
    import_folders = {}
    import_folders7 = {}
    debug_filter = os.getenv("DEBUG_LIBRARY_FILTER")

    for zip_path in glob.iglob(os.path.join(paths.LIBRARY_DIR, "**", "*.zip"),
                               recursive=True):
        if debug_filter and debug_filter not in zip_path:
            continue
        folder_path, _ = os.path.splitext(
            os.path.relpath(zip_path, paths.LIBRARY_DIR))
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

        if folder_path in SYSTEM7_ZIP_PATHS:
            import_folders7[folder_path] = folder
        else:
            import_folders[folder_path] = folder

    return import_folders, import_folders7


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
    return unicodedata.normalize("NFC", name.replace(":", "/"))


def clear_folder_window_position(folder: machfs.Folder) -> None:
    # Clear x/y position so that the Finder computes a layout for us.
    (rect_top, rect_left, rect_bottom, rect_right, flags, window_y, window_x,
     view) = struct.unpack(">hhhhHhhH", folder.usrInfo)
    window_x = -1
    window_y = -1
    folder.usrInfo = struct.pack(">hhhhHhhH", rect_top, rect_left, rect_bottom,
                                 rect_right, flags, window_y, window_x, view)


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

    sys.stderr.write("\n")

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

    stickies_placeholder = stickies.generate_placeholder()
    with open(input_path, "rb") as image:
        image_data = image.read()

    stickies_index = image_data.find(stickies_placeholder)
    use_ttxt = False
    if stickies_index == -1:
        use_ttxt = True
        stickies_placeholder = stickies.generate_ttxt_placeholder()
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


def build_library_images(dest_dir: str) -> typing.Tuple[ImageDef, ImageDef]:
    import_folders, import_folders7 = get_import_folders()

    v = machfs.Volume()
    with open(os.path.join(paths.IMAGES_DIR, "Infinite HD.dsk"), "rb") as base:
        v.read(base.read())
    v.name = "Infinite HD"

    def add_folders(folders: typing.Dict[str, machfs.Folder]) -> None:
        for folder_path, folder in folders.items():
            parent_folder_path, folder_name = os.path.split(folder_path)
            parent = traverse_folders(v, parent_folder_path)
            folder_name = fix_name(folder_name)
            if folder_name in parent:
                sys.stderr.write(
                    "  Skipping %s, already installed in the image\n" %
                    folder_path)
                continue
            parent[folder_name] = folder
    add_folders(import_folders)

    image6 = v.write(
        size=1000 * 1024 * 1024,
        align=512,
        desktopdb=False,
        bootable=False,
    )
    image6_def = write_image_def(image6, "Infinite HD6.dsk", dest_dir)

    add_folders(import_folders7)
    image = v.write(
        size=2000 * 1024 * 1024,
        align=512,
        desktopdb=False,
        bootable=False,
    )
    image_def = write_image_def(image, "Infinite HD.dsk", dest_dir)

    return image6_def, image_def


def build_passthrough_image(base_name: str, dest_dir: str) -> ImageDef:
    with open(os.path.join(paths.IMAGES_DIR, base_name), "rb") as base:
        image_data = base.read()
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
            infinite_hd6_image, infinite_hd_image = build_library_images(temp_dir)
            images.append(infinite_hd6_image)
            images.append(infinite_hd_image)
            if not library_filter:
                build_desktop_db6([infinite_hd6_image])
                build_desktop_db([infinite_hd_image])

            images.append(
                build_passthrough_image("Infinite HD (MFS).dsk",
                                        dest_dir=temp_dir))
        images.append(build_saved_hd_image("Saved HD.dsk", dest_dir=temp_dir))

        for image in images:
            write_chunked_image(image)
