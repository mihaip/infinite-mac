import mac128KRomPath from "./Data/Mac-128K.rom";
import macPlusRomPath from "./Data/Mac-Plus.rom";
import macSERomPath from "./Data/Mac-SE.rom";
import macIIRomPath from "./Data/Mac-II.rom";
import macIIfxRomPath from "./Data/Mac-IIfx.rom";
import quadra650RomPath from "./Data/Quadra-650.rom";
import newWorldRomPath from "./Data/New-World.rom";
import powerMacintosh6100RomPath from "./Data/Power-Macintosh-6100.rom";
import powerMacintosh9500RomPath from "./Data/Power-Macintosh-9500.rom";
import powerMacintoshG3RomPath from "./Data/Power-Macintosh-G3.rom";
import nextRev33V74RomPath from "./Data/NeXT-Rev_3.3_v74.rom";
import basiliskPrefsPath from "./Data/BasiliskIIPrefs.txt";
import sheepShaverPrefsPath from "./Data/SheepShaverPrefs.txt";
import emptyPrefsPath from "./Data/EmptyPrefs.txt";
import previousConfigPath from "./Data/PreviousConfig.txt";
import {
    type EmulatorCpu,
    type EmulatorSubtype,
    type EmulatorType,
} from "./emulator/emulator-common-emulators";

export type MachineDef = {
    name: string;
    cpu: EmulatorCpu;
    romPath: string;
    gestaltID: number;
    emulatorType: EmulatorType;
    emulatorSubtype?: EmulatorSubtype;
    prefsPath: string;
    fixedScreenSize?: {width: number; height: number};
    mfsOnly?: boolean;
    bezelStyle: "Beige" | "Platinum" | "Pinstripes" | "NeXT";
    ramSizes: MachineDefRAMSize[]; // First value is the default
    platform?: MachinePlatform;
};

export type MachineDefRAMSize = `${number}M` | `${number}K`;

export type MachinePlatform = "Macintosh" | "NeXT";

export const MAC_128K: MachineDef = {
    name: "Mac 128K",
    cpu: "68000",
    romPath: mac128KRomPath,
    gestaltID: 1,
    emulatorType: "Mini vMac",
    emulatorSubtype: "128K",
    prefsPath: emptyPrefsPath,
    fixedScreenSize: {width: 512, height: 342},
    bezelStyle: "Beige",
    mfsOnly: true,
    ramSizes: ["128K"],
};

export const MAC_512KE: MachineDef = {
    name: "Mac 512Ke",
    cpu: "68000",
    romPath: macPlusRomPath,
    gestaltID: 3,
    emulatorType: "Mini vMac",
    emulatorSubtype: "512Ke",
    prefsPath: emptyPrefsPath,
    fixedScreenSize: {width: 512, height: 342},
    bezelStyle: "Beige",
    ramSizes: ["512K"],
};

export const MAC_PLUS: MachineDef = {
    name: "Mac Plus",
    cpu: "68000",
    romPath: macPlusRomPath,
    gestaltID: 4,
    emulatorType: "Mini vMac",
    emulatorSubtype: "Plus",
    prefsPath: emptyPrefsPath,
    fixedScreenSize: {width: 512, height: 342},
    bezelStyle: "Beige",
    ramSizes: ["4M"],
};

export const MAC_SE: MachineDef = {
    name: "Mac SE",
    cpu: "68000",
    romPath: macSERomPath,
    gestaltID: 5,
    emulatorType: "Mini vMac",
    emulatorSubtype: "SE",
    prefsPath: emptyPrefsPath,
    fixedScreenSize: {width: 512, height: 342},
    bezelStyle: "Platinum",
    ramSizes: ["4M"],
};

export const MAC_II: MachineDef = {
    name: "Mac II",
    cpu: "68020",
    romPath: macIIRomPath,
    gestaltID: 6,
    emulatorType: "Mini vMac",
    emulatorSubtype: "II",
    prefsPath: emptyPrefsPath,
    fixedScreenSize: {width: 640, height: 480},
    bezelStyle: "Platinum",
    ramSizes: ["8M"],
};

export const MAC_IIFX: MachineDef = {
    name: "Mac IIfx",
    cpu: "68030",
    romPath: macIIfxRomPath,
    gestaltID: 13,
    emulatorType: "BasiliskII",
    prefsPath: basiliskPrefsPath,
    bezelStyle: "Platinum",
    ramSizes: ["128M", "64M", "32M", "16M", "8M", "4M"],
};

export const QUADRA_650: MachineDef = {
    name: "Quadra 650",
    cpu: "68040",
    romPath: quadra650RomPath,
    gestaltID: 36,
    emulatorType: "BasiliskII",
    prefsPath: basiliskPrefsPath,
    bezelStyle: "Platinum",
    ramSizes: ["128M", "64M", "32M", "16M", "8M", "4M"],
};

export const POWER_MACINTOSH_6100: MachineDef = {
    name: "Power Macintosh 6100",
    cpu: "601",
    romPath: powerMacintosh6100RomPath,
    gestaltID: 67,
    emulatorType: "DingusPPC",
    prefsPath: emptyPrefsPath,
    fixedScreenSize: {width: 640, height: 480},
    bezelStyle: "Platinum",
    // The 6100 has 8M of RAM soldered to the motherboard, so these are
    // technically additional RAM on top of that. In practice DingusPPC does
    // not seem to do anything with the RAM config for this machine, so it
    // doesn't matter.
    ramSizes: ["8M", "16M", "32M", "64M", "128M"],
};

export const POWER_MACINTOSH_9500: MachineDef = {
    name: "Power Macintosh 9500",
    cpu: "604",
    romPath: powerMacintosh9500RomPath,
    gestaltID: 67,
    emulatorType: "SheepShaver",
    prefsPath: sheepShaverPrefsPath,
    bezelStyle: "Platinum",
    ramSizes: ["256M", "128M", "64M", "32M", "16M"],
};

export const POWER_MACINTOSH_G3_BEIGE: MachineDef = {
    name: "Power Macintosh G3 (Beige)",
    cpu: "G3",
    romPath: powerMacintoshG3RomPath,
    gestaltID: 510,
    emulatorType: "DingusPPC",
    prefsPath: emptyPrefsPath,
    bezelStyle: "Platinum",
    fixedScreenSize: {width: 1024, height: 768},
    ramSizes: ["256M", "128M", "64M", "32M"],
};

export const POWER_MACINTOSH_G3_BW: MachineDef = {
    name: "Power Macintosh G3 (Blue & White)",
    cpu: "G3",
    romPath: newWorldRomPath,
    gestaltID: 406,
    emulatorType: "SheepShaver",
    prefsPath: sheepShaverPrefsPath,
    bezelStyle: "Pinstripes",
    ramSizes: ["256M", "128M", "64M"],
};

export const NEXT_STATION_TURBO_COLOR: MachineDef = {
    name: "NeXTstation Turbo Color",
    cpu: "68040",
    romPath: nextRev33V74RomPath,
    gestaltID: 67,
    emulatorType: "Previous",
    prefsPath: previousConfigPath,
    fixedScreenSize: {width: 1120, height: 832},
    bezelStyle: "NeXT",
    ramSizes: ["128M", "64M", "32M", "16M"],
    platform: "NeXT",
};

export const ALL_MACHINES = [
    MAC_128K,
    MAC_512KE,
    MAC_PLUS,
    MAC_SE,
    MAC_II,
    MAC_IIFX,
    QUADRA_650,
    POWER_MACINTOSH_6100,
    POWER_MACINTOSH_9500,
    POWER_MACINTOSH_G3_BEIGE,
    POWER_MACINTOSH_G3_BW,
    NEXT_STATION_TURBO_COLOR,
];

export const MACHINES_BY_NAME = Object.fromEntries(
    ALL_MACHINES.map(machine => [machine.name, machine])
);

export function isExperimentalMachine(machine: MachineDef): boolean {
    return (
        machine.emulatorType === "DingusPPC" ||
        machine.emulatorType === "Previous"
    );
}
