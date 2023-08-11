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
    let totalSize = cdrom.fileSize;
    if (cdrom.mode === "MODE1/2352") {
        totalSize = (totalSize / 2352) * 2048;
    }
    while (chunkStart < totalSize) {
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, totalSize);
        chunks.push(`${chunkStart}-${chunkEnd}`);
        chunkStart = chunkEnd;
    }
    let encodedUrl = cdrom.srcUrl;
    if (cdrom.mode) {
        encodedUrl += `#${cdrom.mode}`;
    }
    const spec = {
        name,
        baseUrl: `/CD-ROM/${btoa(encodedUrl)}`,
        totalSize,
        chunks,
        chunkSize: CHUNK_SIZE,
        prefetchChunks: [0],
    };

    return new EmulatorWorkerChunkedDisk(spec, delegate);
}
