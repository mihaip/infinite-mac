import {diskCopy42DataDisk} from "@/emulator/worker/disk-copy-42-disk";
import {type VolumeControlBlock} from "@/emulator/common/toolbox/files";
import {
    HFS_ROOT_DIRECTORY_ID,
    readHFSVolumes,
    readHFSDirectoryThread,
    type HFSVolume,
} from "@/emulator/common/toolbox/hfs";
import {
    type EmulatorWorkerDisk,
    type EmulatorWorkerDisksApi,
} from "@/emulator/worker/disks";

export class HFSPathResolver {
    constructor(private disks: EmulatorWorkerDisksApi) {}

    resolve(
        volume: VolumeControlBlock,
        parentId: number,
        fileName: string
    ): string | undefined {
        try {
            return this.#resolveImpl(volume, parentId, fileName);
        } catch (error) {
            console.warn(
                "Could not resolve HFS path",
                {volume, parentId, fileName},
                error
            );
            return undefined;
        }
    }

    #revision = -1;
    #volumes: HFSVolume[] = [];
    #scannedDisks = new Set<EmulatorWorkerDisk>();
    #directories = new Map<string, string>();

    #resolveImpl(
        sourceVolume: VolumeControlBlock,
        parentId: number,
        fileName: string
    ) {
        if (this.#revision !== this.disks.revision) {
            this.#volumes = [];
            this.#scannedDisks.clear();
            this.#directories.clear();
            this.#revision = this.disks.revision;
        }
        const matchesVolume = (candidate: HFSVolume) =>
            candidate.name === sourceVolume.name &&
            candidate.creationDate === sourceVolume.creationDate;
        let volume = this.#volumes.find(matchesVolume);
        if (!volume) {
            for (const disk of this.disks.readableDisks()) {
                if (this.#scannedDisks.has(disk)) continue;
                let discovered: HFSVolume[];
                try {
                    discovered = readHFSVolumes(diskCopy42DataDisk(disk));
                } catch (error) {
                    console.warn(
                        "Could not read HFS volumes from disk",
                        {disk: disk.name},
                        error
                    );
                    continue;
                }
                this.#scannedDisks.add(disk);
                this.#volumes.push(...discovered);
                volume = discovered.find(matchesVolume);
                if (volume) break;
            }
        }
        if (!volume) {
            console.warn("Could not find HFS volume", sourceVolume);
            return undefined;
        }

        const cacheKey = `${sourceVolume.name}:${sourceVolume.creationDate}:${parentId}`;
        let directory = this.#directories.get(cacheKey);
        if (directory === undefined) {
            const names: string[] = [];
            const visited = new Set<number>();
            let current = parentId;
            while (current !== HFS_ROOT_DIRECTORY_ID) {
                if (
                    visited.has(current) ||
                    visited.size >= MAX_PATH_COMPONENTS
                ) {
                    throw new Error("Invalid HFS directory hierarchy");
                }
                visited.add(current);
                const thread = readHFSDirectoryThread(volume, current);
                if (!thread) {
                    console.warn("Could not find HFS directory thread", {
                        volume: sourceVolume,
                        directoryId: current,
                        fileName,
                    });
                    return undefined;
                }
                names.unshift(thread.name);
                current = thread.parentId;
            }
            names.unshift(volume.name);
            directory = names.join(":");
            this.#directories.set(cacheKey, directory);
        }
        return `${directory}:${fileName}`;
    }
}

const MAX_PATH_COMPONENTS = 64;
