import {
    type EmulatorCDROMLibrary,
    type EmulatorCDROM,
} from "./emulator/emulator-common";
import * as varz from "./varz";
import cdromsManifest from "./Data/CD-ROMs.json";

export const cdromLibrary: EmulatorCDROMLibrary = cdromsManifest as any;

export const systemCDROMs = Object.entries(cdromLibrary)
    .filter(
        ([path, entry]) =>
            path.startsWith("System Software/") &&
            !path.startsWith("System Software/Compilations/")
    )
    .map(([path, entry]) => entry)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}))
    .sort(systemCDROMCompare);

enum SystemSoftwareEra {
    CLASSIC = 0,
    NEXT,
    RHAPSODY,
    MAC_OS_X_SERVER,
    MAC_OS_X,
}

export function systemCDROMEra(cdrom: EmulatorCDROM): SystemSoftwareEra {
    const {name} = cdrom;
    if (name.includes("Rhapsody")) {
        return SystemSoftwareEra.RHAPSODY;
    } else if (name.includes("Mac OS X Server")) {
        return SystemSoftwareEra.MAC_OS_X_SERVER;
    } else if (name.includes("Mac OS X") || name.includes("OpenDarwin")) {
        return SystemSoftwareEra.MAC_OS_X;
    } else if (name.includes("NeXT")) {
        return SystemSoftwareEra.NEXT;
    } else {
        return SystemSoftwareEra.CLASSIC;
    }
}

export function systemCDROMCompare(a: EmulatorCDROM, b: EmulatorCDROM) {
    // Sort by era and then version number
    const aEra = systemCDROMEra(a);
    const bEra = systemCDROMEra(b);
    if (aEra !== bEra) {
        return aEra - bEra;
    }
    const aVersion = /\d+\.\d+/.exec(a.name);
    const bVersion = /\d+\.\d+/.exec(b.name);
    if (!aVersion || !bVersion) {
        return 0;
    }
    return parseFloat(aVersion[0]) - parseFloat(bVersion[0]);
}
export async function getCDROMInfo(url: string): Promise<EmulatorCDROM> {
    const libraryCDROM = Object.values(cdromLibrary).find(
        cdrom => cdrom.srcUrl === url
    );
    if (libraryCDROM) {
        return libraryCDROM;
    }
    if (isCompressedCDROMURL(url)) {
        return fetchCompressedCDROMInfo(url);
    }
    return fetchCDROMInfo(url);
}

async function fetchCDROMInfo(cdromURL: string): Promise<EmulatorCDROM> {
    const response = await fetch(`/CD-ROM/${btoa(cdromURL)}`, {
        method: "PUT",
    });
    if (!response.ok) {
        const error = await response.text();
        varz.incrementError("emulator_error:cdrom_url", error);
        throw new Error(error);
    }
    const cdrom = await response.json();
    varz.increment("emulator_cdrom:custom_url");
    return cdrom;
}

function isCompressedCDROMURL(srcUrl: string) {
    const {host, pathname} = new URL(srcUrl);
    const path = pathname.toLowerCase();
    return (
        host.endsWith("archive.org") &&
        (path.endsWith(".7z") || path.endsWith(".zip"))
    );
}

async function fetchCompressedCDROMInfo(
    srcUrl: string
): Promise<EmulatorCDROM> {
    const cacheKey = `compressed_cdrom:${srcUrl}`;
    if (cacheKey in localStorage) {
        return JSON.parse(localStorage[cacheKey]);
    }
    const contentsResponse = await fetch(`${srcUrl}/`, {
        signal: AbortSignal.timeout(2000),
    });
    if (!contentsResponse.ok) {
        throw new Error(
            `Compressed CD-ROM contents request failed: ${contentsResponse.status} (${contentsResponse.statusText})`
        );
    }
    const contentsBody = await contentsResponse.text();
    const contentsDOM = new DOMParser().parseFromString(
        contentsBody,
        "text/html"
    );
    const cells = contentsDOM.querySelectorAll(".archext tr td");
    if (cells.length < 4) {
        throw new Error(
            `Compressed CD-ROM contents request failed: no contents found`
        );
    }
    const fileNameCell = cells[0];
    const fileName = fileNameCell.textContent?.trim() ?? "";
    if (!fileName) {
        throw new Error(
            `Compressed CD-ROM contents request failed: no filename`
        );
    }
    // We cache the manifest and use the redirected URL (which is served from
    // a specific archive.org node) so that we get a stable URL for the CD-ROM.
    const downloadUrl =
        contentsResponse.url + `&file=${encodeURIComponent(fileName)}`;
    const fileSizeCell = cells[3];
    const fileSizeStr = fileSizeCell.textContent?.trim() ?? "";
    const fileSize = parseInt(fileSizeStr);
    if (isNaN(fileSize)) {
        throw new Error(
            `Compressed CD-ROM contents request failed: invalid size (${fileSizeStr})`
        );
    }

    const cdrom = {
        // The name is not that important, but try to use the filename from the
        // URL if possible.
        name: new URL(srcUrl).pathname.split("/").pop() ?? "Untitled",
        srcUrl: downloadUrl,
        fileSize,
        // Cover images are not shown for on-demand CD-ROMs, so leave them
        // blank.
        coverImageHash: "",
        coverImageSize: [0, 0],
        fetchClientSide: true,
    } satisfies EmulatorCDROM;

    localStorage[cacheKey] = JSON.stringify(cdrom);
    return cdrom;
}
