import {EMULATOR_REMOVABLE_DISK_COUNT} from "./emulator-common-emulators";

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

    #removableDisks: EmulatorRemovableDisk[] = [];
    #useRemovableDisks: boolean;

    #emscriptenModule: EmscriptenModule;

    constructor(
        disks: EmulatorWorkerDisk[],
        useRemovableDisks: boolean,
        emscriptenModule: EmscriptenModule
    ) {
        this.#disks = disks;
        this.#useRemovableDisks = useRemovableDisks;
        this.#emscriptenModule = emscriptenModule;
        if (useRemovableDisks) {
            for (let i = 0; i < EMULATOR_REMOVABLE_DISK_COUNT; i++) {
                this.#removableDisks.push(new EmulatorRemovableDisk());
            }
        }
    }

    isMediaPresent(diskId: DiskId): boolean {
        const disk = this.#openedDisks.get(diskId);
        if (!disk) {
            throw new Error(`Disk not found: ${diskId}`);
        }
        if (!(disk instanceof EmulatorRemovableDisk)) {
            // Assumed to be non-removable and thus always present.
            return true;
        }
        return disk.hasDisk();
    }

    isFixedDisk(diskId: DiskId): boolean {
        const disk = this.#openedDisks.get(diskId);
        if (!disk) {
            throw new Error(`Disk not found: ${diskId}`);
        }
        return !(disk instanceof EmulatorRemovableDisk);
    }

    eject(diskId: DiskId) {
        const disk = this.#openedDisks.get(diskId);
        if (!disk) {
            throw new Error(`Disk not found: ${diskId}`);
        }
        if (!(disk instanceof EmulatorRemovableDisk)) {
            console.warn("Cannot eject non-removable disk");
            return;
        }
        disk.eject();
    }

    addDisk(disk: EmulatorWorkerDisk) {
        if (this.#useRemovableDisks) {
            const removableDisk = this.#removableDisks.find(
                cd => !cd.hasDisk()
            );
            if (removableDisk) {
                removableDisk.insert(disk);
                return;
            } else {
                console.warn(
                    "No empty removable disk drive found, discarding disk"
                );
            }
            return;
        }
        this.#disks.push(disk);
        this.#pendingDiskNames.push(disk.name);
    }

    open(name: string): DiskId {
        const diskId = this.#diskIdCounter++;
        let disk: EmulatorWorkerDisk | undefined;
        if (name.startsWith("/placeholder/")) {
            const index = parseInt(name.slice("/placeholder/".length));
            disk = this.#removableDisks[index];
        } else {
            disk = this.#disks.find(d => d.name === name);
        }
        if (!disk) {
            console.warn(`Disk not found: ${name}`);
            return -1;
        }
        this.#openedDisks.set(diskId, disk);
        return diskId;
    }

    close(diskId: DiskId) {
        const disk = this.#openedDisks.get(diskId);
        if (!disk) {
            throw new Error(`Disk not found: ${diskId}`);
        }
        this.#openedDisks.delete(diskId);
        if (disk instanceof EmulatorRemovableDisk) {
            disk.eject();
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

        const buffer = this.#emscriptenModule.HEAPU8.subarray(
            bufPtr,
            bufPtr + length
        );
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
        const buffer = this.#emscriptenModule.HEAPU8.subarray(
            bufPtr,
            bufPtr + length
        );
        return disk.write(buffer, offset, length);
    }

    size(diskIdOrName: DiskId | string): number {
        const disk =
            typeof diskIdOrName === "string"
                ? this.#disks.find(d => d.name === diskIdOrName)
                : this.#openedDisks.get(diskIdOrName);
        if (!disk) {
            throw new Error(`Disk not found: ${diskIdOrName}`);
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

class EmulatorRemovableDisk implements EmulatorWorkerDisk {
    #disk: EmulatorWorkerDisk | undefined;

    get name() {
        if (!this.#disk) {
            console.warn("Removable disk drive is empty, cannot get name");
            return "";
        }
        return this.#disk.name;
    }

    get size() {
        if (!this.#disk) {
            console.warn("Removable disk drive is empty, cannot get size");
            return 0;
        }
        return this.#disk.size;
    }

    insert(disk: EmulatorWorkerDisk) {
        if (this.#disk) {
            console.warn("Removable drive was not empty");
            return;
        }
        this.#disk = disk;
    }

    eject() {
        if (!this.#disk) {
            console.warn("Removable drive is empty, cannot eject");
            return;
        }
        this.#disk = undefined;
    }

    hasDisk(): boolean {
        return this.#disk !== undefined;
    }

    read(buffer: Uint8Array, offset: number, length: number): number {
        if (!this.#disk) {
            console.warn("Removable disk drive is empty, cannot read");
            return 0;
        }
        return this.#disk.read(buffer, offset, length);
    }

    write(buffer: Uint8Array, offset: number, length: number): number {
        if (!this.#disk) {
            console.warn("Removable disk drive is empty, cannot write");
            return 0;
        }
        return this.#disk.write(buffer, offset, length);
    }

    validate(): void {
        if (!this.#disk) {
            console.warn("Removable disk drive is empty, cannot validate");
            return;
        }
        return this.#disk.validate?.();
    }
}
