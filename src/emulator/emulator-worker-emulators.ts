import {type EmulatorDef} from "./emulator-common-emulators";

// Import the Emscripten-generated JS module wrapper for the emulator Wasm
// binary. Assumes that Emscripten has been run with
// `-s MODULARIZE -s EXPORT_ES6 -s EXPORT_NAME=emulator`.
export function importEmulator(def: EmulatorDef): Promise<{default: any}> {
    switch (def.emulatorType) {
        case "BasiliskII":
            return import("./BasiliskII");
        case "SheepShaver":
            return import("./SheepShaver");
        case "Mini vMac":
            return {
                "128K": import("./minivmac-128K"),
                "512Ke": import("./minivmac-512Ke"),
                "Plus": import("./minivmac-Plus"),
                "SE": import("./minivmac-SE"),
                "II": import("./minivmac-II"),
                "IIx": import("./minivmac-IIx"),
            }[def.emulatorSubtype];
        case "DingusPPC":
            return import("./dingusppc");
        case "PearPC":
            return import("./ppc");
        case "Previous":
            return import("./previous");
    }
}
