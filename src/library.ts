import {useEffect, useState} from "react";
import libraryIndex from "./Data/Library-index.json";

export const APPS_INDEX = unpackIndexItems(libraryIndex.apps, "apps");
export const GAMES_INDEX = unpackIndexItems(libraryIndex.games, "games");

export type LibraryIndexItem = {
    id: number;
    type: LibraryItemType;
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

export type LibraryItemType = "apps" | "games";

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
    X64_WINDOWS = 6,
    APPLE_SILICON = 7,
}

export const ARCHITECTURE_INDEX = {
    [Architecture.M68K]: "68K",
    [Architecture.PPC]: "PowerPC",
    [Architecture.PPC_CARBON]: "PowerPC (Carbon)",
    [Architecture.X86_INTEL_MAC]: "x86",
    [Architecture.X86_INTEL]: "x86",
    [Architecture.X86_WINDOWS]: "x86 (Windows)",
    [Architecture.X64_WINDOWS]: "x64 (Windows)",
    [Architecture.APPLE_SILICON]: "Apple Silicon",
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
    type: LibraryItemType
): LibraryIndexItem[] {
    const items: LibraryIndexItem[] = indexItems.map((indexItem, i) => {
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

    // Build search index in the background, so that it's ready when the user
    // starts typing in the search box.
    const itemsToSearchIndex = items.slice();
    const searchIndexMoreItems = () => {
        const startTime = performance.now();
        while (performance.now() - startTime < 8) {
            const item = itemsToSearchIndex.pop();
            if (!item) {
                return;
            }
            if (!item.index) {
                item.index = extractItemIndex(item);
            }
        }
        setTimeout(searchIndexMoreItems, 100);
    };
    setTimeout(searchIndexMoreItems, 100);

    return items;
}

function parseSearchQuery(query: string): Term[] {
    const terms: Term[] = [];
    const regex = /(\w+):"([^"]+)"|(\w+):(\S+)|"([^"]+)"|(\S+)/g;
    let match;

    query = query.toLowerCase();

    // Ensure we close any unclosed quotes, to be more resilient when we have a
    // partial query that the user is in the middle of typing.
    const quoteCount = (query.match(/"/g) ?? []).length;
    if (quoteCount % 2 !== 0) {
        query += '"';
    }

    while ((match = regex.exec(query)) !== null) {
        if (match[1] && match[2]) {
            terms.push({operator: match[1], value: match[2]}); // operator with quoted value
        } else if (match[3] && match[4]) {
            terms.push({operator: match[3], value: match[4]}); // operator with unquoted value
        } else if (match[5]) {
            terms.push({value: match[5]}); //quoted value without operator
        } else if (match[6]) {
            terms.push({value: match[6]}); //bare word without operator
        }
    }

    return terms;
}

type Term = {
    operator?: string; // missing if there's no operator
    value: string;
};

function termMatches(
    term: Term,
    item: LibraryIndexItem,
    index: string[]
): boolean {
    if (!term.operator) {
        return index.some(i => i.includes(term.value));
    }

    function matchesIndex(
        value: number[],
        index: {[key: number]: string}
    ): boolean {
        return value.some(v => index[v].toLowerCase().includes(term.value));
    }

    switch (term.operator) {
        case "year":
            // Allow prefix matches for years, so that you can search for things
            // from the 80s/90s/2000s
            return item.year?.toString().includes(term.value) === true;
        case "title":
            return item.title.toLowerCase().includes(term.value);
        case "author":
            return (
                item.authors.some(a => a.toLowerCase().includes(term.value)) ||
                item.publishers.some(p => p.toLowerCase().includes(term.value))
            );
        case "category":
            return (
                matchesIndex(item.categories, CATEGORIES_INDEX) ||
                matchesIndex(item.perspectives, PERSPECTIVE_INDEX)
            );
        case "system":
        case "os":
            return matchesIndex(item.systems, SYSTEM_INDEX);
        case "architecture":
        case "arch":
            // Support this alias
            if (term.value === "ppc") {
                term.value = "powerpc";
            }
            return matchesIndex(item.architectures, ARCHITECTURE_INDEX);
    }

    return false;
}

export function createSearchPredicate(
    search: string
): (item: LibraryIndexItem) => boolean {
    const terms = parseSearchQuery(search);

    return item => {
        let {index} = item;
        if (!index) {
            index = item.index = extractItemIndex(item);
        }
        return terms.every(term => termMatches(term, item, index));
    };
}

function extractItemIndex(item: LibraryIndexItem): string[] {
    return [
        item.title,
        ...item.authors,
        ...item.publishers,
        ...item.categories.map(c => CATEGORIES_INDEX[c]),
        ...(item.year ? [item.year.toString()] : []),
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
    const url = `/Library/details?type=${item.type}&id=${item.id}&h=${libraryIndex.hash}`;
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
