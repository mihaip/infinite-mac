import {
    type EmulatorCDROMLibrary,
    type EmulatorCDROM,
} from "./emulator/emulator-common";
import * as varz from "./varz";
import cdromsManifest from "./Data/CD-ROMs.json";

export const cdromLibrary: EmulatorCDROMLibrary = cdromsManifest as any;

export const systemCDROMs = Object.entries(cdromLibrary)
    .filter(([path, entry]) => path.startsWith("System Software/"))
    .map(([path, entry]) => entry)
    .sort((a, b) => a.name.localeCompare(b.name))
    .sort((a, b) => {
        const aVersion = /\d+\.\d+/.exec(a.name);
        const bVersion = /\d+\.\d+/.exec(b.name);
        if (!aVersion || !bVersion) {
            return 0;
        }
        return parseFloat(aVersion[0]) - parseFloat(bVersion[0]);
    });

export async function getCDROMInfo(url: string): Promise<EmulatorCDROM> {
    const libraryCDROM = Object.values(cdromLibrary).find(
        cdrom => cdrom.srcUrl === url
    );
    if (libraryCDROM) {
        return libraryCDROM;
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
