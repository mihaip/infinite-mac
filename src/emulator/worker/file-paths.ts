import {type OpenFileInfo} from "@/emulator/common/toolbox/files";
import {MFS_SIGNATURE} from "@/emulator/common/toolbox/mfs";
import {type EmulatorWorkerDisksApi} from "@/emulator/worker/disks";
import {HFSPathResolver} from "@/emulator/worker/hfs-paths";
import {MFSPathResolver} from "@/emulator/worker/mfs-paths";

export class FilePathResolver {
    constructor(disks: EmulatorWorkerDisksApi) {
        this.#hfs = new HFSPathResolver(disks);
        this.#mfs = new MFSPathResolver(disks);
    }

    resolve(file: OpenFileInfo): string | undefined {
        if (!file.volume) return undefined;
        if (file.volume.signature === MFS_SIGNATURE) {
            return this.#mfs.resolve(file.volume, file.fileId, file.name);
        }
        if (!file.name || file.parentId === undefined) return undefined;
        return this.#hfs.resolve(file.volume, file.parentId, file.name);
    }

    #hfs: HFSPathResolver;
    #mfs: MFSPathResolver;
}
