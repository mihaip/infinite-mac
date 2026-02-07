import {type EmulatorConfigFlags} from "@/emulator/common/common";

export type EmulatorType =
    | "BasiliskII"
    | "SheepShaver"
    | "Mini vMac"
    | "DingusPPC"
    | "Previous"
    | "PearPC"
    | "Snow";

export type EmulatorMinivMacSubtypes =
    | "128K"
    | "512Ke"
    | "Plus"
    | "SE"
    | "II"
    | "IIx";

export type EmulatorPreviousSubtypes =
    | "NeXT Computer"
    | "NeXTcube"
    | "NeXTstation"
    | "NeXTstation Turbo Color";

export type EmulatorSubtype =
    | EmulatorMinivMacSubtypes
    | EmulatorPreviousSubtypes;

export type EmulatorCpu =
    | "68000"
    | "68020"
    | "68030"
    | "68040"
    | "601"
    | "603"
    | "604"
    | "G3";

export const EMULATOR_REMOVABLE_DISK_COUNT = 7;

export function emulatorUsesPlaceholderDisks(type: EmulatorType): boolean {
    return type === "BasiliskII" || type === "SheepShaver";
}

export function emulatorUsesInterruptKey(type: EmulatorType): boolean {
    return type === "Mini vMac";
}

// True if the emulator can optionally use mouse deltas instead of absolute
// coordinates (separate from emulatorNeedsMouseDeltas, those emulators always
// use deltas).
export function emulatorSupportsMouseDeltas(type: EmulatorType): boolean {
    return type === "BasiliskII" || type === "SheepShaver" || type === "Snow";
}

export function emulatorNeedsMouseDeltas(type: EmulatorType): boolean {
    return type === "DingusPPC" || type === "Previous" || type === "PearPC";
}

export function emulatorNeedsRestartForMouseDeltas(
    type: EmulatorType
): boolean {
    return type === "Snow";
}

export function emulatorSupportsAppleTalk(type: EmulatorType): boolean {
    return type === "BasiliskII" || type === "SheepShaver";
}

export function emulatorSupportsDownloadsFolder(
    type: EmulatorType,
    flags: EmulatorConfigFlags
): boolean {
    return (
        type === "BasiliskII" ||
        type === "SheepShaver" ||
        (type === "DingusPPC" && flags.blueSCSI === true)
    );
}

export function emulatorSupportsCDROMs(type: EmulatorType): boolean {
    return type !== "DingusPPC" && type !== "PearPC";
}

export function emulatorNeedsDiskPlaceholderFiles(type: EmulatorType): boolean {
    // Previous expects to find all of the configured disk "files" on the
    // filesystems, we create some empty stubs for that.
    return type === "Previous";
}

export function emulatorNeedsTheOutsideWorldDisk(
    type: EmulatorType,
    flags: EmulatorConfigFlags
): boolean {
    return type === "DingusPPC" && flags.blueSCSI === true;
}

export function emulatorSupportsDebugLog(type: EmulatorType): boolean {
    return type === "DingusPPC" || type === "Previous" || type === "PearPC";
}

export function emulatorSupportsBlueSCSI(type: EmulatorType): boolean {
    return type === "DingusPPC";
}

export function emulatorCpuId(
    type: EmulatorType,
    cpu: EmulatorCpu
): number | undefined {
    if (type !== "BasiliskII") {
        return undefined;
    }
    switch (cpu) {
        case "68020":
            return 2;
        case "68030":
            return 3;
        case "68040":
            return 4;
        default:
            return undefined;
    }
}

export function emulatorModelId(
    type: EmulatorType,
    gestaltID: number
): number | undefined {
    if (type !== "BasiliskII") {
        return undefined;
    }
    return gestaltID - 6;
}

// -2 is a special value meaning the default that Mini vMac was built with,
// other values are what it uses in CONTROLM.h for speeds.
export type MinivMacEmulatorSpeed = -2 | 0 | 1 | 2 | 3 | 4 | 5 | -1;

// Basilisk II speed controls are implemented in speed-governor.ts.
export type BasiliskIIEmulatorSpeed = MinivMacEmulatorSpeed;

// Keep values in sync with Snow speed handling in snow/frontend_im/src/input.rs.
export type SnowEmulatorSpeed = -2 | 7 | -1 | 9;

export type EmulatorSpeed =
    | MinivMacEmulatorSpeed
    | BasiliskIIEmulatorSpeed
    | SnowEmulatorSpeed;

export type EmulatorSpeedConfig = {
    defaultSpeed: EmulatorSpeed;
    speedOptions: ReadonlyMap<EmulatorSpeed, string>;
};

const MACEMU_SPEED_CONFIG: EmulatorSpeedConfig = {
    defaultSpeed: -2,
    speedOptions: new Map<EmulatorSpeed, string>([
        [-2, "Default"],
        [0, "1x"],
        [1, "2x"],
        [2, "4x"],
        [3, "8x"],
        [4, "16x"],
        [5, "32x"],
        [-1, "All Out"],
    ]),
};

const SNOW_SPEED_CONFIG: EmulatorSpeedConfig = {
    defaultSpeed: -2,
    speedOptions: new Map<EmulatorSpeed, string>([
        [-2, "Accurate"],
        [7, "Dynamic"],
        [-1, "Uncapped"],
        [9, "Video"],
    ]),
};

export function emulatorSpeedConfig(
    type: EmulatorType
): EmulatorSpeedConfig | undefined {
    switch (type) {
        case "Mini vMac":
        case "BasiliskII":
            return MACEMU_SPEED_CONFIG;
        case "Snow":
            return SNOW_SPEED_CONFIG;
        default:
            return undefined;
    }
}

export type EmulatorDef =
    | {
          emulatorType: Exclude<EmulatorType, "Mini vMac" | "Previous">;
          emulatorSubtype?: never;
      }
    | {
          emulatorType: "Mini vMac";
          emulatorSubtype: EmulatorMinivMacSubtypes;
      }
    | {
          emulatorType: "Previous";
          emulatorSubtype: EmulatorPreviousSubtypes;
      };
