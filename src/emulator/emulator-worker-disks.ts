declare const Module: EmscriptenModule;
type DiskId = number;

export interface EmulatorWorkerDisk {
    name: string;
    size: number;

    read(buffer: Uint8Array, offset: number, length: number): number;
    write(buffer: Uint8Array, offset: number, length: number): number;
    validate?(): void;
}

export class EmulatorWorkerDisksApi {
    #disks: EmulatorWorkerDisk[];
    #openedDisks = new Map<DiskId, EmulatorWorkerDisk>();
    #pendingDiskNames: string[] = [];
    #lastDiskWriteTime = 0;
    #diskIdCounter = 0;

    constructor(disks: EmulatorWorkerDisk[]) {
        this.#disks = disks;
    }

    addDisk(disk: EmulatorWorkerDisk) {
        this.#disks.push(disk);
        this.#pendingDiskNames.push(disk.name);
    }

    open(name: string): DiskId {
        const diskId = this.#diskIdCounter++;
        const disk = this.#disks.find(d => d.name === name);
        if (!disk) {
            console.warn(`Disk not found: ${name}`);
            return -1;
        }
        this.#openedDisks.set(diskId, disk);
        return diskId;
    }

    close(diskId: DiskId) {
        const removed = this.#openedDisks.delete(diskId);
        if (!removed) {
            throw new Error(`Disk not found: ${diskId}`);
        }
    }

    read(
        diskId: DiskId,
        bufPtr: number,
        offset: number,
        length: number
    ): number {
        const disk = this.#openedDisks.get(diskId);
        if (!disk) {
            throw new Error(`Disk not found: ${diskId}`);
        }

        const buffer = Module.HEAPU8.subarray(bufPtr, bufPtr + length);
        return disk.read(buffer, offset, length);
    }

    write(
        diskId: DiskId,
        bufPtr: number,
        offset: number,
        length: number
    ): number {
        const disk = this.#openedDisks.get(diskId);
        if (!disk) {
            throw new Error(`Disk not found: ${diskId}`);
        }

        this.#lastDiskWriteTime = performance.now();
        const buffer = Module.HEAPU8.subarray(bufPtr, bufPtr + length);
        return disk.write(buffer, offset, length);
    }

    size(diskId: DiskId): number {
        const disk = this.#openedDisks.get(diskId);
        if (!disk) {
            throw new Error(`Disk not found: ${diskId}`);
        }
        return disk.size;
    }

    validate() {
        for (const disk of this.#disks) {
            disk.validate?.();
        }
    }

    isDoneWithDiskWrites(): boolean {
        return (
            this.#lastDiskWriteTime !== 0 &&
            performance.now() - this.#lastDiskWriteTime > 1000
        );
    }

    consumeDiskName(): string | undefined {
        return this.#pendingDiskNames.shift();
    }
}
