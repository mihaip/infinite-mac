import {type EmulatorFileUpload} from "./emulator-common";
import {type EmulatorWorkerDisk} from "./emulator-worker-disks";
import {getUploadData} from "./emulator-worker-files";

export class EmulatorWorkerUploadDisk implements EmulatorWorkerDisk {
    #upload: EmulatorFileUpload;
    #data?: Uint8Array;

    constructor(upload: EmulatorFileUpload) {
        this.#upload = upload;
    }
    get name(): string {
        return this.#upload.name;
    }

    get size(): number {
        return this.#upload.size;
    }

    read(buffer: Uint8Array, offset: number, length: number): number {
        if (!this.#data) {
            this.#data = getUploadData(this.#upload);
        }
        const readSize = Math.min(this.#data.length - offset, length);
        buffer.set(this.#data.subarray(offset, offset + readSize));
        return readSize;
    }

    write(buffer: Uint8Array, offset: number, length: number): number {
        if (!this.#data) {
            this.#data = getUploadData(this.#upload);
        }

        const writeSize = Math.min(this.#data.length - offset, length);
        this.#data.set(buffer.subarray(0, writeSize), offset);
        return writeSize;
    }
}
