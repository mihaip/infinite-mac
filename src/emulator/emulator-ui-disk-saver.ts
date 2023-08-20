import {type EmulatorDiskDef} from "../disks";
import {dirtyChunksFileName} from "./emulator-common-disk-saver";

export async function resetDiskSaver(disk: EmulatorDiskDef) {
    const spec = (await disk.generatedSpec()).default;
    const opfsRoot = await navigator.storage.getDirectory();
    try {
        // Fastest way to reset is to delete the file that keeps track of dirty
        // chunks -- that way when we load the disk again, we'll only read the
        // base chunks.
        opfsRoot.removeEntry(dirtyChunksFileName(spec));
    } catch (err) {
        if (err instanceof DOMException && err.name === "NotFoundError") {
            // Expected if the file doesn't exist
            return;
        }
        console.warn("Could not remove dirty chunks file", err);
    }
}
