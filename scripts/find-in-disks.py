#!/usr/bin/env python3

import argparse
import disks
import sys

import machfs
from machfs.directory import AbstractFolder

def parse_args():
    parser = argparse.ArgumentParser(
        description="Find HFS paths in Macintosh disk images."
    )
    parser.add_argument(
        "terms",
        nargs="+",
        help="Case-insensitive substrings to match against full HFS paths.",
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
    return parser.parse_args()


def load_volume(disk: disks.Disk) -> machfs.Volume:
    volume = machfs.Volume()
    volume.read(disk.read())
    return volume


def hfs_path(volume_name: str, path_parts: list[str]) -> str:
    if path_parts:
        return ":".join((volume_name, *path_parts))
    return volume_name


def iter_matches(volume, terms):
    lowered_terms = [term.casefold() for term in terms]
    for path_parts, obj in volume.iter_paths():
        path = hfs_path(volume.name, path_parts)
        if any(term in path.casefold() for term in lowered_terms):
            kind = "dir" if isinstance(obj, AbstractFolder) else "file"
            yield kind, path


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

        matches = list(iter_matches(volume, args.terms))
        if not matches:
            print(f"{disk.name}: no matches")
            continue

        print(disk.name)
        for kind, path in matches:
            print(f"  [{kind}] {path}")

    return 1 if args.strict and skipped else 0


if __name__ == "__main__":
    raise SystemExit(main())
