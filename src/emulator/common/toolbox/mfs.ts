import {pstring} from "@/emulator/common/toolbox/strings";
import {type ReadableDisk} from "@/emulator/common/toolbox/disks";

export const MFS_SIGNATURE = 0xd2d7;

/**
 * Read a bare MFS volume's flat directory, indexed by the file numbers in FCBs.
 */
export function readMFSVolume(disk: ReadableDisk): MFSVolume | undefined {
    if (disk.size < 3 * BLOCK_SIZE) return undefined;
    const header = readBlock(disk, 2);
    const mdb = view(header);
    if (mdb.getUint16(MasterDirectoryBlockFields.drSigWord) !== MFS_SIGNATURE)
        return undefined;
    const files = new Map<number, string>();
    const directoryStart = mdb.getUint16(MasterDirectoryBlockFields.drDirSt);
    const directoryLength = mdb.getUint16(MasterDirectoryBlockFields.drBlLn);
    for (
        let block = directoryStart;
        block < directoryStart + directoryLength;
        block++
    ) {
        const data = readBlock(disk, block);
        const directory = view(data);
        // Entries are even-aligned and never span directory blocks. A zero
        // flags byte marks the unused remainder of this block.
        for (
            let offset = 0;
            offset + DirectoryEntryFields.filNam < data.length && data[offset];
        ) {
            const name = pstring(
                data,
                offset + DirectoryEntryFields.filNam,
                FILE_NAME_MAX_LENGTH
            );
            files.set(
                directory.getUint32(offset + DirectoryEntryFields.filFlNum),
                name
            );
            offset =
                (offset +
                    DirectoryEntryFields.filNam +
                    1 +
                    data[offset + DirectoryEntryFields.filNam] +
                    1) &
                ~1;
        }
    }
    return {
        name: pstring(
            header,
            MasterDirectoryBlockFields.drVN,
            VOLUME_NAME_MAX_LENGTH
        ),
        creationDate: mdb.getUint32(MasterDirectoryBlockFields.drCrDate),
        files,
    };
}

export type MFSVolume = {
    name: string;
    creationDate: number;
    files: Map<number, string>;
};

const BLOCK_SIZE = 512;
const FILE_NAME_MAX_LENGTH = 63;
const VOLUME_NAME_MAX_LENGTH = 27;

// MFS fields from Apple's FSEqu.a; the filename follows the fixed 50-byte
// directory entry. See Inside Macintosh, Volume II, File Manager chapter.
enum MasterDirectoryBlockFields {
    drSigWord = 0,
    drCrDate = 2,
    drDirSt = 14,
    drBlLn = 16,
    drVN = 36,
}

enum DirectoryEntryFields {
    filFlNum = 18,
    filNam = 50,
}

function readBlock(disk: ReadableDisk, block: number): Uint8Array {
    const offset = block * BLOCK_SIZE;
    if (offset + BLOCK_SIZE > disk.size)
        throw new Error("Invalid MFS disk range");
    const data = new Uint8Array(BLOCK_SIZE);
    if (disk.read(data, offset, BLOCK_SIZE) !== BLOCK_SIZE)
        throw new Error("Incomplete MFS disk read");
    return data;
}

function view(data: Uint8Array): DataView {
    return new DataView(data.buffer, data.byteOffset, data.byteLength);
}
