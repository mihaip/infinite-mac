import MinivMac128KWasmPath from "@/emulator/worker/emscripten/minivmac-128K.wasm?url";
import MinivMac512KeWasmPath from "@/emulator/worker/emscripten/minivmac-512Ke.wasm?url";
import MinivMacIIWasmPath from "@/emulator/worker/emscripten/minivmac-II.wasm?url";
import MinivMacIIxWasmPath from "@/emulator/worker/emscripten/minivmac-IIx.wasm?url";
import MinivMacPlusWasmPath from "@/emulator/worker/emscripten/minivmac-Plus.wasm?url";
import MinivMacSEWasmPath from "@/emulator/worker/emscripten/minivmac-SE.wasm?url";
import BasiliskIIWasmPath from "@/emulator/worker/emscripten/BasiliskII.wasm?url";
import SheepShaverWasmPath from "@/emulator/worker/emscripten/SheepShaver.wasm?url";
import DingusPPCWasmPath from "@/emulator/worker/emscripten/dingusppc.wasm?url";
import PearPCWasmPath from "@/emulator/worker/emscripten/ppc.wasm?url";
import PreviousWasmPath from "@/emulator/worker/emscripten/previous.wasm?url";
import SnowWasmPath from "@/emulator/worker/emscripten/snow.wasm?url";
import {type EmulatorDef} from "@/emulator/common/emulators";

export function getEmulatorWasmPath(def: EmulatorDef): string {
    const {emulatorType, emulatorSubtype} = def;
    switch (emulatorType) {
        case "BasiliskII":
            return BasiliskIIWasmPath;
        case "SheepShaver":
            return SheepShaverWasmPath;
        case "Mini vMac":
            return {
                "128K": MinivMac128KWasmPath,
                "512Ke": MinivMac512KeWasmPath,
                "Plus": MinivMacPlusWasmPath,
                "SE": MinivMacSEWasmPath,
                "II": MinivMacIIWasmPath,
                "IIx": MinivMacIIxWasmPath,
            }[emulatorSubtype];
        case "DingusPPC":
            return DingusPPCWasmPath;
        case "PearPC":
            return PearPCWasmPath;
        case "Previous":
            return PreviousWasmPath;
        case "Snow":
            return SnowWasmPath;
    }
}
