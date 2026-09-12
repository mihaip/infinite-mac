#!/usr/bin/env python3

import argparse
import datetime
import hashlib
import pathlib
import sys

import machfs
from machfs.directory import AbstractFolder
from macresources import parse_file


MAC_EPOCH = datetime.datetime(1904, 1, 1, tzinfo=datetime.timezone.utc)
DATE_FIELDS = ("crdate", "mddate", "bkdate")
CATALOG_FIELDS = (
    "type",
    "creator",
    "flags",
    "x",
    "y",
    "locked",
    "usrInfo",
    "fndrInfo",
)


def is_missing_git_side(path: str, mode: str) -> bool:
    return path == "/dev/null" or mode == "000000"


def parse_args():
    argv = sys.argv[1:]
    git_diff = None
    if argv[:1] == ["--git"]:
        if len(argv) < 8:
            raise SystemExit(
                "Git diff mode expects: path old-file old-hex old-mode "
                "new-file new-hex new-mode"
            )
        (
            display_path,
            old_file,
            _old_object_id,
            old_mode,
            new_file,
            _new_object_id,
            new_mode,
        ) = argv[1:8]
        git_diff = {
            "path": display_path,
            "old_missing": is_missing_git_side(old_file, old_mode),
            "new_missing": is_missing_git_side(new_file, new_mode),
        }
        argv = [old_file, new_file]

    parser = argparse.ArgumentParser(
        description=(
            "Compare the files, forks, resources, and catalog metadata in two "
            "HFS disk images. Returns 1 when differences are found."
        )
    )
    parser.add_argument("left", type=pathlib.Path, help="Original HFS disk image.")
    parser.add_argument("right", type=pathlib.Path, help="Modified HFS disk image.")
    parser.add_argument(
        "--path",
        "-p",
        action="append",
        dest="path_filters",
        help=(
            "Only show HFS paths containing this case-insensitive substring. "
            "May be repeated."
        ),
    )
    parser.add_argument(
        "--content-only",
        action="store_true",
        help="Ignore Finder and catalog metadata.",
    )
    parser.add_argument(
        "--dates",
        action="store_true",
        help=(
            "Include creation, modification, and backup dates in metadata "
            "comparisons."
        ),
    )
    parser.add_argument(
        "--ignore-desktop-files",
        action="store_true",
        help="Let machfs omit Desktop, Desktop DB, and Desktop DF while reading.",
    )
    parser.add_argument(
        "--max-byte-ranges",
        type=int,
        default=16,
        metavar="N",
        help="Maximum byte-change ranges shown per fork or resource (default: 16).",
    )
    parser.add_argument(
        "--max-bytes",
        type=int,
        default=32,
        metavar="N",
        help="Maximum bytes shown on each side of a byte-change range (default: 32).",
    )
    parser.add_argument(
        "--max-resource-diffs",
        type=int,
        default=64,
        metavar="N",
        help=(
            "Maximum logical resource changes shown per resource fork (default: 64; "
            "use 0 for unlimited)."
        ),
    )
    parser.add_argument(
        "--resource-type",
        "-r",
        action="append",
        dest="resource_types",
        metavar="TYPE",
        help="Only show logical resource changes of this four-character type.",
    )
    args = parser.parse_args(argv)
    if args.max_byte_ranges < 0 or args.max_bytes < 0 or args.max_resource_diffs < 0:
        parser.error("diff limits must be non-negative")
    encoded_resource_types = set()
    for resource_type in args.resource_types or ():
        try:
            encoded = resource_type.encode("mac_roman")
        except UnicodeEncodeError:
            parser.error(f"resource type is not MacRoman: {resource_type!r}")
        if len(encoded) != 4:
            parser.error(f"resource type must be exactly four bytes: {resource_type!r}")
        encoded_resource_types.add(encoded)
    args.resource_types = encoded_resource_types
    args.git_diff = git_diff
    return args


def read_hfs_image(path: pathlib.Path) -> bytes:
    data = path.read_bytes()

    # Disk Copy 4.2 wraps the raw disk data in an 84-byte header, followed by
    # an optional tag-data section. The data and tag lengths are big-endian
    # 32-bit values at offsets 64 and 68.
    if len(data) >= 84:
        data_size = int.from_bytes(data[64:68], "big")
        tag_size = int.from_bytes(data[68:72], "big")
        if data_size and 84 + data_size + tag_size == len(data):
            raw_data = data[84 : 84 + data_size]
            if len(raw_data) >= 1026 and raw_data[1024:1026] == b"BD":
                return raw_data

    return data


def load_volume(path: pathlib.Path, preserve_desktopdb: bool) -> machfs.Volume:
    volume = machfs.Volume()
    volume.read(read_hfs_image(path), preserve_desktopdb=preserve_desktopdb)
    return volume


def hfs_path(volume_name: str, path_parts: tuple[str, ...]) -> str:
    return ":".join((volume_name, *path_parts))


def path_key(path_parts: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(part.casefold() for part in path_parts)


def volume_index(volume: machfs.Volume):
    return {path_key(path): (path, obj) for path, obj in volume.iter_paths()}


def object_kind(obj) -> str:
    return "folder" if isinstance(obj, AbstractFolder) else "file"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:12]


def data_summary(data: bytes) -> str:
    return f"{len(data)} bytes, sha256 {digest(data)}"


def hex_preview(data: bytes, limit: int) -> str:
    shown = data[:limit]
    result = shown.hex(" ").upper() or "(empty)"
    if len(data) > len(shown):
        result += f" … (+{len(data) - len(shown)} bytes)"
    return result


def byte_change_ranges(before: bytes, after: bytes):
    if len(before) == len(after):
        offset = 0
        while offset < len(before):
            if before[offset] == after[offset]:
                offset += 1
                continue
            start = offset
            while offset < len(before) and before[offset] != after[offset]:
                offset += 1
            yield start, before[start:offset], after[start:offset]
        return

    prefix = 0
    common_length = min(len(before), len(after))
    while prefix < common_length and before[prefix] == after[prefix]:
        prefix += 1

    suffix = 0
    max_suffix = common_length - prefix
    while (
        suffix < max_suffix
        and before[len(before) - suffix - 1] == after[len(after) - suffix - 1]
    ):
        suffix += 1

    before_end = len(before) - suffix if suffix else len(before)
    after_end = len(after) - suffix if suffix else len(after)
    yield prefix, before[prefix:before_end], after[prefix:after_end]


def print_byte_changes(before: bytes, after: bytes, args, indent: str):
    ranges = list(byte_change_ranges(before, after))
    shown_ranges = ranges[: args.max_byte_ranges]
    for offset, old, new in shown_ranges:
        print(f"{indent}@0x{offset:04X}: {hex_preview(old, args.max_bytes)}")
        print(f"{indent}         -> {hex_preview(new, args.max_bytes)}")
    if len(ranges) > len(shown_ranges):
        print(f"{indent}… {len(ranges) - len(shown_ranges)} more byte ranges")


def fourcc(value: bytes) -> str:
    try:
        return repr(value.decode("mac_roman"))
    except (AttributeError, UnicodeDecodeError):
        return repr(value)


def resource_map(resource_fork: bytes):
    return {
        (bytes(resource.type), resource.id): resource
        for resource in parse_file(resource_fork)
    }


def resource_label(key, resource) -> str:
    resource_type, resource_id = key
    label = f"{fourcc(resource_type)} ({resource_id})"
    if resource.name is not None:
        label += f" {resource.name!r}"
    return label


def print_resource_changes(before: bytes, after: bytes, args, indent: str):
    try:
        left = resource_map(before)
        right = resource_map(after)
    except Exception as error:
        print(f"{indent}Could not parse resource fork: {error}")
        print_byte_changes(before, after, args, indent)
        return

    changes = []
    for key in sorted(left.keys() | right.keys()):
        if key not in left:
            changes.append(("added", key))
        elif key not in right:
            changes.append(("removed", key))
        else:
            old = left[key]
            new = right[key]
            if (
                bytes(old.data) != bytes(new.data)
                or old.name != new.name
                or old.attribs != new.attribs
            ):
                changes.append(("changed", key))

    if not changes:
        print(f"{indent}Logical resources are unchanged (fork layout differs).")
        return

    if args.resource_types:
        changes = [change for change in changes if change[1][0] in args.resource_types]
        if not changes:
            print(f"{indent}No matching logical resource changes.")
            return

    limit = args.max_resource_diffs or len(changes)
    for change, key in changes[:limit]:
        if change == "added":
            resource = right[key]
            print(
                f"{indent}+ resource {resource_label(key, resource)}: "
                f"{data_summary(bytes(resource.data))}"
            )
        elif change == "removed":
            resource = left[key]
            print(
                f"{indent}- resource {resource_label(key, resource)}: "
                f"{data_summary(bytes(resource.data))}"
            )
        else:
            old = left[key]
            new = right[key]
            print(f"{indent}resource {resource_label(key, new)}:")
            if old.name != new.name:
                print(f"{indent}  name: {old.name!r} -> {new.name!r}")
            if old.attribs != new.attribs:
                print(
                    f"{indent}  attributes: 0x{old.attribs:02X} -> "
                    f"0x{new.attribs:02X}"
                )
            old_data = bytes(old.data)
            new_data = bytes(new.data)
            if old_data != new_data:
                print(
                    f"{indent}  data: {data_summary(old_data)} -> "
                    f"{data_summary(new_data)}"
                )
                print_byte_changes(old_data, new_data, args, indent + "    ")

    if len(changes) > limit:
        print(f"{indent}… {len(changes) - limit} more resource changes")


def format_metadata_value(field: str, value) -> str:
    if field in DATE_FIELDS:
        try:
            date = MAC_EPOCH + datetime.timedelta(seconds=value)
            return f"{value} ({date.isoformat()})"
        except (OverflowError, TypeError):
            return repr(value)
    if field in ("type", "creator"):
        return fourcc(value)
    if field in ("flags",):
        return f"0x{value:04X}"
    if isinstance(value, (bytes, bytearray)):
        return bytes(value).hex(" ").upper()
    return repr(value)


def metadata_changes(left, right, args):
    if args.content_only:
        return []
    fields = list(CATALOG_FIELDS)
    if args.dates:
        fields.extend(DATE_FIELDS)
    changes = []
    for field in fields:
        if not hasattr(left, field) or not hasattr(right, field):
            continue
        old = getattr(left, field)
        new = getattr(right, field)
        if old != new:
            changes.append((field, old, new))
    return changes


def path_matches(path: str, filters: list[str] | None) -> bool:
    if not filters:
        return True
    lowered_path = path.casefold()
    return any(term.casefold() in lowered_path for term in filters)


def print_added_or_removed(prefix: str, volume_name: str, path, obj):
    description = object_kind(obj)
    if description == "file":
        description += (
            f", data={len(obj.data)} bytes, resource={len(obj.rsrc)} bytes"
        )
    print(f"{prefix} {hfs_path(volume_name, path)} [{description}]")


def main():
    args = parse_args()
    if args.git_diff:
        display_path = args.git_diff["path"]
        if args.git_diff["old_missing"]:
            print("--- /dev/null")
            print(f"+++ b/{display_path}")
            print(f"HFS disk added: {display_path} ({args.right.stat().st_size} bytes)")
            return 1
        if args.git_diff["new_missing"]:
            print(f"--- a/{display_path}")
            print("+++ /dev/null")
            print(f"HFS disk removed: {display_path} ({args.left.stat().st_size} bytes)")
            return 1

    try:
        left_volume = load_volume(
            args.left, preserve_desktopdb=not args.ignore_desktop_files
        )
        right_volume = load_volume(
            args.right, preserve_desktopdb=not args.ignore_desktop_files
        )
    except Exception as error:
        print(f"Unable to read HFS volumes: {error}", file=sys.stderr)
        return 2

    if args.git_diff:
        print(f"--- a/{args.git_diff['path']}")
        print(f"+++ b/{args.git_diff['path']}")
    else:
        print(f"--- {args.left}")
        print(f"+++ {args.right}")

    left = volume_index(left_volume)
    right = volume_index(right_volume)
    difference_count = 0

    if left_volume.name != right_volume.name:
        print(f"volume name: {left_volume.name!r} -> {right_volume.name!r}")
        difference_count += 1

    for key in sorted(left.keys() | right.keys()):
        left_entry = left.get(key)
        right_entry = right.get(key)
        display_path = left_entry[0] if left_entry else right_entry[0]
        volume_name = left_volume.name if left_entry else right_volume.name
        full_path = hfs_path(volume_name, display_path)
        if not path_matches(full_path, args.path_filters):
            continue

        if left_entry is None:
            print_added_or_removed("+", right_volume.name, *right_entry)
            difference_count += 1
            continue
        if right_entry is None:
            print_added_or_removed("-", left_volume.name, *left_entry)
            difference_count += 1
            continue

        left_path, left_obj = left_entry
        right_path, right_obj = right_entry
        changes = []
        if left_path != right_path:
            changes.append(("path", left_path, right_path))
        if object_kind(left_obj) != object_kind(right_obj):
            print(
                f"! {full_path}: {object_kind(left_obj)} -> {object_kind(right_obj)}"
            )
            difference_count += 1
            continue

        data_changed = (
            not isinstance(left_obj, AbstractFolder)
            and bytes(left_obj.data) != bytes(right_obj.data)
        )
        resource_changed = (
            not isinstance(left_obj, AbstractFolder)
            and bytes(left_obj.rsrc) != bytes(right_obj.rsrc)
        )
        changes.extend(metadata_changes(left_obj, right_obj, args))
        if not data_changed and not resource_changed and not changes:
            continue

        print(f"M {full_path} [{object_kind(left_obj)}]")
        difference_count += 1
        if data_changed:
            old_data = bytes(left_obj.data)
            new_data = bytes(right_obj.data)
            print(f"  data fork: {data_summary(old_data)} -> {data_summary(new_data)}")
            print_byte_changes(old_data, new_data, args, "    ")
        if resource_changed:
            old_resource = bytes(left_obj.rsrc)
            new_resource = bytes(right_obj.rsrc)
            print(
                f"  resource fork: {data_summary(old_resource)} -> "
                f"{data_summary(new_resource)}"
            )
            print_resource_changes(old_resource, new_resource, args, "    ")
        for field, old, new in changes:
            if field == "path":
                old_value = hfs_path(left_volume.name, old)
                new_value = hfs_path(right_volume.name, new)
            else:
                old_value = format_metadata_value(field, old)
                new_value = format_metadata_value(field, new)
            print(f"  {field}: {old_value} -> {new_value}")

    if difference_count:
        print(f"\n{difference_count} differing HFS paths")
        return 1

    print("\nNo differences")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
