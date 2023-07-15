import {type EmulatorCDROM} from "./emulator/emulator-common";
import * as varz from "./varz";

export async function fetchCDROMInfo(cdromURL: string): Promise<EmulatorCDROM> {
    const response = await fetch(`/CD-ROM/${btoa(cdromURL)}`, {
        method: "PUT",
    });
    if (!response.ok) {
        varz.increment("emulator_cdrom:custom_url");
        throw new Error(await response.text());
    }
    const cdrom = await response.json();
    varz.increment("emulator_error:cdrom_url");
    return cdrom;
}
