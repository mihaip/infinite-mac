import {type EmulatorCDROM} from "./emulator-common";
import {
    EmulatorWorkerChunkedDisk,
    type EmulatorWorkerChunkedDiskDelegate,
} from "./emulator-worker-chunked-disk";
import {type EmulatorWorkerDisk} from "./emulator-worker-disks";

const CHUNK_SIZE = 128 * 1024;

export function createEmulatorWorkerCDROMDisk(
    cdrom: EmulatorCDROM,
    delegate: EmulatorWorkerChunkedDiskDelegate
): EmulatorWorkerDisk {
    const {name} = cdrom;
    let chunkStart = 0;
    const chunks: string[] = [];
    while (chunkStart < cdrom.fileSize) {
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, cdrom.fileSize);
        chunks.push(`${chunkStart}-${chunkEnd}`);
        chunkStart = chunkEnd;
    }
    const spec = {
        name,
        baseUrl: `/CD-ROM/${btoa(cdrom.srcUrl)}`,
        totalSize: cdrom.fileSize,
        chunks,
        chunkSize: CHUNK_SIZE,
        prefetchChunks: [0, 1, 2],
    };

    return new EmulatorWorkerChunkedDisk(spec, delegate);
}
