import {type EmulatorDef} from "@/emulator/common/emulators";

// Import the Emscripten-generated JS module wrapper for the emulator Wasm
// binary. Assumes that Emscripten has been run with
// `-s MODULARIZE -s EXPORT_ES6 -s EXPORT_NAME=emulator`.
export function importEmulator(def: EmulatorDef): Promise<{default: any}> {
    switch (def.emulatorType) {
        case "BasiliskII":
            return import("@/emulator/worker/emscripten/BasiliskII");
        case "SheepShaver":
            return import("@/emulator/worker/emscripten/SheepShaver");
        case "Mini vMac":
            return {
                "128K": import("@/emulator/worker/emscripten/minivmac-128K"),
                "512Ke": import("@/emulator/worker/emscripten/minivmac-512Ke"),
                "Plus": import("@/emulator/worker/emscripten/minivmac-Plus"),
                "SE": import("@/emulator/worker/emscripten/minivmac-SE"),
                "II": import("@/emulator/worker/emscripten/minivmac-II"),
                "IIx": import("@/emulator/worker/emscripten/minivmac-IIx"),
            }[def.emulatorSubtype];
        case "DingusPPC":
            return import("@/emulator/worker/emscripten/dingusppc");
        case "PearPC":
            return import("@/emulator/worker/emscripten/ppc");
        case "Previous":
            return import("@/emulator/worker/emscripten/previous");
    }
}
