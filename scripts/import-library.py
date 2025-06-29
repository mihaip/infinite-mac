#!/usr/bin/env python3

import enum
import glob
import json
import os.path
import paths
import sys
import typing

# Should be sorted in rough order of commonality, so that items with only common
# fields will end up with shorter arrays.
class Field(enum.Enum):
    TITLE = 0
    AUTHORS = 1
    YEAR = 2
    SYSTEMS = 3
    ARCHITECTURES = 4
    CATEGORIES = 5
    PUBLISHERS = 6
    PERSPECTIVE = 7 # Only present for games

    URL = 0
    FILES = 1
    DESCRIPTION = 2
    SCREENSHOTS = 3
    MANUALS = 4
    COMPOSERS = 5
    EXTERNAL_DOWNLOAD_URL = 6 # Rarest

OutputItem = list[typing.Any]

def to_output(src: dict[Field, typing.Any]) -> OutputItem:
    output_item = []
    for field, value in src.items():
        if not value:
            continue
        if field.value >= len(output_item):
            for _ in range(len(output_item), field.value + 1):
                output_item.append(None)
        output_item[field.value] = value
    return output_item

class Item(typing.NamedTuple):
    title: str
    authors: list[str]
    year: int
    systems: list[int]
    architectures: list[int]
    categories: list[int]
    perspectives: list[int]
    publishers: list[str]

    url: str
    files: dict[str, int]
    description: str
    screenshots: list[str]
    composers: list[str]
    external_download_url: str
    manuals: dict[str, int]

    def to_index_output(self) -> OutputItem:
        return to_output({
            Field.TITLE: self.title,
            Field.AUTHORS: self.authors,
            Field.YEAR: self.year,
            Field.SYSTEMS: self.systems,
            Field.ARCHITECTURES: self.architectures,
            Field.CATEGORIES: self.categories,
            Field.PUBLISHERS: self.publishers,
            Field.PERSPECTIVE: self.perspectives,
        })

    def to_details_output(self):
        return to_output({
            Field.URL: self.url,
            Field.FILES: self.files,
            Field.DESCRIPTION: self.description,
            Field.SCREENSHOTS: self.screenshots,
            Field.MANUALS: self.manuals,
            Field.COMPOSERS: self.composers,
            Field.EXTERNAL_DOWNLOAD_URL: self.external_download_url,
        })

def load_library(import_dir: str) -> tuple[list[Item], list[Item]]:
    app_items = []
    game_items = []

    for item_path in glob.iglob(os.path.join(import_dir, "**", "*.json"), recursive=True):
        with open(item_path, "r") as item_file:
            item_json = json.load(item_file)

        if "app" in item_json:
            item_json = item_json["app"]
            items = app_items
        elif "game" in item_json:
            item_json = item_json["game"]
            items = game_items
        else:
            print("Item %s has an unexpected structure: %s" % (item_path, json.dumps(item_json)))
            return 1

        categories = []
        for c in item_json.get("category", item_json.get("category_app", [])):
            categories.append(CATEGORY_MAP[c])
        perspectives = []
        for p in item_json.get("perspective", []):
            perspectives.append(PERSPECTIVE_MAP[p])

        authors = item_json.get("author")
        publishers = item_json.get("publisher")
        if authors and authors == publishers:
            # Don't repeat the publisher as the author
            publishers = None
        elif publishers and not authors:
            # Prefer to use the "authors" field (since that's shown in the list
            # view) for cases where we only know the publisher (e.g. things made
            # by Apple).
            authors = publishers
            publishers = None

        description = item_json.get("description", "").strip()
        description_paragraphs = description.split("\r\n\r\n")
        description = f"<p>{'</p><p>'.join(description_paragraphs)}</p>"
        description = description.replace("\r\n", "<br>")
        if len(description) > 4096:
            description = description[0:4096] + "…"

        year = None
        if item_json.get("year"):
            year = int(item_json["year"])

        item = Item(
            url=item_json["url_alias"],
            title=item_json["title"],
            categories=categories,
            external_download_url=item_json.get("external_download_url"),
            perspectives=perspectives,
            composers=item_json.get("composers"),
            description=description,
            authors=authors,
            publishers=publishers,
            files={f["filename"]: f["filesize"] for f in item_json.get("files", [])},
            manuals={m["filename"]: m["filesize"] for m in item_json.get("manuals", [])},
            screenshots=[s["filename"] for s in item_json.get("screenshots", [])],
            year=year,
            systems=[SYSTEM_MAP[s] for s in item_json["system"] if s],
            architectures=[ARCHITECTURE_MAP[a] for a in item_json["architecture"] if a],
        )

        items.append(item)
    return app_items, game_items

def main():
    if len(sys.argv) != 2:
        print(f'Usage: {sys.argv[0]} <directory>', file=sys.stderr)
        print(f'    "placeholder" may be used as a dummy directory value to '
              'generate a stub file', file=sys.stderr)
        return 1
    import_dir = sys.argv[1]

    if import_dir != "placeholder":
        app_items, game_items = load_library(import_dir)
    else:
        app_items, game_items = [], []

    # The URL slug has been normalized to remove punctuation and other
    # characters. We ignore the first path component since a few games were
    # initially categorized as apps and vice-versa.
    item_sort_key = lambda item: item.url.split("/")[-1]
    app_items = list(sorted(app_items, key=item_sort_key))
    game_items = list(sorted(game_items, key=item_sort_key))

    with open(os.path.join(paths.DATA_DIR, "Library-index.json"), "w") as f:
        json.dump({
            "apps": [a.to_index_output() for a in app_items],
            "games": [a.to_index_output() for a in game_items],
        }, f, separators=(",", ":"))
    with open(os.path.join(paths.WORKER_DIR, "Library-details.json"), "w") as f:
        json.dump({
            "apps": [a.to_details_output() for a in app_items],
            "games": [a.to_details_output() for a in game_items],
        }, f, separators=(",", ":"))


    return 0


SYSTEM_MAP ={
    'Mac OS 1 - 5': 1,
    'Mac OS 6': 6,
    'Mac OS 7': 7,
    'Mac OS 8.5': 8.5,
    'Mac OS 8': 8,
    'Mac OS 9': 9,
    'Mac OS X': 10,
}

ARCHITECTURE_MAP = {
    '68k': 0,
    'PPC': 1,
    'PPC (Carbonized)': 2,
    'x86 (Intel:Mac)': 3,
    'x64 (Intel:Mac)': 3,
    'x86 (Intel)': 4,
    'x86 (Windows)': 5,
    'x64 (Windows)': 6,
    'ARM (Apple Silicon)': 7,
}

CATEGORY_MAP = {
    "3D Rendering & CAD": 0,
    "Action": 1,
    "Adventure": 2,
    "Antivirus": 3,
    "Arcade": 4,
    "Board Game": 5,
    "Books & Multimedia": 6,
    "Business & Productivity": 7,
    "Card & Casino": 8,
    "Clip Art": 9,
    "Compression & Archiving": 10,
    "Contextual Menu Modules": 11,
    "Control Panels & Extensions": 12,
    "Creative": 13,
    "Database": 14,
    "Development Tools": 15,
    "Drivers & Hardware Support": 16,
    "Early Childhood": 17,
    "Educational": 18,
    "Emulators": 19,
    "Encryption & Security": 20,
    "FPS": 21,
    "Flight Simulation": 22,
    "Fonts": 23,
    "Game Compilations": 24,
    "Game Editors & Tools": 25,
    "HyperCard": 26,
    "Icons": 27,
    "Imaging & Burning": 28,
    "Interactive Fiction": 29,
    "Internet & Communications": 30,
    "Lisa": 31,
    "Mac Info & Literature": 32,
    "Music & Sound": 33,
    "Novelties & Fun": 34,
    "Operating Systems": 35,
    "Pinball": 36,
    "Plug-ins": 37,
    "Puzzle": 38,
    "RPG": 39,
    "Racing": 40,
    "Reference": 41,
    "Science & Math": 42,
    "Screen Savers": 43,
    "Simulation": 44,
    "Software Compilations": 45,
    "Sports": 46,
    "Spreadsheet": 47,
    "Strategy": 48,
    "Trivia": 49,
    "Utilities": 50,
    "Video": 51,
    "Visual Arts & Graphics": 52,
    "Widgets": 53,
    "Word Processing & Publishing": 54,
    "World Builder": 55,
}

PERSPECTIVE_MAP = {
    "1st Person": 0,
    "1st Person + 3rd Person": 1,
    "3rd Person": 2,
    "FMV": 3,
    "Hexagonal Grid": 4,
    "Isometric": 5,
    "Platform": 6,
    "Point & Click": 7,
    "Side Scrolling": 8,
    "Text": 9,
    "Text + Illustrations": 10,
    "Top Down": 11,
    "Vertical Scrolling": 12,
}


if __name__ == "__main__":
    sys.exit(main())
