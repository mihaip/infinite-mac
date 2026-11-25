import {LowMem} from "@/emulator/common/toolbox/lowmem";
import {type MacMemoryReader} from "@/emulator/common/toolbox/memory";

/**
 * Read the current application's name, which may belong to a background
 * process.
 */
export function readCurrentProcessName(
    memory: MacMemoryReader
): string | undefined {
    try {
        // CurApName has a length of -1 before an application is launched.
        // https://vintageapple.org/develop/pdf/develop-26_9606_June_1996.pdf#page=117
        if (memory.u8(LowMem.CurApName) === UNINITIALIZED_APPLICATION_NAME) {
            return undefined;
        }
        return (
            memory.pstring(LowMem.CurApName, APPLICATION_NAME_MAX_LENGTH) ||
            undefined
        );
    } catch (error) {
        console.warn("Could not read current process name", error);
        return undefined;
    }
}

const APPLICATION_NAME_MAX_LENGTH = 31;
const UNINITIALIZED_APPLICATION_NAME = 0xff;
