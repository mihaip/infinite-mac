import {type EmulatorCDROM} from "./emulator/emulator-common";

export async function fetchCDROMInfo(cdromURL: string): Promise<EmulatorCDROM> {
    const response = await fetch(`/CD-ROM/${btoa(cdromURL)}`, {
        method: "PUT",
    });
    if (!response.ok) {
        throw new Error(await response.text());
    }
    const cdrom = await response.json();
    return cdrom;
}
