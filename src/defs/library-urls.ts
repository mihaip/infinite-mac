import {type LibraryItemType} from "@/defs/library";

export function proxyUrl(url: string): string {
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

export function downloadUrl(file: string, type: LibraryItemType): string {
    return `https://download.macintoshgarden.org/${type}/${file}`;
}

export function manualUrl(file: string): string {
    return `https://download.macintoshgarden.org/manuals/${file}`;
}
