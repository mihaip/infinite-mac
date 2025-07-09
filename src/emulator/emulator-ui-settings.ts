import {type EmulatorSpeed} from "./emulator-common-emulators";

export type EmulatorSettings = {
    swapControlAndCommand: boolean;
    // Only supported by 68K emulators (Mini vMac and Basilisk II).
    speed: EmulatorSpeed;
    // Use relative mouse deltas (if supported by the emulator).
    useMouseDeltas: boolean;
    // Enable trackpad mode (makes it easier to move and click on mobile)
    trackpadMode: boolean;
    // Screen scaling quality mode
    screenScaling?: EmulatorScreenScaling;
};

export type EmulatorScreenScaling = "auto" | "smooth" | "pixelated";

export const DEFAULT_EMULATOR_SETTINGS: EmulatorSettings = {
    swapControlAndCommand: false,
    speed: -2,
    useMouseDeltas: false,
    trackpadMode: false,
};
