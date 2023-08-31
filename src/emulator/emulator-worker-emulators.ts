import MinivMac128KJsPath from "./minivmac-128K.js?url";
import MinivMac512KeJsPath from "./minivmac-512Ke.js?url";
import MinivMacIIJsPath from "./minivmac-II.js?url";
import MinivMacPlusJsPath from "./minivmac-Plus.js?url";
import MinivMacSEJsPath from "./minivmac-SE.js?url";
import BasiliskIIJsPath from "./BasiliskII.js?url";
import SheepShaverJsPath from "./SheepShaver.js?url";
import DingusPPCJsPath from "./dingusppc.js?url";
import {type EmulatorDef} from "./emulator-common-emulators";

// Import the Emscripten-generated JS module wrapper for the emulator Wasm
// binary. Assumes that Emscripten has been run with
// `-s MODULARIZE -s EXPORT_ES6 -s EXPORT_NAME=emulator`.
export function importEmulator(def: EmulatorDef) {
    const {emulatorType, emulatorSubtype} = def;
    switch (emulatorType) {
        case "BasiliskII":
            return import("./BasiliskII");
        case "SheepShaver":
            return import("./SheepShaver");
        case "Mini vMac":
            switch (emulatorSubtype) {
                case "128K":
                    return import("./minivmac-128K");
                case "512Ke":
                    return import("./minivmac-512Ke");
                case "Plus":
                    return import("./minivmac-Plus");
                case "SE":
                    return import("./minivmac-SE");
                case "II":
                    return import("./minivmac-II");
                default:
                    throw new Error(
                        `Unknown Mini vMac subtype: ${emulatorSubtype}`
                    );
            }
        case "DingusPPC":
            return import("./dingusppc");
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
    const {emulatorType, emulatorSubtype} = def;
    switch (emulatorType) {
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
            }[emulatorSubtype!];
        case "DingusPPC":
            return DingusPPCJsPath;
    }
}
