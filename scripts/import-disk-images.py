#!/usr/local/bin/python3

import machfs
import os.path
import struct
import time
import typing
import urllib.request
import zipfile

VolumeOrFolder = typing.Union[machfs.Folder, machfs.Volume]

ImageFilterStart = typing.Tuple[VolumeOrFolder, str, typing.List[str]]


class ImageFilter(typing.Protocol):
    def start(self, volume: machfs.Volume) -> ImageFilterStart:
        ...

    def should_include(self, file_path: str) -> bool:
        ...


class ImageDef(typing.NamedTuple):
    src_url: str
    src_filter: ImageFilter
    dst_category: str
    dst_name: str


class ImageFolderFilter(typing.NamedTuple):
    src_folder_path: str

    def start(self, volume: machfs.Volume) -> ImageFilterStart:
        folder = volume
        folder_name = ""
        for name in self.src_folder_path.split("/"):
            folder = folder[name]
            folder_name = name
        return folder, folder_name, []

    def should_include(self, file_path: str) -> bool:
        return True


class ImageDenylistFilter(typing.NamedTuple):
    denylisted_paths: typing.List[str]

    def start(self, volume: machfs.Volume) -> ImageFilterStart:
        return volume, "", []

    def should_include(self, file_path: str) -> bool:
        return file_path not in self.denylisted_paths


IMAGE_DEFS = [
    ImageDef(
        src_url=
        "https://archive.org/download/PrinceOfPersiaMacintosh/PrinceOfPersia.img",
        src_filter=ImageFolderFilter("Prince of Persia"),
        dst_category="Games",
        dst_name="Prince of Persia",
    ),
    ImageDef(
        src_url="https://archive.org/download/mac_lemmings_1/mac_lemmings.img",
        src_filter=ImageFolderFilter("Lemmings"),
        dst_category="Games",
        dst_name="Lemmings",
    ),
    ImageDef(
        src_url=
        "https://archive.org/download/CosmicOsmoMacintosh/CosmicOsmo.img",
        src_filter=ImageFolderFilter("Cosmic Osmo"),
        dst_category="Games",
        dst_name="Cosmic Osmo",
    ),
    ImageDef(
        src_url=
        "https://archive.org/download/mac_DarkCastle_1_2/DarkCastle_1_2.dsk",
        src_filter=ImageDenylistFilter(["System", "Finder"]),
        dst_category="Games",
        dst_name="Dark Castle",
    ),
    ImageDef(
        src_url=
        "https://archive.org/download/BattleChessMacintosh/BattleChess.img",
        src_filter=ImageDenylistFilter(["TheVolumeSettingsFolder"]),
        dst_category="Games",
        dst_name="Battle Chess",
    ),
    ImageDef(
        src_url=
        "https://archive.org/download/IndianaJonesandtheLastCrusade/LastCrusade.img",
        src_filter=ImageDenylistFilter(["TheVolumeSettingsFolder"]),
        dst_category="Games",
        dst_name="Indiana Jones and the Last Crusade",
    ),
    ImageDef(
        src_url="https://archive.org/download/CivilizationMacintosh/Civ.img",
        src_filter=ImageFolderFilter("Civilization"),
        dst_category="Games",
        dst_name="Civilization",
    ),
]

library_dir = os.path.join(os.path.dirname(__file__), "..", "public",
                           "Library")


def import_image(image_def: ImageDef) -> None:
    zip_path = os.path.join(library_dir, image_def.dst_category,
                            f"{image_def.dst_name}.zip")
    if os.path.exists(zip_path):
        return

    print("Downloading %s..." % image_def.dst_name)

    generate_zip(image_def, urllib.request.urlopen(image_def.src_url),
                 zip_path)


def generate_zip(image_def: ImageDef, image_file: typing.BinaryIO,
                 zip_path: str) -> None:
    v = machfs.Volume()
    v.read(image_file.read())

    with zipfile.ZipFile(zip_path, "w",
                         compression=zipfile.ZIP_DEFLATED) as zip:

        def add_folder(folder: VolumeOrFolder, folder_name,
                       path: typing.List[str]) -> None:
            if isinstance(folder, machfs.Folder):
                if path:
                    dinfo_path = "/".join(path + [".finf", folder_name])
                else:
                    # Special DInfo entry for the root folder
                    dinfo_path = "DInfo"
                zip_info = zipfile.ZipInfo(dinfo_path,
                                           time.gmtime(folder.crdate))
                zip_info.compress_type = zipfile.ZIP_DEFLATED
                zip.writestr(zip_info, folder.usrInfo + folder.fndrInfo)

            for name, item in folder.items():
                item_path = "/".join(path + [name])
                if not image_def.src_filter.should_include(item_path):
                    continue

                if isinstance(item, machfs.Folder):
                    add_folder(item, name, path + [name])
                elif isinstance(item, machfs.File):
                    zip_date_time = time.gmtime(item.crdate)

                    file_zip_info = zipfile.ZipInfo("/".join(path + [name]),
                                                    zip_date_time)
                    file_zip_info.compress_type = zipfile.ZIP_DEFLATED
                    zip.writestr(file_zip_info, item.data)

                    resource_fork_zip_info = zipfile.ZipInfo(
                        "/".join(path + [".rsrc", name]), zip_date_time)
                    resource_fork_zip_info.compress_type = zipfile.ZIP_DEFLATED
                    zip.writestr(resource_fork_zip_info, item.rsrc)

                    finf_zip_info = zipfile.ZipInfo(
                        "/".join(path + [".finf", name]), zip_date_time)
                    finf_zip_info.compress_type = zipfile.ZIP_DEFLATED
                    # Reverse the transform done by machfs (it would be nice if
                    # it preserved it)
                    finf = struct.pack('>4s4sHHH', item.type, item.creator,
                                       item.flags, item.x, item.y)
                    zip.writestr(finf_zip_info, finf)

        start_folder, name, path = image_def.src_filter.start(v)
        add_folder(start_folder, name, path)


for image_def in IMAGE_DEFS:
    import_image(image_def)
