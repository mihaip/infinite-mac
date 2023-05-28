import {EMULATOR_CD_DRIVE_COUNT} from "./emulator-common-emulators";

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

    #cdroms: EmulatorCDROMDrive[] = [];
    #useCDROM: boolean;

    #emscriptenModule: EmscriptenModule;

    constructor(
        disks: EmulatorWorkerDisk[],
        useCDROM: boolean,
        emscriptenModule: EmscriptenModule
    ) {
        this.#disks = disks;
        this.#useCDROM = useCDROM;
        this.#emscriptenModule = emscriptenModule;
        if (useCDROM) {
            for (let i = 0; i < EMULATOR_CD_DRIVE_COUNT; i++) {
                this.#cdroms.push(new EmulatorCDROMDrive());
            }
        }
    }

    isMediaPresent(diskId: DiskId): boolean {
        const disk = this.#openedDisks.get(diskId);
        if (!disk) {
            throw new Error(`Disk not found: ${diskId}`);
        }
        return disk instanceof EmulatorCDROMDrive && disk.hasDisk();
    }

    eject(diskId: DiskId) {
        const disk = this.#openedDisks.get(diskId);
        if (!disk) {
            throw new Error(`Disk not found: ${diskId}`);
        }
        if (!(disk instanceof EmulatorCDROMDrive)) {
            console.warn("Cannot eject non-CD-ROM disk");
            return;
        }
        disk.eject();
    }

    addDisk(disk: EmulatorWorkerDisk) {
        if (this.#useCDROM) {
            const cdrom = this.#cdroms.find(cd => !cd.hasDisk());
            if (cdrom) {
                cdrom.insert(disk);
                return;
            } else {
                console.warn("No empty CD-ROM drive found, discarding disk");
            }
            return;
        }
        this.#disks.push(disk);
        this.#pendingDiskNames.push(disk.name);
    }

    open(name: string): DiskId {
        const diskId = this.#diskIdCounter++;
        let disk: EmulatorWorkerDisk | undefined;
        if (name.startsWith("/cdrom/")) {
            const cdIndex = parseInt(name.slice("/cdrom/".length));
            disk = this.#cdroms[cdIndex];
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
        console.log("close");
        const disk = this.#openedDisks.get(diskId);
        if (!disk) {
            throw new Error(`Disk not found: ${diskId}`);
        }
        this.#openedDisks.delete(diskId);
        if (disk instanceof EmulatorCDROMDrive) {
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

class EmulatorCDROMDrive implements EmulatorWorkerDisk {
    #disk: EmulatorWorkerDisk | undefined;

    get name() {
        if (!this.#disk) {
            console.warn("CD-ROM drive is empty, cannot get name");
            return "";
        }
        return this.#disk.name;
    }

    get size() {
        if (!this.#disk) {
            console.warn("CD-ROM drive is empty, cannot get size");
            return 0;
        }
        return this.#disk.size;
    }

    insert(disk: EmulatorWorkerDisk) {
        if (this.#disk) {
            console.warn("CD-ROM drive was not empty");
            return;
        }
        this.#disk = disk;
    }

    eject() {
        if (!this.#disk) {
            console.warn("CD-ROM drive is empty, cannot eject");
            return;
        }
        this.#disk = undefined;
    }

    hasDisk(): boolean {
        return this.#disk !== undefined;
    }

    read(buffer: Uint8Array, offset: number, length: number): number {
        if (!this.#disk) {
            console.warn("CD-ROM drive is empty, cannot read");
            return 0;
        }
        return this.#disk.read(buffer, offset, length);
    }

    write(buffer: Uint8Array, offset: number, length: number): number {
        if (!this.#disk) {
            console.warn("CD-ROM drive is empty, cannot write");
            return 0;
        }
        return this.#disk.write(buffer, offset, length);
    }

    validate(): void {
        if (!this.#disk) {
            console.warn("CD-ROM drive is empty, cannot validate");
            return;
        }
        return this.#disk.validate?.();
    }
}
