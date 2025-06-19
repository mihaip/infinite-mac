import MinivMac128KWasmPath from "./minivmac-128K.wasm?url";
import MinivMac512KeWasmPath from "./minivmac-512Ke.wasm?url";
import MinivMacIIWasmPath from "./minivmac-II.wasm?url";
import MinivMacIIxWasmPath from "./minivmac-IIx.wasm?url";
import MinivMacPlusWasmPath from "./minivmac-Plus.wasm?url";
import MinivMacSEWasmPath from "./minivmac-SE.wasm?url";
import BasiliskIIWasmPath from "./BasiliskII.wasm?url";
import SheepShaverWasmPath from "./SheepShaver.wasm?url";
import DingusPPCWasmPath from "./dingusppc.wasm?url";
import PearPCWasmPath from "./ppc.wasm?url";
import PreviousWasmPath from "./previous.wasm?url";
import {type EmulatorDef} from "./emulator-common-emulators";

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
    }
}
