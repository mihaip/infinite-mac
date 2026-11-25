import {type MacMemoryReader} from "@/emulator/common/toolbox/memory";
import {LowMem} from "@/emulator/common/toolbox/lowmem";

/**
 * @fileoverview Helpers for dealing with the File Manager and its in-memory
 * data structures. See hfs.ts for on-disk HFS helpers.
 */

/**
 * Resolve an HFS file reference number through the guest's FCB and VCB tables.
 * File metadata is best effort when the tables are unavailable or malformed.
 */
export function readOpenFileInfo(
    memory: MacMemoryReader,
    refNum: number
): OpenFileInfo | undefined {
    try {
        return readOpenFileInfoImpl(memory, refNum);
    } catch (error) {
        console.warn("Could not read open file info", {refNum}, error);
        return undefined;
    }
}

export type OpenFileInfo = {
    refNum: number;
    name?: string;
    volume?: VolumeControlBlock;
    parentId?: number;
};

const FCB_TABLE_HEADER_SIZE = 2;
const FILE_NAME_MAX_LENGTH = 31;
const VOLUME_NAME_MAX_LENGTH = 27;

function readOpenFileInfoImpl(
    memory: MacMemoryReader,
    refNum: number
): OpenFileInfo | undefined {
    // In HFS FCBs the file reference number is an offset into the table.
    const recordLength = memory.u16(LowMem.FSFCBLen);
    const table = memory.pointer(LowMem.FCBSPtr);
    if (
        recordLength < fcbEntLen ||
        refNum < FCB_TABLE_HEADER_SIZE ||
        (refNum - FCB_TABLE_HEADER_SIZE) % recordLength !== 0 ||
        !table ||
        refNum + recordLength > memory.u16(table)
    ) {
        return undefined;
    }
    const fcb = readFileControlBlock(memory, table + refNum);
    const volume = fcb.volumeAddress
        ? readVolumeControlBlock(memory, fcb.volumeAddress)
        : undefined;
    return {
        refNum,
        name: fcb.name,
        volume,
        parentId: fcb.parentId,
    };
}

type FileControlBlock = {
    volumeAddress: number;
    parentId: number;
    name?: string;
};

/** Read the HFS FCB fields used for source attribution. */
function readFileControlBlock(
    memory: MacMemoryReader,
    address: number
): FileControlBlock {
    const fcb = memory.subarray(address, address + fcbEntLen);
    return {
        volumeAddress: fcb.pointer(FCBFields.fcbVPtr),
        parentId: fcb.u32(FCBFields.fcbDirID),
        name:
            fcb.pstring(FCBFields.fcbCName, FILE_NAME_MAX_LENGTH) || undefined,
    };
}

// HFS FCB size and field names from Apple's FSEqu.a.
const fcbEntLen = 94;
enum FCBFields {
    fcbVPtr = 20,
    fcbDirID = 58,
    fcbCName = 62,
}

export type VolumeControlBlock = {
    name: string;
    creationDate: number;
};

function readVolumeControlBlock(
    memory: MacMemoryReader,
    address: number
): VolumeControlBlock {
    return {
        name: memory.pstring(address + VCBFields.vcbVN, VOLUME_NAME_MAX_LENGTH),
        creationDate: memory.u32(address + VCBFields.vcbCrDate),
    };
}

enum VCBFields {
    vcbCrDate = 10,
    vcbVN = 44,
}
