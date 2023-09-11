import {type EmulatorCDROM} from "./emulator/emulator-common";
import * as varz from "./varz";

export async function fetchCDROMInfo(cdromURL: string): Promise<EmulatorCDROM> {
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
