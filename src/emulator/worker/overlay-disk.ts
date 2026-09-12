import {type EmulatorDiskOverlay} from "@/emulator/common/common";
import {type EmulatorWorkerDisk} from "@/emulator/worker/disks";

export class EmulatorWorkerOverlayDisk implements EmulatorWorkerDisk {
    #disk: EmulatorWorkerDisk;
    #overlays: EmulatorDiskOverlay[];

    constructor(disk: EmulatorWorkerDisk, overlays: EmulatorDiskOverlay[]) {
        this.#disk = disk;
        this.#overlays = overlays;
    }

    get name(): string {
        return this.#disk.name;
    }

    get size(): number {
        return this.#disk.size;
    }

    get isCdrom(): boolean | undefined {
        return this.#disk.isCdrom;
    }

    get isFloppy(): boolean | undefined {
        return this.#disk.isFloppy;
    }

    read(buffer: Uint8Array, offset: number, length: number): number {
        const bytesRead = this.#disk.read(buffer, offset, length);
        if (bytesRead <= 0) {
            return bytesRead;
        }
        for (const overlay of this.#overlays) {
            copyIntersection(
                overlay.data,
                overlay.offset,
                overlay.data.byteLength,
                buffer,
                offset,
                bytesRead
            );
        }
        return bytesRead;
    }

    write(buffer: Uint8Array, offset: number, length: number): number {
        const bytesWritten = this.#disk.write(buffer, offset, length);
        if (bytesWritten <= 0) {
            return bytesWritten;
        }
        for (const overlay of this.#overlays) {
            copyIntersection(
                buffer,
                offset,
                bytesWritten,
                overlay.data,
                overlay.offset,
                overlay.data.byteLength
            );
        }
        return bytesWritten;
    }

    validate?(): void {
        this.#disk.validate?.();
    }
}

function copyIntersection(
    source: Uint8Array,
    sourceOffset: number,
    sourceLength: number,
    destination: Uint8Array,
    destinationOffset: number,
    destinationLength: number
) {
    const start = Math.max(sourceOffset, destinationOffset);
    const end = Math.min(
        sourceOffset + sourceLength,
        destinationOffset + destinationLength
    );
    if (start >= end) {
        return;
    }
    destination.set(
        source.subarray(start - sourceOffset, end - sourceOffset),
        start - destinationOffset
    );
}
