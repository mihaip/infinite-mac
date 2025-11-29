import {
    type EmulatorCDROM,
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
    if (cdrom.srcUrl.startsWith("blob:")) {
        return new EmulatorWorkerUploadDisk(
            {
                name: cdrom.name,
                size: cdrom.fileSize,
                url: cdrom.srcUrl,
            },
            delegate
        );
    }

    const spec = generateChunkedFileSpecForCDROM(cdrom);

    let disk: EmulatorWorkerDisk = new EmulatorWorkerChunkedDisk(
        spec,
        delegate
    );
    if (cdrom.mode === "MODE1/2352") {
        disk = new EmulatorWorkerMode1SectorDisk(disk);
    }
    return disk;
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
