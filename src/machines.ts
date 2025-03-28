import mac128KRomPath from "./Data/Mac-128K.rom";
import macPlusRomPath from "./Data/Mac-Plus.rom";
import macSERomPath from "./Data/Mac-SE.rom";
import macIIRomPath from "./Data/Mac-II.rom";
import macIIfxRomPath from "./Data/Mac-IIfx.rom";
import quadra650RomPath from "./Data/Quadra-650.rom";
import newWorldRomPath from "./Data/New-World.rom";
import powerMacintosh6100RomPath from "./Data/Power-Macintosh-6100.rom";
import powerMacintosh7500RomPath from "./Data/Power-Macintosh-7500.rom";
import powerMacintosh9500RomPath from "./Data/Power-Macintosh-9500.rom";
import powerMacintoshG3RomPath from "./Data/Power-Macintosh-G3.rom";
import atiMach64RomPath from "./Data/ATI-Mach64.rom";
import powerMacintoshG3BWBootRomPath from "./Data/Power-Macintosh-G3-BW-Boot.rom";
import nextRev10V41RomPath from "./Data/NeXT-Rev_1.0_v41.rom";
import nextRev25V66RomPath from "./Data/NeXT-Rev_2.5_v66.rom";
import nextRev33V74RomPath from "./Data/NeXT-Rev_3.3_v74.rom";
import basiliskPrefsPath from "./Data/BasiliskIIPrefs.txt";
import sheepShaverPrefsPath from "./Data/SheepShaverPrefs.txt";
import emptyPrefsPath from "./Data/EmptyPrefs.txt";
import pearPCConfigPath from "./Data/PearPCConfig.txt";
import pearpcVideoXPath from "./Data/PearPC-video-x.rom";
import previousConfigPath from "./Data/PreviousConfig.txt";
import deviceImageHeaderPath from "./Data/Device Image Header (All Drivers).hda";
import {
    type EmulatorDef,
    type EmulatorCpu,
} from "./emulator/emulator-common-emulators";

export type MachineDef = EmulatorDef & {
    name: string;
    cpu: EmulatorCpu;
    romPath: string;
    gestaltID: number;
    prefsPath: string;
    fixedScreenSize?: {width: number; height: number};
    supportedScreenSizes?: {
        width: number;
        height: number;
        monitorId?: string; // Mostly for DingusPPC
    }[];
    mfsOnly?: boolean;
    bezelStyle: "Beige" | "Platinum" | "Pinstripes" | "NeXT";
    ramSizes: MachineDefRAMSize[]; // First value is the default
    platform?: MachinePlatform;
    // Optional map from file name to URL with extra files to include in the
    // Emscripten filesystem when starting this machine.
    extraFiles?: {[fileName: string]: string};
    // If requesting debug logs, OpenFirmware variables to set to also enable a
    // verbose boot.
    verboseBootEnvVars?: {[name: string]: string};
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
    bezelStyle: "Pinstripes",
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
    supportedScreenSizes: [
        {width: 832, height: 624, monitorId: "Multiscan17in"},
        {width: 640, height: 870, monitorId: "MacRGB15in"},
        {width: 640, height: 480, monitorId: "Multiscan15in"},
    ],
    bezelStyle: "Platinum",
    // The 6100 has 8MB of RAM soldered to the motherboard, these are sizes with
    // with pairs of 64, 32, 16, 8, 4, and 2MB and 0MB SIMMs installed.
    ramSizes: ["136M", "72M", "40M", "24M", "12M", "8M"],
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

export const POWER_MACINTOSH_7200: MachineDef = {
    name: "Power Macintosh 7200",
    cpu: "601",
    romPath: powerMacintosh7500RomPath,
    gestaltID: 108,
    emulatorType: "DingusPPC",
    prefsPath: emptyPrefsPath,
    bezelStyle: "Platinum",
    supportedScreenSizes: [
        {width: 1152, height: 870, monitorId: "Multiscan20in"},
        {width: 832, height: 624, monitorId: "Multiscan17in"},
        {width: 640, height: 870, monitorId: "MacRGB15in"},
        {width: 640, height: 480, monitorId: "Multiscan15in"},
    ],
    ramSizes: ["16M", "32M", "64M", "128M", "256M"],
};

export const POWER_MACINTOSH_7500: MachineDef = {
    name: "Power Macintosh 7500",
    cpu: "601",
    romPath: powerMacintosh7500RomPath,
    gestaltID: 68,
    emulatorType: "DingusPPC",
    prefsPath: emptyPrefsPath,
    bezelStyle: "Platinum",
    supportedScreenSizes: [
        {width: 1152, height: 870, monitorId: "Multiscan20in"},
        {width: 832, height: 624, monitorId: "Multiscan17in"},
        {width: 640, height: 870, monitorId: "MacRGB15in"},
        {width: 640, height: 480, monitorId: "Multiscan15in"},
    ],
    ramSizes: ["16M", "32M", "64M", "128M", "256M"],
};

export const POWER_MACINTOSH_G3_BEIGE: MachineDef = {
    name: "Power Macintosh G3 (Beige)",
    cpu: "G3",
    romPath: powerMacintoshG3RomPath,
    gestaltID: 510,
    emulatorType: "DingusPPC",
    prefsPath: emptyPrefsPath,
    bezelStyle: "Platinum",
    supportedScreenSizes: [
        {width: 1152, height: 870, monitorId: "MacColor21in"},
        {width: 1024, height: 768, monitorId: "Multiscan17in"},
        {width: 832, height: 624, monitorId: "Multiscan15in"},
        {width: 640, height: 480, monitorId: "HiRes12-14in"},
    ],
    ramSizes: ["256M", "128M", "64M", "32M"],
    extraFiles: {
        "apm_all_drivers.bin": deviceImageHeaderPath,
    },
    verboseBootEnvVars: {
        "boot-command": "0 bootr -v",
    },
};

export const POWER_MACINTOSH_G3_BW_DPPC: MachineDef = {
    name: "Power Macintosh G3 (Blue & White) - Experimental",
    cpu: "G3",
    romPath: powerMacintoshG3BWBootRomPath,
    gestaltID: 406,
    emulatorType: "DingusPPC",
    prefsPath: emptyPrefsPath,
    bezelStyle: "Pinstripes",
    supportedScreenSizes: [
        {width: 1152, height: 870, monitorId: "MacColor21in"},
        {width: 1024, height: 768, monitorId: "Multiscan17in"},
        {width: 832, height: 624, monitorId: "Multiscan15in"},
        {width: 640, height: 480, monitorId: "HiRes12-14in"},
    ],
    ramSizes: ["256M", "128M", "64M", "32M"],
    extraFiles: {
        "113-32900-004_Apple_MACH64.bin": atiMach64RomPath,
        "apm_all_drivers.bin": deviceImageHeaderPath,
    },
    verboseBootEnvVars: {
        "boot-args": "-v",
    },
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

export const POWER_MACINTOSH_G4_PEARPC: MachineDef = {
    name: "Power Macintosh G4 (PCI Graphics)",
    cpu: "G3",
    romPath: powerMacintoshG3BWBootRomPath,
    gestaltID: 406,
    emulatorType: "PearPC",
    prefsPath: pearPCConfigPath,
    bezelStyle: "Pinstripes",
    ramSizes: ["256M", "128M", "64M", "32M"],
    extraFiles: {
        "video.x": pearpcVideoXPath,
        "apm_all_drivers.bin": deviceImageHeaderPath,
    },
};

export const NEXT_COMPUTER: MachineDef = {
    name: "NeXT Computer",
    cpu: "68030",
    romPath: nextRev10V41RomPath,
    gestaltID: 0, // NEXT_CUBE030
    emulatorType: "Previous",
    emulatorSubtype: "NeXT Computer",
    prefsPath: previousConfigPath,
    fixedScreenSize: {width: 1120, height: 832},
    bezelStyle: "NeXT",
    ramSizes: ["64M", "32M", "16M"],
    platform: "NeXT",
};

export const NEXT_CUBE: MachineDef = {
    name: "NeXTcube",
    cpu: "68040",
    romPath: nextRev25V66RomPath,
    gestaltID: 1, // NEXT_CUBE040
    emulatorType: "Previous",
    emulatorSubtype: "NeXTcube",
    prefsPath: previousConfigPath,
    fixedScreenSize: {width: 1120, height: 832},
    bezelStyle: "NeXT",
    ramSizes: ["64M", "32M", "16M"],
    platform: "NeXT",
};

export const NEXT_STATION: MachineDef = {
    name: "NeXTstation",
    cpu: "68040",
    romPath: nextRev25V66RomPath,
    gestaltID: 2, // NEXT_STATION
    emulatorType: "Previous",
    emulatorSubtype: "NeXTstation",
    prefsPath: previousConfigPath,
    fixedScreenSize: {width: 1120, height: 832},
    bezelStyle: "NeXT",
    ramSizes: ["32M", "16M"],
    platform: "NeXT",
};

export const NEXT_STATION_TURBO_COLOR: MachineDef = {
    name: "NeXTstation Turbo Color",
    cpu: "68040",
    romPath: nextRev33V74RomPath,
    gestaltID: 2, // NEXT_STATION
    emulatorType: "Previous",
    emulatorSubtype: "NeXTstation Turbo Color",
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
    POWER_MACINTOSH_7200,
    POWER_MACINTOSH_7500,
    POWER_MACINTOSH_9500,
    POWER_MACINTOSH_G3_BEIGE,
    POWER_MACINTOSH_G3_BW_DPPC,
    POWER_MACINTOSH_G3_BW,
    POWER_MACINTOSH_G4_PEARPC,
    NEXT_COMPUTER,
    NEXT_CUBE,
    NEXT_STATION,
    NEXT_STATION_TURBO_COLOR,
];

export const MACHINES_BY_NAME = Object.fromEntries(
    ALL_MACHINES.map(machine => [machine.name, machine])
);

export function isExperimentalMachine(machine: MachineDef): boolean {
    return (
        machine.emulatorType === "DingusPPC" ||
        machine.emulatorType === "PearPC"
    );
}
