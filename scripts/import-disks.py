#!/usr/bin/env python3

import copy
import datetime
import glob
import hashlib
import json
import machfs
import machfs.main
import os
import shutil
import struct
import sys
import tempfile
import typing
import urllib.request
import zipfile
import subprocess
import stickies
import time
import unicodedata

ROOT_DIR = os.path.join(os.path.dirname(__file__), "..")
IMAGES_DIR = os.path.join(ROOT_DIR, "Images")
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
    debug_filter = os.getenv("DEBUG_LIRARY_FILTER")

    for manifest_path in glob.iglob(os.path.join(LIBRARY_DIR, "**", "*.json")):
        if debug_filter and debug_filter not in manifest_path:
            continue
        folder_path, _ = os.path.splitext(
            os.path.relpath(manifest_path, LIBRARY_DIR))
        sys.stderr.write("  Importing %s\n" % folder_path)
        with open(manifest_path, "r") as manifest:
            manifest_json = json.load(manifest)
        src_url = manifest_json["src_url"]
        _, src_ext = os.path.splitext(src_url)
        if src_ext in [".img", ".dsk", ".iso"]:
            folder = import_disk_image(manifest_json)
        elif src_ext in [".hqx", ".sit", ".bin", ".zip"]:
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

    file.type = convert_os_type(entry["XADFileType"])
    file.creator = convert_os_type(entry["XADFileCreator"])

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
    debug_filter = os.getenv("DEBUG_LIRARY_FILTER")

    for zip_path in glob.iglob(os.path.join(LIBRARY_DIR, "**", "*.zip")):
        if debug_filter and debug_filter not in zip_path:
            continue
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


class ImageDef(typing.NamedTuple):
    name: str
    path: str


def write_image_def(image: bytes, name: str, dest_dir: str) -> ImageDef:
    image_path = os.path.join(dest_dir, name)
    with open(image_path, "wb") as image_file:
        image_file.write(image)
    return ImageDef(name, image_path)


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

    manifest_path = os.path.join(DATA_DIR, f"{image.name}.json")
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
        name: str,
        dest_dir: str,
        domain: str,
        stickies_path: typing.List[str] = [
            "System Folder", "Preferences", "Stickies file"
        ],
        stickies_encoding: str = "mac_roman",
        welcome_sticky_override: stickies.Sticky = None) -> ImageDef:
    debug_filter = os.getenv("DEBUG_SYSTEM_FILTER")
    if debug_filter and debug_filter not in name:
        return None

    sys.stderr.write("Building system image %s\n" % (name, ))
    input_path = os.path.join(IMAGES_DIR, name)

    sister_sites = [
        f"https://{s}"
        for s in ["system7.app", "macos8.app", "kanjitalk7.app"] if s != domain
    ]
    with open(input_path, "rb") as image:
        v = machfs.Volume()
        input_data = image.read()
        image_size = len(input_data)
        v.read(input_data)
        stickies_file = v
        for p in stickies_path:
            stickies_file = stickies_file[p]
        customized_stickies = copy.deepcopy(STICKIES)
        with open("CHANGELOG.md", "r") as changelog_file:
            changelog = changelog_file.read()
        if welcome_sticky_override:
            customized_stickies[-1] = copy.deepcopy(welcome_sticky_override)
        for sticky in customized_stickies:
            sticky.text = sticky.text.replace("CHANGELOG", changelog)
            sticky.text = sticky.text.replace("DOMAIN", domain)
            sticky.text = sticky.text.replace(
                "SISTER_SITES",
                f"{', '.join(sister_sites[:-1])} and {sister_sites[-1]}")
            if stickies_encoding == "shift_jis":
                # Bullets are not directly representable in Shift-JIS, replace
                # them with a KATAKANA MIDDLE DOT.
                sticky.text = sticky.text.replace("•", "・")
        stickies_file.data = stickies.StickiesFile(
            stickies=customized_stickies).to_bytes(stickies_encoding)
        image = v.write(
            size=image_size,
            align=512,
            desktopdb=debug_filter is not None,
            bootable=True,
        )

        return write_image_def(image, name, dest_dir)


def build_library_image(base_name: str, dest_dir: str) -> ImageDef:
    import_folders = get_import_folders()

    v = machfs.Volume()
    with open(os.path.join(IMAGES_DIR, base_name), "rb") as base:
        v.read(base.read())
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
        size=900 * 1024 * 1024,
        align=512,
        desktopdb=False,
        bootable=False,
    )

    return write_image_def(image, base_name, dest_dir)


def build_desktop_db(images: typing.List[ImageDef]) -> bytes:
    sys.stderr.write("Rebuilding Desktop DB for %s...\n" %
                     ",".join([i.name for i in images]))
    boot_disk_path = os.path.join(IMAGES_DIR, "Mac OS 8.1 HD.dsk")
    rom_path = os.path.join(DATA_DIR, "Quadra-650.rom")
    basilisk_ii_args = [("--config", "none"), ("--disk", f"*{boot_disk_path}")
                        ] + [("--disk", i.path) for i in images] + [
                            ("--extfs", "none"),
                            ("--rom", rom_path),
                            ("--screen", "win/800/600"),
                            ("--ramsize", "16777216"),
                            ("--frameskip", "0"),
                            ("--modelid", "14"),
                            ("--cpu", "4"),
                            ("--fpu", "true"),
                            ("--nocdrom", "true"),
                            ("--nosound", "true"),
                            ("--noclipconversion", "true"),
                            ("--idlewait", "true"),
                        ]
    subprocess.check_call([
        "open",
        "-a",
        "BasiliskII",
        "-W",
        "--args",
    ] + [a for arg in basilisk_ii_args for a in arg])


STICKIES = [
    stickies.Sticky(
        top=196,
        left=612,
        bottom=312,
        right=794,
        color=stickies.Color.GRAY,
        text="CHANGELOG",
    ),
    stickies.Sticky(
        top=300,
        left=444,
        bottom=525,
        right=638,
        color=stickies.Color.PURPLE,
        text="""Tips
• To add additional files (e.g. downloads from archives like Macintosh Repository and Macintosh Garden), simply drag them onto the screen. They will appear in the “Downloads” folder in The Outside World.
• Conversely, to get folders or files out the Mac, you put them in the “Uploads” folder. A .zip archive with them will be generated and downloaded by your browser.
• Files in the “Saved” folder will be saved across emulator runs (best-effort)
• To go full screen, you can use the command that appears next to the monitor's Apple logo.
• Additional settings can be toggled by using the “Settings” command, also next to the monitor's Apple logo.
• If you're on an iOS device, you can add this site to your home screen via the share icon.""",
    ),
    stickies.Sticky(
        top=315,
        left=638,
        bottom=500,
        right=794,
        color=stickies.Color.PINK,
        text="""Networking is supported!

Visting the same subdomain of the site as your friends (e.g. https://office.DOMAIN or https://thelair.DOMAIN) will automatically create an AppleTalk zone where you can interact with each other.

Files can be shared between instances, and muti-player games like Marathon, Bolo and Strategic Conquest will also work.""",
    ),
    stickies.Sticky(
        top=531,
        left=484,
        bottom=570,
        right=700,
        color=stickies.Color.BLUE,
        text='See also the sister sites at SISTER_SITES',
    ),
    stickies.Sticky(
        top=187,
        left=438,
        bottom=299,
        right=614,
        color=stickies.Color.GREEN,
        text=
        """A project to have an easily browsable collection of classic Macintosh software from the comfort of a (modern) web browser.

Browse around the Infinite HD to see what using a Mac in the mid 1990s was like.""",
    ),
    stickies.Sticky(
        top=135,
        left=468,
        bottom=183,
        right=655,
        font=stickies.Font.HELVETICA,
        size=18,
        style={stickies.Style.BOLD},
        text='Welcome to Infinite Macintosh!',
    ),
]

JAPANESE_WELCOME_STICKY = stickies.Sticky(
    top=125,
    left=468,
    bottom=180,
    right=660,
    font=stickies.Font.OSAKA,
    size=18,
    style={stickies.Style.BOLD},
    text="Infinite Macintosh へようこそ！",
)

if __name__ == "__main__":
    shutil.rmtree(DISK_DIR, ignore_errors=True)
    os.mkdir(DISK_DIR)
    with tempfile.TemporaryDirectory() as temp_dir:
        images = []
        if not os.getenv("DEBUG_LIRARY_FILTER"):
            images.append(
                build_system_image("System 7.5.3 HD.dsk",
                                   dest_dir=temp_dir,
                                   domain="system7.app"))
            images.append(
                build_system_image("System 7.5.3 (PPC) HD.dsk",
                                   dest_dir=temp_dir,
                                   domain="system7.app"))
            images.append(
                build_system_image("Mac OS 8.1 HD.dsk",
                                   dest_dir=temp_dir,
                                   domain="macos8.app"))
            images.append(
                build_system_image(
                    "KanjiTalk 7.5.3 HD.dsk",
                    dest_dir=temp_dir,
                    domain="kanjitalk7.app",
                    # Generate Mojibake of Shift-JIS interpreted as MacRoman, the machfs
                    # library always assumes the latter.
                    stickies_path=[
                        p.encode("shift_jis").decode("mac_roman") for p in [
                            "システムフォルダ",
                            "初期設定",
                            'スティッキーズファイル',
                        ]
                    ],
                    stickies_encoding="shift_jis",
                    welcome_sticky_override=JAPANESE_WELCOME_STICKY)),
            images.append(
                build_system_image("Mac OS 9.0.4 HD.dsk",
                                   dest_dir=temp_dir,
                                   domain="macos9.app"))
        if not os.getenv("DEBUG_SYSTEM_FILTER"):
            images.append(
                build_library_image("Infinite HD.dsk", dest_dir=temp_dir))
        images = [i for i in images if i]

        if not os.getenv("DEBUG_LIRARY_FILTER") and not os.getenv(
                "DEBUG_SYSTEM_FILTER"):
            build_desktop_db(images)
        for image in images:
            write_chunked_image(image)
