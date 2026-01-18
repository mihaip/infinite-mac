import {
    type DeviceImageType,
    generateDeviceImageHeader,
} from "@/emulator/common/device-image";
import {type EmulatorWorkerDisk} from "@/emulator/worker/disks";

export class EmulatorWorkerDeviceImageDisk implements EmulatorWorkerDisk {
    #disk: EmulatorWorkerDisk;
    #deviceHeader: ArrayBuffer;

    constructor(
        disk: EmulatorWorkerDisk,
        baseDeviceHeader: ArrayBuffer,
        deviceImageType: DeviceImageType
    ) {
        this.#disk = disk;
        this.#deviceHeader = generateDeviceImageHeader(
            baseDeviceHeader,
            disk.size,
            deviceImageType
        );
    }

    get name(): string {
        return this.#disk.name;
    }

    get size(): number {
        return this.#disk.size + this.#deviceHeader.byteLength;
    }

    read(buffer: Uint8Array, offset: number, length: number): number {
        if (offset < this.#deviceHeader.byteLength) {
            if (offset + length > this.#deviceHeader.byteLength) {
                throw new Error(
                    "Cannot read from both device header and disk in one op"
                );
            }
            buffer.set(new Uint8Array(this.#deviceHeader, offset, length));
            return length;
        }
        const diskOffset = offset - this.#deviceHeader.byteLength;
        return this.#disk.read(buffer, diskOffset, length);
    }

    write(buffer: Uint8Array, offset: number, length: number): number {
        if (offset < this.#deviceHeader.byteLength) {
            if (offset + length > this.#deviceHeader.byteLength) {
                throw new Error(
                    "Cannot write to both device header and disk in one op"
                );
            }

            new Uint8Array(this.#deviceHeader, offset).set(
                buffer.subarray(0, length)
            );
            return length;
        }
        const diskOffset = offset - this.#deviceHeader.byteLength;
        return this.#disk.write(buffer, diskOffset, length);
    }

    validate?(): void {
        this.#disk.validate?.();
    }
}
