import {type VolumeControlBlock} from "@/emulator/common/toolbox/files";
import {readMFSVolume, type MFSVolume} from "@/emulator/common/toolbox/mfs";
import {diskCopy42DataDisk} from "@/emulator/worker/disk-copy-42-disk";
import {
    type EmulatorWorkerDisksApi,
    type EmulatorWorkerDisk,
} from "@/emulator/worker/disks";

export class MFSPathResolver {
    constructor(private disks: EmulatorWorkerDisksApi) {}

    resolve(
        volume: VolumeControlBlock,
        fileId: number | undefined,
        fileName: string | undefined
    ): string | undefined {
        try {
            return this.#resolveImpl(volume, fileId, fileName);
        } catch (error) {
            console.warn(
                "Could not resolve MFS file",
                {volume, fileId, fileName},
                error
            );
            return undefined;
        }
    }

    #revision = -1;
    #volumes = new Map<EmulatorWorkerDisk, MFSVolume | undefined>();

    #resolveImpl(
        volume: VolumeControlBlock,
        fileId: number | undefined,
        fileName: string | undefined
    ) {
        const name = fileName ?? this.#fileName(volume, fileId);
        return name ? `${volume.name}:${name}` : undefined;
    }

    #fileName(
        sourceVolume: VolumeControlBlock,
        fileId: number | undefined
    ): string | undefined {
        if (fileId === undefined) return undefined;
        if (this.#revision !== this.disks.revision) {
            this.#volumes.clear();
            this.#revision = this.disks.revision;
        }
        for (const disk of this.disks.readableDisks()) {
            if (!this.#volumes.has(disk)) {
                try {
                    this.#volumes.set(
                        disk,
                        readMFSVolume(diskCopy42DataDisk(disk))
                    );
                } catch (error) {
                    console.warn(
                        "Could not read MFS volume from disk",
                        {disk: disk.name},
                        error
                    );
                    this.#volumes.set(disk, undefined);
                }
            }
            const volume = this.#volumes.get(disk);
            if (
                volume?.name === sourceVolume.name &&
                volume.creationDate === sourceVolume.creationDate
            ) {
                const name = volume.files.get(fileId);
                if (!name)
                    console.warn("Could not find MFS file", {
                        volume: sourceVolume,
                        fileId,
                    });
                return name;
            }
        }
        console.warn("Could not find MFS volume", sourceVolume);
        return undefined;
    }
}
