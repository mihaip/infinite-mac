import quadraRomPath from "./Data/Quadra-650.rom";
import newWorldRomPath from "./Data/New-World.rom";
import oldWorldRomPath from "./Data/Old-World.rom";
import basiliskPrefsPath from "./Data/BasiliskIIPrefs.txt";
import sheepShaverPrefsPath from "./Data/SheepShaverPrefs.txt";

export type MachineDef = {
    romPath: string;
    emulator: "BasiliskII" | "SheepShaver";
    prefsPath: string;
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
