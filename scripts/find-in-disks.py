#!/usr/bin/env python3

import argparse
import sys

import disks
import machfs
import macresources
from machfs.directory import AbstractFolder


def parse_args():
    parser = argparse.ArgumentParser(
        description="Find HFS paths in Macintosh disk images."
    )
    parser.add_argument(
        "terms",
        nargs="+",
        help=(
            "Case-insensitive strings to match against full HFS paths. "
            "Defaults to substring matching."
        ),
    )
    parser.add_argument(
        "--exact",
        action="store_true",
        help="Require a complete HFS path to equal one of the terms.",
    )
    parser.add_argument(
        "--disk-filter",
        "-f",
        action="append",
        dest="disk_filters",
        help="Case-insensitive substrings of disk names to scan. Defaults to all disk images.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return a non-zero status if any image cannot be read.",
    )
    parser.add_argument(
        "--resource-type",
        metavar="TYPE",
        help="Check matched files for a resource with this four-character type.",
    )
    parser.add_argument(
        "--resource-id",
        type=int,
        metavar="ID",
        help="Check matched files for a resource with this signed 16-bit ID.",
    )
    args = parser.parse_args()

    if (args.resource_type is None) != (args.resource_id is None):
        parser.error("--resource-type and --resource-id must be used together")

    if args.resource_type is not None:
        try:
            args.resource_type = args.resource_type.encode("mac_roman")
        except UnicodeEncodeError:
            parser.error("--resource-type must be encodable as MacRoman")
        if len(args.resource_type) != 4:
            parser.error("--resource-type must be exactly four bytes")
        if not -32768 <= args.resource_id <= 32767:
            parser.error("--resource-id must be between -32768 and 32767")

    return args


def load_volume(disk: disks.Disk) -> machfs.Volume:
    volume = machfs.Volume()
    volume.read(disk.read())
    return volume


def hfs_path(volume_name: str, path_parts: list[str]) -> str:
    if path_parts:
        return ":".join((volume_name, *path_parts))
    return volume_name


def iter_matches(volume, terms, exact=False):
    lowered_terms = [term.casefold() for term in terms]
    for path_parts, obj in volume.iter_paths():
        path = hfs_path(volume.name, path_parts)
        lowered_path = path.casefold()
        if exact:
            matched = lowered_path in lowered_terms
        else:
            matched = any(term in lowered_path for term in lowered_terms)
        if matched:
            kind = "dir" if isinstance(obj, AbstractFolder) else "file"
            yield kind, path, obj


def resource_status(obj, resource_type: bytes, resource_id: int) -> str:
    if isinstance(obj, AbstractFolder):
        return "not a file"

    try:
        for resource in macresources.parse_file(obj.rsrc):
            if resource.type == resource_type and resource.id == resource_id:
                return "present"
    except Exception as error:
        return f"could not parse resource fork: {error}"

    return "missing"


def main():
    args = parse_args()

    if args.disk_filters:
        matched_disks = []
        lowered_filters = [f.casefold() for f in args.disk_filters]
        for disk in disks.ALL_DISKS:
            if any(term in disk.name.casefold() for term in lowered_filters):
                matched_disks.append(disk)
    else:
        matched_disks = disks.ALL_DISKS

    if not matched_disks:
        print("No disks found.", file=sys.stderr)
        return 1

    skipped = False
    for disk in matched_disks:
        try:
            volume = load_volume(disk)
        except Exception as e:
            print(f"{disk.name}: skipped: {e}", file=sys.stderr)
            skipped = True
            continue

        matches = list(iter_matches(volume, args.terms, exact=args.exact))
        if not matches:
            print(f"{disk.name}: no matches")
            continue

        print(disk.name)
        for kind, path, obj in matches:
            suffix = ""
            if args.resource_type is not None:
                resource_type = args.resource_type.decode("mac_roman")
                status = resource_status(obj, args.resource_type, args.resource_id)
                suffix = f"; resource {resource_type!r} ({args.resource_id}): {status}"
            print(f"  [{kind}] {path}{suffix}")

    return 1 if args.strict and skipped else 0


if __name__ == "__main__":
    raise SystemExit(main())
