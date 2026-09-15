import {type EmulatorWorkerDisk} from "@/emulator/worker/disks";
import {
    emulatorSupportsDiskCopy42Disks,
    type EmulatorType,
} from "@/emulator/common/emulators";

const DISK_COPY_42_HEADER_SIZE = 84;
const DISK_COPY_42_MIN_DATA_SIZE = 400 * 1024;
const DISK_COPY_42_MIN_FILE_SIZE =
    DISK_COPY_42_HEADER_SIZE + DISK_COPY_42_MIN_DATA_SIZE;
const DISK_COPY_42_SECTOR_SIZE = 512;
const DISK_COPY_42_TAG_SIZE = 12;
const DISK_COPY_42_MAGIC_OFFSET = 82;
const DISK_COPY_42_MAGIC = 0x0100;

// DiskCopy 4.2 images contain floppy-sized payloads (up to 1.44MB), plus an
// 84-byte header and optional 12-byte tags for each 512-byte sector. Avoid a
// synchronous header read for larger hard disk and CD-ROM images.
const DISK_COPY_42_MAX_FILE_SIZE = 2 * 1024 * 1024;

/**
 * Detects a DiskCopy 4.2 container by its header. Emulators that understand
 * the container receive it intact; other emulators see its raw sector data.
 */
export function prepareDiskCopy42Disk(
    disk: EmulatorWorkerDisk,
    emulatorType: EmulatorType
): EmulatorWorkerDisk {
    if (
        disk.size < DISK_COPY_42_MIN_FILE_SIZE ||
        disk.size > DISK_COPY_42_MAX_FILE_SIZE
    ) {
        return disk;
    }

    const header = new Uint8Array(DISK_COPY_42_HEADER_SIZE);
    if (disk.read(header, 0, header.length) !== header.length) {
        return disk;
    }

    const dataSize = diskCopy42DataSize(header, disk.size);
    if (dataSize === undefined) {
        return disk;
    }

    disk.isFloppy = true;
    if (emulatorSupportsDiskCopy42Disks(emulatorType)) {
        return disk;
    }
    return new EmulatorWorkerDiskCopy42Disk(disk, dataSize);
}

function diskCopy42DataSize(
    header: Uint8Array,
    fileSize: number
): number | undefined {
    const view = new DataView(
        header.buffer,
        header.byteOffset,
        header.byteLength
    );
    const nameLength = header[0];
    const dataSize = view.getUint32(64);
    const tagSize = view.getUint32(68);
    // DC42 has no leading magic bytes. This value in the header's historical
    // "private" field is its format signature.
    const magic = view.getUint16(DISK_COPY_42_MAGIC_OFFSET);
    const expectedTagSize =
        (dataSize / DISK_COPY_42_SECTOR_SIZE) * DISK_COPY_42_TAG_SIZE;
    if (
        magic !== DISK_COPY_42_MAGIC ||
        nameLength >= 64 ||
        dataSize < DISK_COPY_42_MIN_DATA_SIZE ||
        dataSize % DISK_COPY_42_SECTOR_SIZE !== 0 ||
        (tagSize !== 0 && tagSize !== expectedTagSize) ||
        DISK_COPY_42_HEADER_SIZE + dataSize + tagSize !== fileSize
    ) {
        return undefined;
    }
    return dataSize;
}

export class EmulatorWorkerDiskCopy42Disk implements EmulatorWorkerDisk {
    readonly isFloppy = true;

    #disk: EmulatorWorkerDisk;
    #dataSize: number;

    constructor(disk: EmulatorWorkerDisk, dataSize: number) {
        this.#disk = disk;
        this.#dataSize = dataSize;
    }

    get name(): string {
        return this.#disk.name;
    }

    get size(): number {
        return this.#dataSize;
    }

    read(buffer: Uint8Array, offset: number, length: number): number {
        return this.#disk.read(
            buffer,
            DISK_COPY_42_HEADER_SIZE + offset,
            length
        );
    }

    write(buffer: Uint8Array, offset: number, length: number): number {
        return this.#disk.write(
            buffer,
            DISK_COPY_42_HEADER_SIZE + offset,
            length
        );
    }

    validate(): void {
        this.#disk.validate?.();
    }
}
