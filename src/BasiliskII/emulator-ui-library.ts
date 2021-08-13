import type {EmulatorLibraryDef} from "./emulator-common";
import libraryDef from "./emulator-library.json";

export function loadLibrary(): EmulatorLibraryDef {
    return libraryDef;
}
