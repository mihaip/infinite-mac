import macPlusRomPath from "./Data/Mac-Plus.rom";
import quadraRomPath from "./Data/Quadra-650.rom";
import newWorldRomPath from "./Data/New-World.rom";
import oldWorldRomPath from "./Data/Old-World.rom";
import basiliskPrefsPath from "./Data/BasiliskIIPrefs.txt";
import sheepShaverPrefsPath from "./Data/SheepShaverPrefs.txt";
import minivMacPrefsPath from "./Data/MinivMacPrefs.txt";
import type {EmulatorType} from "./emulator/emulator-common";

export type MachineDef = {
    romPath: string;
    emulator: EmulatorType;
    prefsPath: string;
    fixedScreenSize?: {width: number; height: number};
};

export const MAC_PLUS: MachineDef = {
    romPath: macPlusRomPath,
    emulator: "Mini vMac",
    prefsPath: minivMacPrefsPath,
    fixedScreenSize: {width: 512, height: 342},
};

export const QUADRA: MachineDef = {
    romPath: quadraRomPath,
    emulator: "BasiliskII",
    prefsPath: basiliskPrefsPath,
};

export const OLD_WORLD_POWERMAC: MachineDef = {
    romPath: oldWorldRomPath,
    emulator: "SheepShaver",
    prefsPath: sheepShaverPrefsPath,
};

export const NEW_WORLD_POWERMAC: MachineDef = {
    romPath: newWorldRomPath,
    emulator: "SheepShaver",
    prefsPath: sheepShaverPrefsPath,
};
