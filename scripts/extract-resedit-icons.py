#!/usr/bin/env python3
"""Extract ResEdit's type icons from the archive used to build Infinite HD."""

import json
from pathlib import Path
import struct
import zipfile

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "src/Images/ResEdit"
PALETTE = [
    0xFFFFFF, 0xFCF305, 0xFF6402, 0xDD0806, 0xF20884, 0x4600A5, 0x0000D4,
    0x02ABEA, 0x1FB714, 0x006411, 0x562C05, 0x90713A, 0xC0C0C0, 0x808080,
    0x404040, 0x000000,
]


def resources(fork):
    u16 = lambda p: struct.unpack_from(">H", fork, p)[0]
    u32 = lambda p: struct.unpack_from(">I", fork, p)[0]
    data_base, map_base = struct.unpack_from(">II", fork)
    types = map_base + u16(map_base + 24)
    names = map_base + u16(map_base + 26)
    result = {}
    for i in range(u16(types) + 1):
        entry = types + 2 + i * 8
        resource_type = fork[entry:entry + 4].decode("mac_roman")
        refs = types + u16(entry + 6)
        for j in range(u16(entry + 4) + 1):
            ref = refs + j * 12
            resource_id = struct.unpack_from(">h", fork, ref)[0]
            name_offset = u16(ref + 2)
            name = None
            if name_offset != 0xFFFF:
                start = names + name_offset
                name = fork[start + 1:start + 1 + fork[start]].decode("mac_roman")
            start = data_base + (u32(ref + 4) & 0xFFFFFF)
            result[resource_type, resource_id] = (
                name, fork[start + 4:start + 4 + u32(start)]
            )
    return result


def color256(index):
    if index < 215:
        return ((255 - index // 36 * 51) << 16) | ((255 - (index // 6 % 6) * 51) << 8) | (255 - index % 6 * 51)
    if index == 255:
        return 0
    shade = [238, 221, 187, 170, 136, 119, 85, 68, 34, 17][(index - 215) % 10]
    return shade * [65536, 256, 1, 65793][(index - 215) // 10]


def bitmap(data, depth=1, mask=None):
    image = Image.new("RGBA", (32, 32))
    for p in range(1024):
        if depth == 8:
            value = color256(data[p])
        elif depth == 4:
            value = PALETTE[(data[p // 2] >> (0 if p % 2 else 4)) & 15]
        else:
            value = 0 if data[p // 8] & (128 >> (p % 8)) else 0xFFFFFF
        alpha = 255 if mask is None or mask[p // 8] & (128 >> (p % 8)) else 0
        image.putpixel((p % 32, p // 32), (
            value >> 16, (value >> 8) & 255, value & 255, alpha
        ))
    return image


def main():
    with zipfile.ZipFile(ROOT / "Library/Developer/ResEdit.zip") as archive:
        res = resources(archive.read(".rsrc/ResEdit"))
    icons = sorted(
        (name, resource_id, data)
        for (kind, resource_id), (name, data) in res.items()
        if kind == "ICON" and 1000 <= resource_id < 1300 and name and len(name) == 4
    )
    DEST.mkdir(exist_ok=True)
    height = ((len(icons) + 15) // 16) * 32
    color = Image.new("RGBA", (512, height))

    def best_icon(resource_id, mono, mask=None):
        for kind, depth in (("icl8", 8), ("icl4", 4)):
            if (kind, resource_id) in res:
                return bitmap(res[kind, resource_id][1], depth, mask)
        return bitmap(mono, mask=mask)
    index = {}
    for i, (name, resource_id, data) in enumerate(icons):
        xy = (i % 16 * 32, i // 16 * 32)
        color.paste(best_icon(resource_id, data), xy)
        index[name] = i
    color.save(DEST / "Types.png", optimize=True)
    (DEST / "types.json").write_text(json.dumps(index, indent=4) + "\n")
    app_icon = res["ICN#", 128][1]
    best_icon(128, app_icon, app_icon[128:]).save(DEST / "Application.png", optimize=True)
    print(f"Extracted {len(icons)} resource type icons and the application icon.")


if __name__ == "__main__":
    main()
