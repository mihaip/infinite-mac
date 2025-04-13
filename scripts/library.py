import copy
import datetime
import glob
import json
import machfs
import machfs.main
import os
import paths
import struct
import subprocess
import sys
import tempfile
import time
import typing
import unicodedata
import urls
import xattr
import zipfile

ImportFolders = typing.Tuple[
    typing.Dict[str, machfs.Folder],  # Universal folders
    typing.Dict[str, machfs.Folder],  # Folders that need System 7
    typing.Dict[str, machfs.Folder],  # Folders that need Mac OS X
]


def get_import_folders() -> ImportFolders:
    import_folders = {}
    import_folders7 = {}
    import_foldersX = {}

    manifest_folders, manifest_folders7, manifest_foldersX = import_manifests()
    import_folders.update(manifest_folders)
    import_folders7.update(manifest_folders7)
    import_foldersX.update(manifest_foldersX)

    zip_folders, zip_folders7, zip_foldersX = import_zips()
    import_folders.update(zip_folders)
    import_folders7.update(zip_folders7)
    import_foldersX.update(zip_foldersX)

    return import_folders, import_folders7, import_foldersX


def import_manifests() -> ImportFolders:
    sys.stderr.write("Importing other images\n")
    import_folders = {}
    import_folders7 = {}
    import_foldersX = {}
    debug_filter = os.getenv("DEBUG_LIBRARY_FILTER")

    for manifest_path in glob.iglob(
        os.path.join(paths.LIBRARY_DIR, "**", "*.json"), recursive=True
    ):
        if debug_filter and debug_filter != "X" and debug_filter not in manifest_path:
            continue
        folder_path, _ = os.path.splitext(
            os.path.relpath(manifest_path, paths.LIBRARY_DIR)
        )
        with open(manifest_path, "r") as manifest:
            manifest_json = json.load(manifest)
        if debug_filter == "X" and not manifest_json.get("needs_mac_os_x"):
            continue

        sys.stderr.write("  Importing %s\n" % folder_path)
        src_url = manifest_json["src_url"]
        src_ext = manifest_json.get("src_ext")
        if not src_ext:
            _, src_ext = os.path.splitext(src_url.lower())

        if src_ext in [".img", ".dsk", ".iso"]:
            folder = import_disk_image(manifest_json)
        elif src_ext in [".dmg"] or manifest_json.get("force_dmg"):
            if not os.path.exists(paths.HDIUTIL_PATH):
                sys.stderr.write("    Skipping .dmg import, hdiutil not found\n")
                continue
            if manifest_json.get("needs_dmg2img") and not os.path.exists(
                paths.DMG2IMG_PATH
            ):
                sys.stderr.write("    Skipping .dmg import, dmg2img not found\n")
                continue
            folder = import_dmg(manifest_json)
        elif src_ext in [".hqx", ".sit", ".bin", ".zip", ".gz", ".tgz", ".bz2"]:
            if not os.path.exists(paths.LSAR_PATH):
                sys.stderr.write(
                    "    Skipping archive import, lsar not found "
                    "(build it with npm run build-tools)\n"
                )
                continue
            folder = import_archive(manifest_json)
        else:
            assert False, "Unexpected manifest URL extension: %s" % src_ext

        if manifest_json.get("carbonized"):
            import_foldersX[folder_path] = folder
            import_folders7[folder_path] = folder
        elif manifest_json.get("needs_mac_os_x"):
            import_foldersX[folder_path] = folder
        elif manifest_json.get("needs_system_7"):
            import_folders7[folder_path] = folder
        else:
            import_folders[folder_path] = folder

    return import_folders, import_folders7, import_foldersX


def import_disk_image(manifest_json: typing.Dict[str, typing.Any]) -> machfs.Folder:
    return import_disk_image_data(
        urls.read_url_to_path(manifest_json["src_url"]), manifest_json
    )


def import_disk_image_data(
    image_path: str, manifest_json: typing.Dict[str, typing.Any]
) -> machfs.Folder:
    v = machfs.Volume()
    with open(image_path, "rb") as f:
        v.read(f.read())

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


def import_archive(manifest_json: typing.Dict[str, typing.Any]) -> machfs.Folder:

    def normalize(name: str) -> str:
        # Replaces : with /, to undo the escaping that unar does for path
        # separators.
        # Normalizes accented characters to their combined form, since only
        # those have an equivalent in the MacRoman encoding that HFS ends up
        # using.
        name = unicodedata.normalize("NFC", name.replace(":", "/"))
        # Avoid file names longer than 31 characters in HFS.
        pieces = name.split("/")
        if len(pieces[-1]) > 31:
            pieces[-1] = pieces[-1][:31]
            name = "/".join(pieces)
        return name

    src_url = manifest_json["src_url"]
    archive_path = urls.read_url_to_path(src_url)
    root_folder = machfs.Folder()
    with tempfile.TemporaryDirectory() as tmp_dir_path:
        unar_code = subprocess.call(
            [
                paths.UNAR_PATH,
                "-no-directory",
                "-output-directory",
                tmp_dir_path,
                archive_path,
            ],
            stdout=subprocess.DEVNULL,
        )
        if unar_code != 0:
            assert False, "Could not unpack archive: %s (cached at %s):" % (
                src_url,
                archive_path,
            )

        # While unar does set some Finder metadata, it appears to be a lossy
        # process (e.g. locations are not preserved). Get the full parsed
        # information for each file in the archive from lsar and use that to
        # populate the HFS file and folder metadata.
        lsar_output = subprocess.check_output([paths.LSAR_PATH, "-json", archive_path])
        lsar_json = json.loads(lsar_output)
        lsar_entries_by_path = {}
        for entry in lsar_json["lsarContents"]:
            lsar_entries_by_path[entry["XADFileName"]] = entry

        def get_lsar_entry(path: str) -> typing.Optional[typing.Dict[str, typing.Any]]:
            rel_path = os.path.relpath(path, tmp_dir_path)
            if rel_path not in lsar_entries_by_path:
                rel_path = normalize(rel_path)
            if rel_path not in lsar_entries_by_path:
                sys.stderr.write(
                    "Could not find lsar entry for %s, all entries:\n%s\n"
                    % (rel_path, "\n".join(lsar_entries_by_path.keys()))
                )
            return lsar_entries_by_path[rel_path]

        # Most archives are of a folder, detect that and add the folder
        # directly, preserving its Finder metadata.
        root_dir_path = None
        tmp_dir_contents = os.listdir(tmp_dir_path)
        if len(tmp_dir_contents) == 1:
            single_item_path = os.path.join(tmp_dir_path, tmp_dir_contents[0])
            # Don't unpack .app bundles, we still want the containing folder.
            if os.path.isdir(single_item_path) and not single_item_path.endswith(
                ".app"
            ):
                root_dir_path = single_item_path
                update_folder_from_lsar_entry(
                    root_folder, get_lsar_entry(root_dir_path)
                )
                clear_folder_window_position(root_folder)

        if "src_image" in manifest_json:
            try:
                image_path = os.path.join(tmp_dir_path, manifest_json["src_image"])
                return import_disk_image_data(image_path, manifest_json)
            except FileNotFoundError:
                sys.stderr.write("Directory contents:\n")
                for f in os.listdir(tmp_dir_path):
                    sys.stderr.write("  %s\n" % f)
                raise

        if "src_dmg" in manifest_json:
            try:
                dmg_path = os.path.join(tmp_dir_path, manifest_json["src_dmg"])
                import_dmg_folder(manifest_json, dmg_path, root_folder)
                return root_folder
            except Exception:
                sys.stderr.write("Directory contents:\n")
                for f in os.listdir(tmp_dir_path):
                    sys.stderr.write("  %s\n" % f)
                raise

        if "src_images" in manifest_json:
            folder = machfs.Folder()
            for src_image in manifest_json["src_images"]:
                try:
                    image_path = os.path.join(tmp_dir_path, src_image)
                    image_folder = import_disk_image_data(image_path, manifest_json)
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
            update_folder_from_lsar_entry(root_folder, get_lsar_entry(root_dir_path))
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
                                os.path.join(root_dir_path, *folder_path_pieces)
                            ),
                        )
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
                resource_fork_path = os.path.join(file_path, "..namedfork", "rsrc")
                if os.path.exists(resource_fork_path):
                    with open(resource_fork_path, "rb") as f:
                        file.rsrc = f.read()

                update_file_from_lsar_entry(file, get_lsar_entry(file_path))

                folder[normalize(file_name)] = file
    return root_folder


def update_file_from_lsar_entry(
    file: machfs.File, entry: typing.Dict[str, typing.Any]
) -> None:
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


def update_folder_from_lsar_entry(
    folder: machfs.Folder, entry: typing.Dict[str, typing.Any]
) -> None:
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
    folder.usrInfo = struct.pack(
        ">hhhhHhhH",
        rect_top,
        rect_left,
        rect_bottom,
        rect_right,
        flags,
        window_y,
        window_x,
        view,
    )


def update_file_or_folder_from_lsar_entry(
    file_or_folder: typing.Union[machfs.File, machfs.Folder],
    entry: typing.Dict[str, typing.Any],
) -> None:

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


def import_dmg(manifest_json: typing.Dict[str, typing.Any]) -> machfs.Folder:
    src_url = manifest_json["src_url"]
    archive_path = urls.read_url_to_path(src_url)
    root_folder = machfs.Folder()
    import_dmg_folder(manifest_json, archive_path, root_folder)
    return root_folder


def import_dmg_folder(
    manifest_json: typing.Dict[str, typing.Any],
    archive_path: str,
    root_folder: machfs.Folder,
) -> None:
    if manifest_json.get("needs_dmg2img"):
        with tempfile.TemporaryDirectory() as tmp_dir_path:
            img_path = os.path.join(tmp_dir_path, "image.img")
            dmg2img_code = subprocess.call(
                [paths.DMG2IMG_PATH, "-silent", "-i", archive_path, "-o", img_path],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            if dmg2img_code != 0:
                assert False, "Could not convert .dmg to .img: %s (cached at %s):" % (
                    archive_path,
                    archive_path,
                )
            dmg_path = os.path.join(tmp_dir_path, "image.dmg")
            hdiutil_code = subprocess.call(
                [
                    paths.HDIUTIL_PATH,
                    "convert",
                    img_path,
                    "-format",
                    "UFBI",
                    "-o",
                    dmg_path,
                ],
                stdout=subprocess.DEVNULL,
            )
            if hdiutil_code != 0:
                assert False, "Could not convert .img: %s (cached at %s):" % (
                    src_url,
                    img_path,
                )
            manifest_json_clone = copy.deepcopy(manifest_json)
            del manifest_json_clone["needs_dmg2img"]
            return import_dmg_folder(manifest_json_clone, dmg_path, root_folder)

    src_url = manifest_json["src_url"]

    def normalize(name: str) -> str:
        # Replaces : with /, to undo escaping done by hdiutil.
        # Normalizes accented characters to their combined form, since only
        # those have an equivalent in the MacRoman encoding that HFS ends up
        # using.
        name = unicodedata.normalize("NFC", name.replace(":", "/"))
        if len(name) > 31:
            name = name[:31]
        return name

    with tempfile.TemporaryDirectory() as tmp_dir_path:
        hdiutil_code = subprocess.run(
            [paths.HDIUTIL_PATH, "attach", archive_path, "-mountpoint", tmp_dir_path],
            # Pipe in a "y" to accept the license agreement (if any).
            input=b"y\n",
            stdout=subprocess.DEVNULL,
        ).returncode
        if hdiutil_code != 0:
            assert False, "Could not mount .dmg: %s (cached at %s):" % (
                src_url,
                archive_path,
            )
        try:
            root_dir_path = tmp_dir_path

            if "src_folder" in manifest_json:
                src_folder_name = manifest_json["src_folder"]
                root_dir_path = os.path.join(root_dir_path, src_folder_name)
                update_folder_from_xattr(root_folder, root_dir_path)
                clear_folder_window_position(root_folder)

            for dir_path, dir_names, file_names in os.walk(root_dir_path):
                folder = root_folder
                dir_rel_path = os.path.relpath(dir_path, root_dir_path)
                if dir_rel_path != ".":
                    folder_path_pieces = []
                    for folder_name in dir_rel_path.split(os.path.sep):
                        folder_path_pieces.append(folder_name)
                        folder_name = normalize(folder_name)
                        if folder_name not in folder:
                            new_folder = folder[folder_name] = machfs.Folder()
                            folder_path = os.path.join(
                                root_dir_path, *folder_path_pieces
                            )
                            update_folder_from_xattr(new_folder, folder_path)
                        folder = folder[folder_name]
                for file_name in file_names:
                    file_path = os.path.join(dir_path, file_name)
                    if os.path.islink(file_path):
                        continue
                    file = machfs.File()
                    with open(file_path, "rb") as f:
                        file.data = f.read()
                    resource_fork_path = os.path.join(file_path, "..namedfork", "rsrc")
                    if os.path.exists(resource_fork_path):
                        with open(resource_fork_path, "rb") as f:
                            file.rsrc = f.read()

                    update_file_from_xattr(file, file_path)

                    try:
                        normalize(file_name).encode("macroman")
                    except UnicodeEncodeError:
                        # Skip over files that can't be encoded in MacRoman.
                        continue

                    folder[normalize(file_name)] = file

                # Skip over directories that can't be encoded in MacRoman.
                invalid_dir_names = []
                for dir_name in dir_names:
                    try:
                        normalize(dir_name).encode("macroman")
                    except UnicodeEncodeError:
                        invalid_dir_names.append(dir_name)
                for dir_name in invalid_dir_names:
                    dir_names.remove(dir_name)
        finally:
            hdiutil_code = subprocess.call(
                [paths.HDIUTIL_PATH, "detach", tmp_dir_path], stdout=subprocess.DEVNULL
            )
            if hdiutil_code != 0:
                assert False, "Could not unmount .dmg: %s (cached at %s):" % (
                    src_url,
                    archive_path,
                )


def update_file_from_xattr(file: machfs.File, file_path: str) -> None:
    attr_name = "com.apple.FinderInfo"
    xattrs = xattr.listxattr(file_path)
    if attr_name not in xattrs:
        return
    finder_info = xattr.getxattr(file_path, attr_name)
    (file.type, file.creator, file.flags, file.y, file.x, _, file.fndrInfo) = (
        struct.unpack(">4s4sHhhH16s", finder_info)
    )
    if file.x == 0 and file.y == 0:
        file.flags &= ~machfs.main.FinderFlags.kHasBeenInited


def update_folder_from_xattr(folder: machfs.Folder, folder_path: str) -> None:
    attr_name = "com.apple.FinderInfo"
    xattrs = xattr.listxattr(folder_path)
    if attr_name not in xattrs:
        return
    # Get creator and type code
    finder_info = xattr.getxattr(folder_path, attr_name)
    folder.usrInfo = finder_info[0:16]
    folder.fndrInfo = finder_info[16:]


SYSTEM7_ZIP_PATHS = {
    "Games/Bungie/Marathon Infinity",
    "Graphics/Adobe Photoshop 3.0",
    "Graphics/Canvas 3.5",
    "Graphics/Infini-D",
}

MAC_OS_X_ZIP_PATHS = {}


def import_zips() -> ImportFolders:
    sys.stderr.write("Importing .zips\n")
    import_folders = {}
    import_folders7 = {}
    import_foldersX = {}
    debug_filter = os.getenv("DEBUG_LIBRARY_FILTER")

    for zip_path in glob.iglob(
        os.path.join(paths.LIBRARY_DIR, "**", "*.zip"), recursive=True
    ):
        if debug_filter and debug_filter != "X" and debug_filter not in zip_path:
            continue
        folder_path, _ = os.path.splitext(os.path.relpath(zip_path, paths.LIBRARY_DIR))

        if debug_filter == "X" and folder_path not in MAC_OS_X_ZIP_PATHS:
            continue

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
                    files_by_path.setdefault(path, machfs.File()).rsrc = file_data
                    continue
                if ".finf/" in path:
                    # May actually be the DInfo for a folder, check for that.
                    path = path.replace(".finf/", "")
                    try:
                        # Will throw if there isn't a corresponding directory,
                        # no need to actually do anything with the return value.
                        zip.getinfo(path + "/")
                        nested_folder_path, nested_folder_name = os.path.split(path)
                        parent = traverse_folders(folder, nested_folder_path)
                        nested_folder = machfs.Folder()
                        (nested_folder.usrInfo, nested_folder.fndrInfo) = struct.unpack(
                            ">16s16s", file_data
                        )
                        parent[fix_name(nested_folder_name)] = nested_folder
                        continue
                    except KeyError:
                        pass
                    file = files_by_path.setdefault(path, machfs.File())
                    (
                        file.type,
                        file.creator,
                        file.flags,
                        file.y,
                        file.x,
                        _,
                        file.fndrInfo,
                    ) = struct.unpack(">4s4sHhhH16s", file_data)
                    continue
                files_by_path.setdefault(path, machfs.File()).data = file_data

        for path, file in files_by_path.items():
            file_folder_path, file_name = os.path.split(path)
            parent = traverse_folders(folder, file_folder_path)

            parent[fix_name(file_name)] = file

        if folder_path in SYSTEM7_ZIP_PATHS:
            import_folders7[folder_path] = folder
        elif folder_path in MAC_OS_X_ZIP_PATHS:
            import_foldersX[folder_path] = folder
        else:
            import_folders[folder_path] = folder

    return import_folders, import_folders7, import_foldersX


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
    (rect_top, rect_left, rect_bottom, rect_right, flags, window_y, window_x, view) = (
        struct.unpack(">hhhhHhhH", folder.usrInfo)
    )
    window_x = -1
    window_y = -1
    folder.usrInfo = struct.pack(
        ">hhhhHhhH",
        rect_top,
        rect_left,
        rect_bottom,
        rect_right,
        flags,
        window_y,
        window_x,
        view,
    )


def build_images() -> typing.Tuple[bytes, bytes, bytes]:
    import_folders, import_folders7, import_foldersX = get_import_folders()

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
                    "  Skipping %s, already installed in the image\n" % folder_path
                )
                continue
            parent[folder_name] = folder

    add_folders(import_folders)

    image6 = v.write(
        size=1000 * 1024 * 1024,
        align=512,
        desktopdb=False,
        bootable=False,
    )

    add_folders(import_folders7)
    image = v.write(
        size=2000 * 1024 * 1024,
        align=512,
        desktopdb=False,
        bootable=False,
    )

    # Not much point in including Classic software for the Mac OS X image, so
    # we start with a fresh volume.
    v = machfs.Volume()
    with open(os.path.join(paths.IMAGES_DIR, "Infinite HD.dsk"), "rb") as base:
        v.read(base.read())
    v.name = "Infinite HD"
    add_folders(import_foldersX)
    imageX = v.write(
        size=2500 * 1024 * 1024,
        align=512,
        desktopdb=False,
        bootable=False,
    )

    return image6, image, imageX
