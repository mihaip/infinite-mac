#!/usr/bin/env python3
"""Dump classic Mac PRAM/NVRAM, or compare two images logically.

Accepts raw 256-byte PRAM / 8192-byte NVRAM and DingusPPC backing files.
Only the payload is compared, so adding/removing the backing header is ignored.
Exit status: 0 for a dump or equal payloads, 1 for differences, 2 for errors.
Requires only Python's standard library.

Layout references:
  dingusppc/devices/common/{nvram,ofnvram}.{cpp,h}
  macemu/BasiliskII/src/CrossPlatform/ether_helpers.h (serial-use nibbles)
  macemu/SheepShaver/src/main.cpp (Old World PRAM offset)
  Apple Inside Macintosh: Operating System Utilities, chapters 4 and 7
  Apple SuperMarioProj.1994-02-09: OS/SysUtil.a, OS/StartMgr/StartSearch.a,
    Interfaces/AIncludes/{SysEqu,Serial,Slots}.a, Internal/Asm/{InternalOnlyEqu,
    EDiskEqu,ReliabilityEqu}.a, OS/NetBoot/ATIncludes/LAPMgrEqu.a
  xnu-123.5/iokit/Kernel/IONVRAM.cpp (Old World and CHRP partitions)

Some fields are legacy or machine dependent; their labels describe the storage,
not a promise that every Mac uses them. Undecoded bytes are always included.
"""

import argparse
import datetime
import hashlib
import pathlib
import sys
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field

MAGIC = b"DINGUSPPCNVRAM\0"
MAC_EPOCH = datetime.datetime(1904, 1, 1, tzinfo=datetime.timezone.utc)
OF_BOOLEANS = (
    "little-endian?",
    "real-mode?",
    "auto-boot?",
    "diag-switch?",
    "fcode-debug?",
    "oem-banner?",
    "oem-logo?",
    "use-nvramrc?",
    "f-segment?",
)
OF_NUMBERS = (
    "real-base",
    "real-size",
    "virt-base",
    "virt-size",
    "load-base",
    "pci-probe-list",
    "screen-#columns",
    "screen-#rows",
    "selftest-#megs",
)
OF_STRINGS = (
    "boot-device",
    "boot-file",
    "diag-device",
    "diag-file",
    "input-device",
    "output-device",
    "oem-banner",
    "oem-logo",
    "nvramrc",
    "boot-command",
)
SERIAL_USES = {
    0: "undefined/free (driver may claim port)",
    1: "AppleTalk",
    2: "asynchronous serial",
    3: "externally clocked serial",
}
BAUD_RATES = {
    380: 300,
    189: 600,
    94: 1200,
    62: 1800,
    46: 2400,
    30: 3600,
    22: 4800,
    14: 7200,
    10: 9600,
    4: 19200,
    1: 38400,
    0: 57600,
}


def number(data: bytes, signed: bool = False) -> int:
    return int.from_bytes(data, "big", signed=signed)


def preview(data: bytes, limit: int = 32) -> str:
    result = data[:limit].hex(" ") or "(empty)"
    if len(data) > limit:
        result += f" … ({len(data)} bytes; SHA-256 {hashlib.sha256(data).hexdigest()})"
    return result


def serial_config(data: bytes) -> str:
    value = number(data)
    baud = value & 0x3FF
    rate = f"{BAUD_RATES[baud]} baud" if baud in BAUD_RATES else f"baud code {baud}"
    return (
        f"{rate}, {(5, 7, 6, 8)[(value >> 10) & 3]} data bits, "
        f"{('none', 'odd', 'reserved', 'even')[(value >> 12) & 3]} parity, "
        f"{('reserved', '1', '1.5', '2')[(value >> 14) & 3]} stop bits"
    )


def startup_wait(data: bytes) -> str:
    value = data[0]
    timeout = (
        f"{value & 31} seconds"
        if value & 31
        else "default (20 seconds in StartSearch.a)"
    )
    return (
        f"timeout={timeout}; dynamic wait={'disabled' if value & 0x80 else 'enabled'}; "
        f"permanent wait={'disabled' if value & 0x40 else 'enabled'}; bit 5={(value >> 5) & 1}"
    )


def memory_flags(data: bytes) -> str:
    value = data[0]
    return "; ".join(
        (
            f"startup addressing={'32' if value & 1 else '24'} bit",
            f"mixed addressing={bool(value & 2)}",
            f"system heap={'32' if value & 4 else '24'} bit",
            f"read-only heap={'32' if value & 8 else '24'} bit",
            f"high system heap={bool(value & 16)}",
            f"modern memory manager (Figment)={bool(value & 32)}",
            f"model-dependent cache/SCSI bit 6={bool(value & 64)}",
            f"Quadra caches inhibited={bool(value & 128)}",
        )
    )


def reliability(data: bytes) -> str:
    value = number(data)
    periods = (value & 0x7FF80000) >> 19
    date = datetime.date(1989, 1, 1) + datetime.timedelta(days=periods * 2)
    return (
        f"first powered on={date} ({periods} 48-hour periods since 1989-01-01); "
        f"power-on time={(value & 0x7FFFF) * 5} minutes; bit 31={value >> 31}"
    )


def zone(data: bytes) -> str:
    length = data[0]
    if length > 32:
        return f"invalid Pascal string length {length} (capacity 32)"
    return f"{data[1:1 + length].decode('mac_roman')!r}; unused storage={data[1 + length:].hex(' ')}"


@dataclass
class Record:
    group: str
    name: str
    offset: int
    data: bytes
    decoder: Callable[[bytes], str] | None = None
    raw: bool = False

    def display(self) -> str:
        result = preview(self.data)
        if self.decoder is not None:
            result += f" ({self.decoder(self.data)})"
        return result


@dataclass
class Image:
    payload: bytes
    header_size: int
    container: str
    layout: str = "unknown NVRAM"
    pram_offset: int | None = None
    records: list[Record] = field(default_factory=list[Record])
    variables: dict[str, bytes | int | bool] = field(
        default_factory=dict[str, bytes | int | bool]
    )
    notes: list[str] = field(default_factory=list[str])

    def add(
        self,
        group: str,
        name: str,
        offset: int,
        size: int,
        decoder: Callable[[bytes], str] | None = None,
        raw: bool = False,
    ) -> None:
        self.records.append(
            Record(
                group, name, offset, self.payload[offset : offset + size], decoder, raw
            )
        )

    def location(self, record: Record) -> str:
        location = f"payload 0x{record.offset:04X}; file 0x{self.header_size + record.offset:04X}"
        if record.group == "PRAM":
            assert self.pram_offset is not None
            location = f"PRAM 0x{record.offset - self.pram_offset:02X}; " + location
        return location


def decode_pram(image: Image, base: int) -> None:
    image.pram_offset = base

    def add(
        offset: int,
        size: int,
        name: str,
        decoder: Callable[[bytes], str] | None = None,
        raw: bool = False,
    ) -> None:
        image.add("PRAM", name, base + offset, size, decoder, raw)

    add(0, 1, "Unclassified byte")
    add(1, 1, "Startup wait flags / timeout", startup_wait)
    add(2, 2, "Unclassified bytes")
    add(4, 4, "Network boot password: first four bytes (legacy)")
    add(
        8,
        1,
        "SPVolCtl: speaker, mouse, alarm",
        lambda d: f"volume={d[0] & 7}/7; mouse tracking={(d[0] >> 3) & 15}; alarm={bool(d[0] & 128)}",
    )
    add(
        9,
        1,
        "SPClikCaret: caret / double click",
        lambda d: f"caret blink={(d[0] & 15) * 4} ticks; double click={(d[0] >> 4) * 4} ticks (60 ticks/second)",
    )
    add(0x0A, 1, "SPMisc1: legacy disk cache size", lambda d: f"{d[0] * 32} KiB")
    add(
        0x0B,
        1,
        "SPMisc2: miscellaneous settings",
        lambda d: f"menu blinks={(d[0] >> 2) & 3}; preferred drive={'external' if d[0] & 16 else 'internal'}; disk cache={bool(d[0] & 32)}; mouse scaling={bool(d[0] & 64)}; color desktop pattern={bool(d[0] & 128)}",
    )
    add(
        0x0C,
        4,
        "Extended PRAM validation signature",
        lambda d: repr(d.decode("mac_roman"))
        + ("; valid NuMc" if d == b"NuMc" else "; not NuMc"),
    )
    add(
        0x10,
        1,
        "SPValid: standard PRAM validity",
        lambda d: "valid 0xA8" if d[0] == 0xA8 else "not 0xA8",
    )
    add(0x11, 1, "SPATalkA: modem port node-ID hint", lambda d: str(d[0]))
    add(0x12, 1, "SPATalkB: printer port node-ID hint", lambda d: str(d[0]))
    add(
        0x13,
        1,
        "SPConfig: serial port use / AppleTalk",
        lambda d: f"A/modem={SERIAL_USES.get(d[0] >> 4, 'undocumented')}; B/printer={SERIAL_USES.get(d[0] & 15, 'undocumented')}",
    )
    add(0x14, 2, "SPPortA: modem port configuration", serial_config)
    add(0x16, 2, "SPPortB: printer port configuration", serial_config)
    add(
        0x18,
        4,
        "SPAlarm: alarm time",
        lambda d: (MAC_EPOCH + datetime.timedelta(seconds=number(d))).isoformat(),
    )
    add(
        0x1C,
        2,
        "SPFont: application font minus one",
        lambda d: f"font ID={number(d) + 1}",
    )
    add(
        0x1E,
        1,
        "SPKbd: keyboard repeat",
        lambda d: f"repeat rate={(d[0] & 15) * 2} ticks; threshold={(d[0] >> 4) * 4} ticks",
    )
    add(
        0x1F,
        1,
        "SPPrint: printer connection",
        lambda d: "modem port" if d[0] & 1 else "printer port",
    )
    add(0x20, 32, "Network boot user name storage (legacy)")
    add(0x40, 5, "Machine / OS dependent storage")
    add(0x45, 1, "Network boot password checksum (legacy)")
    for slot in range(9, 15):
        offset = 0x46 + (slot - 9) * 8
        add(offset, 2, f"Slot {slot:X}: board ID", lambda d: str(number(d)))
        add(offset + 2, 6, f"Slot {slot:X}: vendor-use bytes (device dependent)")
    add(0x76, 1, "Default OS reserved / PRAM preservation byte")
    add(
        0x77,
        1,
        "Default OS type",
        lambda d: "Mac OS" if d[0] == 1 else "machine dependent",
    )
    add(
        0x78,
        4,
        "Default startup device record (machine dependent)",
        lambda d: (
            "0x6666 driver refnum: no default"
            if d[2:] == b"\x66\x66"
            else "legacy SlotDev: extDevID, partition, slot, resource; SCSIDev: reserved word + signed refnum"
        ),
    )
    add(0x7C, 2, "Sound alert resource ID", lambda d: str(number(d, signed=True)))
    for offset, name in (
        (0x7E, "Hierarchical menu display"),
        (0x7F, "Hierarchical menu drag"),
        (0x80, "Default video slot"),
        (0x81, "Default video resource ID"),
    ):
        add(offset, 1, name)
    for offset, color in ((0x82, "red"), (0x84, "green"), (0x86, "blue")):
        add(offset, 2, f"Highlight color: {color}", lambda d: f"{number(d)}/65535")
    add(0x88, 1, "Reserved / machine dependent")
    add(0x89, 1, "IOP operating mode (model dependent)")
    add(0x8A, 1, "Memory manager flags", memory_flags)
    add(0x8B, 32, "Network boot server name storage (legacy)")
    add(0xAB, 3, "Network boot password: next three bytes (legacy)")
    add(0xAE, 1, "Unclassified byte")
    add(
        0xAF,
        1,
        "RAM disk size / flags (legacy EDisk)",
        lambda d: f"{(d[0] & 127) * 64} KiB; bit 7={d[0] >> 7}",
    )
    add(0xB0, 8, "Unclassified bytes")
    add(0xB8, 4, "Reliability Manager data", reliability)
    add(0xBC, 1, "Network boot password: final byte (legacy)")
    add(0xBD, 33, "AppleTalk zone (Str32)", zone)
    add(0xDE, 2, "AppleTalk network number", lambda d: str(number(d)))
    add(0xE0, 4, "Selected AppleTalk LAP port (driver specific)")
    for offset, name in ((0xE4, "Latitude"), (0xE8, "Longitude")):
        add(
            offset,
            4,
            name,
            lambda d: f"{number(d, signed=True) * 90 / (1 << 30):.6f} degrees (signed 2.30 Fract)",
        )
    add(0xEC, 1, "Daylight saving delta", lambda d: f"{number(d, signed=True)} hours")
    add(0xED, 3, "GMT delta", lambda d: f"{number(d, signed=True)} seconds")
    add(0xF0, 8, "Non-critical test failure history (model dependent)")
    add(0xF8, 4, "SCSI burn-in / diagnostic storage (model dependent)")
    add(0xFC, 4, "Burn-in signature / failure code (model dependent)")


def decode_old_world(image: Image) -> None:
    image.layout = "Old World NVRAM"
    image.add("Firmware", "Other firmware storage (undecoded)", 0, 0x1300, raw=True)
    decode_pram(image, 0x1300)
    image.add(
        "Name Registry", "Name Registry storage (undecoded)", 0x1400, 0x400, raw=True
    )
    base = 0x1800
    for offset, size, name in (
        (0, 2, "Signature"),
        (2, 1, "Version"),
        (3, 1, "256-byte pages"),
        (4, 2, "Checksum"),
        (6, 2, "here (next free table byte)"),
        (8, 2, "top (bottom of strings)"),
        (10, 2, "Reserved header bytes"),
        (12, 4, "Boolean flags"),
    ):
        image.add("OF layout", name, base + offset, size)
    total = sum(number(image.payload[o : o + 2]) for o in range(base, 0x2000, 2))
    while total >> 16:
        total = (total & 0xFFFF) + (total >> 16)
    image.notes.append(
        f"Old World OF checksum: {'valid' if total == 0xFFFF else 'INVALID'} (folded sum 0x{total:04X}, expected 0xFFFF)"
    )
    if image.payload[base : base + 2] != b"\x12\x75":
        image.notes.append("OF signature is not 0x1275; variables not decoded")
    else:
        flags = number(image.payload[base + 12 : base + 16])
        for bit, name in zip(range(31, 22, -1), OF_BOOLEANS):
            image.variables[name] = bool(flags & (1 << bit))
        for index, name in enumerate(OF_NUMBERS):
            offset = base + 0x10 + index * 4
            image.variables[name] = number(image.payload[offset : offset + 4])
        for index, name in enumerate(OF_STRINGS):
            offset = base + 0x34 + index * 4
            pointer = number(image.payload[offset : offset + 2])
            size = number(image.payload[offset + 2 : offset + 4])
            if size == 0:
                image.variables[name] = b""
            elif pointer >= base and pointer + size <= len(image.payload):
                image.variables[name] = image.payload[pointer : pointer + size]
            else:
                image.notes.append(
                    f"{name}: invalid string pointer 0x{pointer:04X} / length {size}"
                )
            image.add("OF layout", f"{name} pointer / length", offset, 4)
    image.add("OF layout", "Numeric variable table", base + 0x10, 0x24, raw=True)
    # Keep a raw view even for malformed tables and unused/stale string storage.
    if image.payload[base : base + 2] != b"\x12\x75":
        image.add(
            "OF layout",
            "String descriptor table (undecoded)",
            base + 0x34,
            0x28,
            raw=True,
        )
    image.add("OF storage", "String storage / free space", base + 0x5C, 0x7A4, raw=True)


def chrp_partitions(data: bytes) -> list[tuple[int, int, str]] | None:
    result: list[tuple[int, int, str]] = []
    offset = 0
    while offset < len(data):
        header = data[offset : offset + 16]
        size = number(header[2:4]) * 16
        if len(header) != 16 or size < 16 or offset + size > len(data):
            return None
        # Recognize named CHRP headers, including the 0x7F free partition.
        name = header[4:16].split(b"\0")[0]
        if not name or any(c < 32 or c > 126 for c in name):
            return None
        result.append((offset, size, name.decode("ascii")))
        offset += size
    return result


def decode_new_world(image: Image, partitions: list[tuple[int, int, str]]) -> None:
    image.layout = "New World CHRP NVRAM"
    for index, (offset, size, name) in enumerate(partitions):
        label = f"Partition {index}: {name}"
        image.add(label, "CHRP header (signature, checksum, size, name)", offset, 16)
        start, length = offset + 16, size - 16
        if name == "APL,MacOS75" and length >= 256 and image.pram_offset is None:
            decode_pram(image, start)
            image.add(
                label,
                "Name Registry storage (undecoded)",
                start + 256,
                length - 256,
                raw=True,
            )
        else:
            image.add(label, "Partition storage", start, length, raw=True)
        if name == "common":
            cursor = start
            while cursor < offset + size and image.payload[cursor] != 0:
                end = image.payload.find(b"\0", cursor, offset + size)
                if end < 0:
                    image.notes.append("Unterminated common-partition variable")
                    break
                item = image.payload[cursor:end]
                key, separator, value = item.partition(b"=")
                if not separator:
                    image.notes.append(f"Malformed common-partition variable: {item!r}")
                else:
                    key_name = key.decode("mac_roman")
                    if key_name in image.variables:
                        image.notes.append(
                            f"Duplicate OF variable: {key_name!r} (last value shown)"
                        )
                    image.variables[key_name] = value
                cursor = end + 1


def load_image(path: pathlib.Path, layout: str = "auto") -> Image:
    data = path.read_bytes()
    header_size, container = 0, "raw"
    if data.startswith(MAGIC):
        header_size = len(MAGIC) + 2
        if len(data) < header_size:
            raise ValueError("truncated DingusPPC header")
        size = len(data) - header_size
        size_bytes = data[len(MAGIC) : header_size]
        endian = next(
            (
                order
                for order in ("little", "big")
                if int.from_bytes(size_bytes, order) == size
            ),
            None,
        )
        if endian is None:
            raise ValueError("DingusPPC length field does not match payload length")
        data, container = (
            data[header_size:],
            f"DingusPPC ({endian}-endian length field)",
        )
    if len(data) not in (256, 8192):
        raise ValueError(
            f"expected 256-byte PRAM or 8192-byte NVRAM payload, got {len(data)} bytes"
        )
    image = Image(data, header_size, container)
    if len(data) == 256:
        image.layout = "PRAM"
        decode_pram(image, 0)
        return image
    partitions = chrp_partitions(data)
    if layout == "new-world" or (layout == "auto" and partitions is not None):
        if partitions is None:
            raise ValueError("invalid New World CHRP partition table")
        decode_new_world(image, partitions)
    elif (
        layout == "old-world"
        or data[0x1800:0x1802] == b"\x12\x75"
        or data[0x130C:0x1310] == b"NuMc"
        or not any(data)
    ):
        decode_old_world(image)
    else:
        image.notes.append(
            "Layout not recognized; use --layout old-world or new-world if known"
        )
        image.add("NVRAM", "Undecoded storage", 0, len(data), raw=True)
    return image


def variable_display(value: bytes | int | bool) -> str:
    if isinstance(value, bytes):
        return repr(value.decode("mac_roman"))
    if isinstance(value, bool):
        return str(value).lower()
    return f"0x{value:08X} ({value})"


def hexdump(data: bytes, base: int) -> None:
    previous, repeated = None, False
    for offset in range(0, len(data), 16):
        row = data[offset : offset + 16]
        if row == previous:
            if not repeated:
                print("    * (repeated rows)")
            repeated = True
            continue
        text = "".join(chr(c) if 32 <= c <= 126 else "." for c in row)
        print(f"    {base + offset:04X}: {row.hex(' '):47}  |{text}|")
        previous, repeated = row, False
    print(f"    {base + len(data):04X}: (end)")


def dump(image: Image) -> None:
    print(
        f"{image.layout}: {len(image.payload)} bytes; {image.container}; payload starts at file 0x{image.header_size:X}"
    )
    for note in image.notes:
        print(f"Note: {note}")
    group = None
    for record in image.records:
        if record.group != group:
            group = record.group
            print(f"\n{group}:")
        print(f"  {record.name} [{image.location(record)}]: {record.display()}")
        if record.raw:
            hexdump(record.data, record.offset)
    if image.variables:
        print("\nOpen Firmware variables:")
        for name, value in image.variables.items():
            print(f"  {name}: {variable_display(value)}")


def byte_change_ranges(before: bytes, after: bytes) -> Iterator[tuple[int, int]]:
    start = None
    for offset in range(max(len(before), len(after))):
        changed = before[offset : offset + 1] != after[offset : offset + 1]
        if changed and start is None:
            start = offset
        elif not changed and start is not None:
            yield start, offset
            start = None
    if start is not None:
        yield start, max(len(before), len(after))


def print_byte_changes(before: bytes, after: bytes, base: int, args: "Args") -> None:
    ranges = list(byte_change_ranges(before, after))
    for start, end in ranges[: args.max_byte_ranges]:
        print(
            f"    payload 0x{base + start:04X}-0x{base + end - 1:04X}: {preview(before[start:end], args.max_bytes)}"
        )
        print(f"      -> {preview(after[start:end], args.max_bytes)}")
    if len(ranges) > args.max_byte_ranges:
        print(
            f"    … {len(ranges) - args.max_byte_ranges} more changed byte ranges (increase --max-byte-ranges)"
        )


def diff(left: Image, right: Image, args: "Args") -> int:
    print(
        f"Payloads: {left.layout} / {right.layout}; {left.container} / {right.container}"
    )
    for label, image in (("Before", left), ("After", right)):
        for note in image.notes:
            print(f"{label}: {note}")
    if left.payload == right.payload:
        print("\nNo payload differences")
        return 0
    variable_heading = False
    for name in sorted(left.variables.keys() | right.variables.keys()):
        old, new = left.variables.get(name), right.variables.get(name)
        if old != new:
            if not variable_heading:
                print("\nOpen Firmware variable changes:")
                variable_heading = True
            print(
                f"  {name}: {variable_display(old) if old is not None else '(absent)'} -> {variable_display(new) if new is not None else '(absent)'}"
            )
    # Match fields by identity, not offset: CHRP partitions can move.
    before = {(r.group, r.name): r for r in left.records}
    after = {(r.group, r.name): r for r in right.records}
    for key in dict.fromkeys([*before, *after]):
        old, new = before.get(key), after.get(key)
        if old and new and old.data == new.data and old.offset == new.offset:
            continue
        print(f"\n{key[0]}: {key[1]}")
        if old:
            print(f"  - [{left.location(old)}] {old.display()}")
        if new:
            print(f"  + [{right.location(new)}] {new.display()}")
        if old and new and (old.raw or new.raw):
            if old.offset != new.offset:
                print(
                    "    Partition moved; byte offsets below use the original payload"
                )
            print_byte_changes(old.data, new.data, old.offset, args)
    count = sum(
        end - start for start, end in byte_change_ranges(left.payload, right.payload)
    )
    print(f"\n{count} differing payload bytes (backing headers excluded)")
    return 1


class Args(argparse.Namespace):
    left: pathlib.Path
    right: pathlib.Path | None
    layout: str
    max_byte_ranges: int
    max_bytes: int
    git_diff: tuple[str, bool, bool] | None = None


def parse_args() -> Args:
    argv, git_diff = sys.argv[1:], None
    if argv[:1] == ["--git"]:
        if len(argv) < 8:
            print(
                "Git diff mode expects: path old-file old-hex old-mode new-file new-hex new-mode",
                file=sys.stderr,
            )
            raise SystemExit(2)
        path, old_file, _old_id, old_mode, new_file, _new_id, new_mode = argv[1:8]
        git_diff = (
            path,
            old_file == "/dev/null" or old_mode == "000000",
            new_file == "/dev/null" or new_mode == "000000",
        )
        argv = [old_file, new_file]
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "left",
        type=pathlib.Path,
        help="PRAM/NVRAM file to dump, or original file to compare",
    )
    parser.add_argument(
        "right",
        type=pathlib.Path,
        nargs="?",
        help="Modified file; providing two paths enables diff mode",
    )
    parser.add_argument(
        "--layout",
        choices=("auto", "old-world", "new-world"),
        default="auto",
        help="NVRAM layout (default: detect; 256-byte files are always PRAM)",
    )
    parser.add_argument(
        "--max-byte-ranges",
        type=int,
        default=16,
        help="Maximum raw change ranges per region (default: 16)",
    )
    parser.add_argument(
        "--max-bytes",
        type=int,
        default=32,
        help="Maximum preview bytes per raw change range (default: 32)",
    )
    args = Args()
    parser.parse_args(argv, namespace=args)
    if args.max_byte_ranges < 1 or args.max_bytes < 1:
        parser.error("byte preview limits must be positive")
    args.git_diff = git_diff
    return args


def main() -> int:
    args = parse_args()
    try:
        if args.git_diff:
            path, old_missing, new_missing = args.git_diff
            print("--- /dev/null" if old_missing else f"--- a/{path}")
            print("+++ /dev/null" if new_missing else f"+++ b/{path}")
            if old_missing or new_missing:
                image_path = args.left
                if old_missing:
                    assert args.right is not None
                    image_path = args.right
                image = load_image(image_path, args.layout)
                print(f"{'Added' if old_missing else 'Removed'} {path}")
                dump(image)
                return 1
        left = load_image(args.left, args.layout)
        if args.right is None:
            dump(left)
            return 0
        right = load_image(args.right, args.layout)
        if not args.git_diff:
            print(f"--- {args.left}")
            print(f"+++ {args.right}")
        return diff(left, right, args)
    except (OSError, ValueError) as error:
        print(f"Unable to read PRAM/NVRAM: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
