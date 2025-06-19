import MinivMac128KJsPath from "./minivmac-128K.js?url";
import MinivMac512KeJsPath from "./minivmac-512Ke.js?url";
import MinivMacIIJsPath from "./minivmac-II.js?url";
import MinivMacIIxJsPath from "./minivmac-IIx.js?url";
import MinivMacPlusJsPath from "./minivmac-Plus.js?url";
import MinivMacSEJsPath from "./minivmac-SE.js?url";
import BasiliskIIJsPath from "./BasiliskII.js?url";
import SheepShaverJsPath from "./SheepShaver.js?url";
import DingusPPCJsPath from "./dingusppc.js?url";
import PearPCJsPath from "./ppc.js?url";
import PreviousJsPath from "./previous.js?url";
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

// Fallback importing of the emulator module if the browser does not support
// dynamic import in workers (e.g Firefox, which only added support very
// recently, in 114 (see https://bugzilla.mozilla.org/show_bug.cgi?id=1540913
// and https://bugzilla.mozilla.org/show_bug.cgi?id=1812591).
export async function importEmulatorFallback(def: EmulatorDef) {
    const jsPath = getEmulatorJsPath(def);
    const response = await fetch(jsPath);
    const js = await response.text();
    // Assume that the result of Emscripten + Vite is that there's a simple
    // `export default emulator` line at the end. Strip that out (and any
    // other references to import.meta.url) and then extract the `emulator`
    // object.
    const adjustedJs = js
        .replace(/export default emulator;$/, "")
        .replaceAll("import.meta.url", `"${jsPath}"`);
    if (adjustedJs === js) {
        throw new Error(`Could not find default export in ${jsPath}`);
    }
    // eslint-disable-next-line no-eval
    eval(adjustedJs);
    // eslint-disable-next-line no-eval
    const module = eval("emulator");
    if (!module) {
        throw new Error(`Could not find module object in ${jsPath}`);
    }
    return {
        default: module,
    };
}

export function getEmulatorJsPath(def: EmulatorDef) {
    switch (def.emulatorType) {
        case "BasiliskII":
            return BasiliskIIJsPath;
        case "SheepShaver":
            return SheepShaverJsPath;
        case "Mini vMac":
            return {
                "128K": MinivMac128KJsPath,
                "512Ke": MinivMac512KeJsPath,
                "Plus": MinivMacPlusJsPath,
                "SE": MinivMacSEJsPath,
                "II": MinivMacIIJsPath,
                "IIx": MinivMacIIxJsPath,
            }[def.emulatorSubtype];
        case "DingusPPC":
            return DingusPPCJsPath;
        case "PearPC":
            return PearPCJsPath;
        case "Previous":
            return PreviousJsPath;
    }
}
