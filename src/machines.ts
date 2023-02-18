import macPlusRomPath from "./Data/Mac-Plus.rom";
import macIIRomPath from "./Data/Mac-II.rom";
import quadraRomPath from "./Data/Quadra-650.rom";
import newWorldRomPath from "./Data/New-World.rom";
import oldWorldRomPath from "./Data/Old-World.rom";
import basiliskPrefsPath from "./Data/BasiliskIIPrefs.txt";
import sheepShaverPrefsPath from "./Data/SheepShaverPrefs.txt";
import minivMacPrefsPath from "./Data/MinivMacPrefs.txt";
import type {EmulatorSubtype, EmulatorType} from "./emulator/emulator-common";

export type MachineDef = {
    name: string;
    romPath: string;
    emulator: EmulatorType;
    emulatorSubtype?: EmulatorSubtype;
    prefsPath: string;
    fixedScreenSize?: {width: number; height: number};
};

export const MAC_PLUS: MachineDef = {
    name: "Mac Plus",
    romPath: macPlusRomPath,
    emulator: "Mini vMac",
    emulatorSubtype: "Plus",
    prefsPath: minivMacPrefsPath,
    fixedScreenSize: {width: 512, height: 342},
};

export const MAC_II: MachineDef = {
    name: "Mac II",
    romPath: macIIRomPath,
    emulator: "Mini vMac",
    emulatorSubtype: "II",
    prefsPath: minivMacPrefsPath,
    fixedScreenSize: {width: 640, height: 480},
};

export const QUADRA: MachineDef = {
    name: "Quadra 650",
    romPath: quadraRomPath,
    emulator: "BasiliskII",
    prefsPath: basiliskPrefsPath,
};

export const OLD_WORLD_POWERMAC: MachineDef = {
    name: "Old World PowerMac",
    romPath: oldWorldRomPath,
    emulator: "SheepShaver",
    prefsPath: sheepShaverPrefsPath,
};

export const NEW_WORLD_POWERMAC: MachineDef = {
    name: "New World PowerMac",
    romPath: newWorldRomPath,
    emulator: "SheepShaver",
    prefsPath: sheepShaverPrefsPath,
};

export const ALL_MACHINES = [
    MAC_PLUS,
    MAC_II,
    QUADRA,
    OLD_WORLD_POWERMAC,
    NEW_WORLD_POWERMAC,
];

export const MACHINES_BY_NAME = Object.fromEntries(
    ALL_MACHINES.map(machine => [machine.name, machine])
);
