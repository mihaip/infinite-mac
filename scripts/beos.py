"""Locate saved BeOS display settings for runtime disk overlays.

Like the scrn placeholder, these must be contiguous in the prepared image.
DR8/PR/R3 use Screen_settings; R4 and later use app_server_settings.
"""

import re
import struct
import typing


class ScreenTimingRegion(typing.TypedDict):
    offset: int
    length: int


class ScreenSettings(typing.TypedDict):
    legacyOffsets: typing.List[int]
    timingRegions: typing.List[ScreenTimingRegion]


ScreenSettingsFormat = typing.Literal["legacy", "workspace"]


def find_screen_settings(
    image: bytes,
    settings_format: ScreenSettingsFormat,
) -> typing.Optional[ScreenSettings]:
    legacy_offsets = _find_legacy_offsets(image) if settings_format == "legacy" else []
    timing_regions = _find_timing_regions(image) if settings_format == "workspace" else []
    if not legacy_offsets and not timing_regions:
        return None
    return {"legacyOffsets": legacy_offsets, "timingRegions": timing_regions}


def _find_legacy_offsets(image: bytes) -> typing.List[int]:
    legacy_offsets: typing.List[int] = []
    # Prepared Screen_settings files have 32 refresh rates (60 or 60.1 Hz)
    # followed by 32 desktop colors (50, 50, 50, 50). Match the whole file,
    # including a valid mode mask and workspace count, rather than a bare mode.
    legacy_pattern = re.compile(
        rb"(?:\x42\x70\x66\x66|\x42\x70\x00\x00){32}\x32{128}"
    )
    # Searching the entire image with the repeated regex is expensive. Find
    # the desktop-color bytes first, then validate the preceding refresh rates.
    colors = b"\x32" * 128
    position = 0
    while (candidate := image.find(colors, position)) != -1:
        # Overlapping color runs cannot contain another valid record's refresh
        # rates, so skip this run instead of checking every byte within it.
        position = candidate + len(colors)
        refresh_offset = candidate - 128
        offset = refresh_offset - 8
        if offset < 0:
            continue
        if not legacy_pattern.match(image, refresh_offset, position):
            continue
        mode, workspaces = struct.unpack_from(">II", image, offset)
        if mode != 0 and mode & (mode - 1) == 0 and 1 <= workspaces <= 32:
            legacy_offsets.append(offset)
    return legacy_offsets


def _find_timing_regions(image: bytes) -> typing.List[ScreenTimingRegion]:
    timing_regions: typing.List[ScreenTimingRegion] = []

    # Require complete workspace records so strings in executables or
    # documentation are not mistaken for an app_server_settings file. Record
    # just the mode fields; workspace colors and interface preferences survive.
    workspace_pattern = (
        rb"Workspaces \d+ \{\n"
        rb"((?:\tWorkspace \d+ \{\n(?:\t\t[^\n]*\n)+\t\}\n)+)\}"
    )
    mode_pattern = (
        rb"timing [^\n]+\n\t\tcolorspace [^\n]+\n\t\tvirtual [^\n]+"
    )
    for workspace in re.finditer(workspace_pattern, image):
        for mode in re.finditer(mode_pattern, workspace[1]):
            timing_regions.append({
                "offset": workspace.start(1) + mode.start(),
                "length": len(mode[0]),
            })
    return timing_regions
