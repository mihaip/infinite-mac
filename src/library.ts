import {useEffect, useState} from "react";
import libraryIndex from "./Data/Library-index.json";

export const APPS_INDEX = unpackIndexItems(libraryIndex.apps, "apps");
export const GAMES_INDEX = unpackIndexItems(libraryIndex.games, "games");

export type LibraryIndexItem = {
    id: number;
    type: ItemType;
    title: string;
    authors: string[];
    year?: number;
    systems: System[];
    architectures: Architecture[];
    categories: CategoryIndex[];
    perspectives: PerspectiveIndex[];
    publishers: string[];

    // Private, used as a cache for searching
    index?: string[];
};

type ItemType = "apps" | "games";

const enum System {
    SYSTEM_1 = 1,
    SYSTEM_6 = 6,
    SYSTEM_7 = 7,
    MAC_OS_8 = 8,
    MAC_OS_8_5 = 8.5,
    MAC_OS_9 = 9,
    MAC_OS_X = 10,
}

export const SYSTEM_INDEX = {
    [System.SYSTEM_1]: "System 1",
    [System.SYSTEM_6]: "System 6",
    [System.SYSTEM_7]: "System 7",
    [System.MAC_OS_8]: "Mac OS 8",
    [System.MAC_OS_8_5]: "Mac OS 8.5",
    [System.MAC_OS_9]: "Mac OS 9",
    [System.MAC_OS_X]: "Mac OS X",
};

const enum Architecture {
    M68K = 0,
    PPC = 1,
    PPC_CARBON = 2,
    X86_INTEL_MAC = 3,
    X86_INTEL = 4,
    X86_WINDOWS = 5,
}

export const ARCHITECTURE_INDEX = {
    [Architecture.M68K]: "68K",
    [Architecture.PPC]: "PowerPC",
    [Architecture.PPC_CARBON]: "PowerPC (Carbon)",
    [Architecture.X86_INTEL_MAC]: "x86",
    [Architecture.X86_INTEL]: "x86",
    [Architecture.X86_WINDOWS]: "x86 (Windows)",
};

type CategoryIndex = number;

export const CATEGORIES_INDEX = [
    "3D Rendering & CAD",
    "Action",
    "Adventure",
    "Antivirus",
    "Arcade",
    "Board Game",
    "Books & Multimedia",
    "Business & Productivity",
    "Card & Casino",
    "Clip Art",
    "Compression & Archiving",
    "Contextual Menu Modules",
    "Control Panels & Extensions",
    "Creative",
    "Database",
    "Development Tools",
    "Drivers & Hardware Support",
    "Early Childhood",
    "Educational",
    "Emulators",
    "Encryption & Security",
    "FPS",
    "Flight Simulation",
    "Fonts",
    "Game Compilations",
    "Game Editors & Tools",
    "HyperCard",
    "Icons",
    "Imaging & Burning",
    "Interactive Fiction",
    "Internet & Communications",
    "Lisa",
    "Mac Info & Literature",
    "Music & Sound",
    "Novelties & Fun",
    "Operating Systems",
    "Pinball",
    "Plug-ins",
    "Puzzle",
    "RPG",
    "Racing",
    "Reference",
    "Science & Math",
    "Screen Savers",
    "Simulation",
    "Software Compilations",
    "Sports",
    "Spreadsheet",
    "Strategy",
    "Trivia",
    "Utilities",
    "Video",
    "Visual Arts & Graphics",
    "Widgets",
    "Word Processing & Publishing",
    "World Builder",
];

type PerspectiveIndex = number;

export const PERSPECTIVE_INDEX = [
    "1st Person",
    "1st Person + 3rd Person",
    "3rd Person",
    "FMV",
    "Hexagonal Grid",
    "Isometric",
    "Platform",
    "Point & Click",
    "Side Scrolling",
    "Text",
    "Text + Illustrations",
    "Top Down",
    "Vertical Scrolling",
];

function unpackIndexItems(
    indexItems: any[],
    type: ItemType
): LibraryIndexItem[] {
    return indexItems.map((indexItem, i) => {
        const [
            title,
            authors,
            year,
            systems,
            architectures,
            categories,
            publishers,
            perspectives,
        ] = indexItem;
        return {
            id: i,
            type,
            title: title ?? "",
            authors: authors ?? [],
            year,
            systems: systems ?? [],
            architectures: architectures ?? [],
            categories: categories ?? [],
            publishers: publishers ?? [],
            perspectives: perspectives ?? [],
        };
    });
}

export function createSearchPredicate(
    search: string
): (item: LibraryIndexItem) => boolean {
    const terms = search.toLowerCase().split(/\s+/);

    return item => {
        let {index} = item;
        if (!index) {
            index = item.index = extractItemIndex(item);
        }
        return terms.every(term => index.some(i => i.includes(term)));
    };
}

function extractItemIndex(item: LibraryIndexItem): string[] {
    return [
        item.title,
        ...item.authors,
        ...item.publishers,
        ...item.categories.map(c => CATEGORIES_INDEX[c]),
    ].map(s => s.toLowerCase());
}

// Matches the JSON type returned by `handleDetails` handler in
// `workers-site/library.ts`
export type LibraryDetailsItem = {
    url: string;
    files: {[url: string]: number};
    description?: string;
    screenshots: string[];
    manuals: {[url: string]: number};
    composers: string[];
    externalDownloadUrl?: string;
};

export function useLibraryItemDetails(
    item: LibraryIndexItem
): LibraryDetailsItem | undefined {
    const [detailsItem, setDetailsItem] = useState<
        LibraryDetailsItem | undefined
    >();

    useEffect(() => {
        fetchItemDetails(item, setDetailsItem);
    }, [item]);

    return detailsItem;
}

async function fetchItemDetails(
    item: LibraryIndexItem,
    setDetailsItem: (item: LibraryDetailsItem | undefined) => void
) {
    const url = `/Library/details?type=${item.type}&id=${item.id}`;
    const cached = itemDetailsCache.get(url);
    if (cached) {
        setDetailsItem(cached);
        return;
    }

    setDetailsItem(undefined);

    const response = await fetch(url);
    const details = (await response.json()) as LibraryDetailsItem;
    itemDetailsCache.set(url, details);
    setDetailsItem(details);
}

const itemDetailsCache = new Map<string, LibraryDetailsItem>();

function proxyUrl(url: string): string {
    return `/Library/proxy?url=${encodeURIComponent(url)}`;
}

export function screenshotThumbnailUrl(screenshot: string): string {
    return proxyUrl(
        `https://macintoshgarden.org/sites/macintoshgarden.org/files/imagecache/thumbnail/screenshots/${screenshot}`
    );
}

export function screenshotUrl(screenshot: string): string {
    return proxyUrl(
        `https://macintoshgarden.org/sites/macintoshgarden.org/files/screenshots/${screenshot}`
    );
}

export function downloadUrl(file: string, type: ItemType): string {
    return proxyUrl(
        `https://macintoshgarden.org/sites/macintoshgarden.org/files/${type}/${file}`
    );
}
