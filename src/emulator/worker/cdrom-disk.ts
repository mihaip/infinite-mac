import {
    type EmulatorCDROM,
    type EmulatorChunkedFileSpec,
    generateChunkedFileSpecForCDROM,
} from "@/emulator/common/common";
import {
    EmulatorWorkerChunkedDisk,
    type EmulatorWorkerChunkedDiskDelegate,
} from "@/emulator/worker/chunked-disk";
import {type EmulatorWorkerDisk} from "@/emulator/worker/disks";
import {EmulatorWorkerUploadDisk} from "@/emulator/worker/upload-disk";

export function createEmulatorWorkerCDROMDisk(
    cdrom: EmulatorCDROM,
    delegate: EmulatorWorkerChunkedDiskDelegate
): EmulatorWorkerDisk {
    let disk: EmulatorWorkerDisk;
    if (cdrom.srcUrl.startsWith("blob:")) {
        disk = new EmulatorWorkerUploadDisk(
            {
                name: cdrom.name,
                size: cdrom.fileSize,
                url: cdrom.srcUrl,
            },
            delegate
        );
    } else if (cdrom.fetchMode === "cors") {
        disk = new EmulatorWorkerCORSCDROMDisk(cdrom, delegate);
    } else {
        disk = new EmulatorWorkerChunkedDisk(
            generateChunkedFileSpecForCDROM(cdrom),
            delegate
        );
    }

    if (cdrom.mode === "MODE1/2352") {
        disk = new EmulatorWorkerMode1SectorDisk(disk);
    }
    if (cdrom.isFloppy) {
        disk.isFloppy = true;
    } else {
        disk.isCdrom = true;
    }
    return disk;
}

/** Reads remote image ranges directly, without the CD-ROM proxy. */
class EmulatorWorkerCORSCDROMDisk extends EmulatorWorkerChunkedDisk {
    #srcUrl: string;

    constructor(
        cdrom: EmulatorCDROM,
        delegate: EmulatorWorkerChunkedDiskDelegate
    ) {
        super(generateChunkedFileSpecForCDROM(cdrom), delegate);
        this.#srcUrl = cdrom.srcUrl;
    }

    protected override doChunkRequest(
        spec: EmulatorChunkedFileSpec,
        chunkIndex: number
    ): {chunk: Uint8Array} | {error: string; chunkUrl: string} {
        const chunkUrl = this.#srcUrl;
        const start = chunkIndex * spec.chunkSize;
        const end = Math.min(start + spec.chunkSize, spec.totalSize);
        try {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", chunkUrl, false);
            xhr.responseType = "arraybuffer";
            xhr.setRequestHeader("Range", `bytes=${start}-${end - 1}`);
            xhr.send();
            if (xhr.status !== 206) {
                throw new Error(
                    `Expected a range response, got HTTP ${xhr.status}`
                );
            }
            const chunk = new Uint8Array(xhr.response as ArrayBuffer);
            if (chunk.byteLength !== end - start) {
                throw new Error(
                    `Expected ${end - start} bytes, got ${chunk.byteLength}`
                );
            }
            // Content-Range is only readable if explicitly exposed by CORS.
            const range = xhr.getResponseHeader("Content-Range");
            if (
                range &&
                range !== `bytes ${start}-${end - 1}/${spec.totalSize}`
            ) {
                throw new Error(`Unexpected Content-Range: ${range}`);
            }
            return {chunk};
        } catch (e) {
            return {error: `Error: ${e}`, chunkUrl};
        }
    }
}

/**
 * Wrapper for a MODE1/2352 format CD-ROM disk image that reads only the data
 * portion of each sector.
 */
export class EmulatorWorkerMode1SectorDisk implements EmulatorWorkerDisk {
    #disk: EmulatorWorkerDisk;

    constructor(disk: EmulatorWorkerDisk) {
        this.#disk = disk;
    }

    get name(): string {
        return this.#disk.name;
    }

    get size(): number {
        return (this.#disk.size / SECTOR_SIZE) * DATA_SIZE;
    }

    read(buffer: Uint8Array, offset: number, length: number): number {
        const sectorBuffer = new Uint8Array(SECTOR_SIZE); // Reuse this buffer
        let bytesRead = 0;

        while (length > 0) {
            const sectorIndex = Math.floor(offset / DATA_SIZE);
            const sectorOffset = offset % DATA_SIZE;
            const toRead = Math.min(DATA_SIZE - sectorOffset, length);

            this.#disk.read(
                sectorBuffer,
                sectorIndex * SECTOR_SIZE,
                SECTOR_SIZE
            );

            buffer.set(
                sectorBuffer.subarray(
                    DATA_OFFSET + sectorOffset,
                    DATA_OFFSET + sectorOffset + toRead
                ),
                bytesRead
            );

            offset += toRead;
            length -= toRead;
            bytesRead += toRead;
        }

        return bytesRead;
    }

    write(buffer: Uint8Array, offset: number, length: number): number {
        const sectorBuffer = new Uint8Array(SECTOR_SIZE); // Reuse this buffer
        let bytesWritten = 0;

        while (length > 0) {
            const sectorIndex = Math.floor(offset / DATA_SIZE);
            const sectorOffset = offset % DATA_SIZE;
            const toWrite = Math.min(DATA_SIZE - sectorOffset, length);

            this.#disk.read(
                sectorBuffer,
                sectorIndex * SECTOR_SIZE,
                SECTOR_SIZE
            );

            sectorBuffer.set(
                buffer.subarray(bytesWritten, bytesWritten + toWrite),
                DATA_OFFSET + sectorOffset
            );

            this.#disk.write(
                sectorBuffer,
                sectorIndex * SECTOR_SIZE,
                SECTOR_SIZE
            );

            offset += toWrite;
            length -= toWrite;
            bytesWritten += toWrite;
        }

        return bytesWritten;
    }
}

const SECTOR_SIZE = 2352;
const DATA_SIZE = 2048;
const DATA_OFFSET = 12 + 3 + 1; // 12-byte header + 3-byte address + 1-byte mode identifier
