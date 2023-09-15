import mac128KRomPath from "./Data/Mac-128K.rom";
import macPlusRomPath from "./Data/Mac-Plus.rom";
import macSERomPath from "./Data/Mac-SE.rom";
import macIIRomPath from "./Data/Mac-II.rom";
import macIIfxRomPath from "./Data/Mac-IIfx.rom";
import quadra650RomPath from "./Data/Quadra-650.rom";
import newWorldRomPath from "./Data/New-World.rom";
import powerMacintosh6100RomPath from "./Data/Power-Macintosh-6100.rom";
import powerMacintosh9500RomPath from "./Data/Power-Macintosh-9500.rom";
import basiliskPrefsPath from "./Data/BasiliskIIPrefs.txt";
import sheepShaverPrefsPath from "./Data/SheepShaverPrefs.txt";
import emptyPrefsPath from "./Data/EmptyPrefs.txt";
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
    bezelStyle: "Beige" | "Platinum" | "Pinstripes";
    ramSizes: MachineDefRAMSize[]; // First value is the default
};

export type MachineDefRAMSize = `${number}M` | `${number}K`;

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
    ramSizes: ["128M", "256M", "64M", "32M", "16M"],
};

export const POWER_MACINTOSH_9500: MachineDef = {
    name: "Power Macintosh 9500",
    cpu: "604",
    romPath: powerMacintosh9500RomPath,
    gestaltID: 67,
    emulatorType: "SheepShaver",
    prefsPath: sheepShaverPrefsPath,
    bezelStyle: "Platinum",
    ramSizes: ["128M", "256M", "64M", "32M", "16M"],
};

export const POWER_MACINTOSH_G3: MachineDef = {
    name: "Power Macintosh G3",
    cpu: "G3",
    romPath: newWorldRomPath,
    gestaltID: 406,
    emulatorType: "SheepShaver",
    prefsPath: sheepShaverPrefsPath,
    bezelStyle: "Pinstripes",
    ramSizes: ["128M", "256M", "64M"],
};

export const ALL_MACHINES = [
    MAC_128K,
    MAC_512KE,
    MAC_PLUS,
    MAC_SE,
    MAC_II,
    MAC_IIFX,
    QUADRA_650,
    POWER_MACINTOSH_9500,
    POWER_MACINTOSH_G3,
];

export const MACHINES_BY_NAME = Object.fromEntries(
    ALL_MACHINES.map(machine => [machine.name, machine])
);
