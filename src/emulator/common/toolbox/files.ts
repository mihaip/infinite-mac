import {type MacMemoryReader} from "@/emulator/common/toolbox/memory";
import {LowMem} from "@/emulator/common/toolbox/lowmem";

/**
 * @fileoverview Helpers for dealing with the File Manager and its in-memory
 * data structures. See hfs.ts and mfs.ts for on-disk filesystem helpers.
 */

/**
 * Resolve a file reference number through the guest's FCB and VCB tables.
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
    fileId?: number;
};

const FCB_TABLE_HEADER_SIZE = 2;
const FILE_NAME_MAX_LENGTH = 31;
const VOLUME_NAME_MAX_LENGTH = 27;

function readOpenFileInfoImpl(
    memory: MacMemoryReader,
    refNum: number
): OpenFileInfo | undefined {
    // Before HFS, FSFCBLen is -1 and FCBs have a fixed 30-byte layout.
    const fcbLength = memory.i16(LowMem.FSFCBLen);
    const recordLength = fcbLength > 0 ? fcbLength : MFSFCBLen;
    const table = memory.pointer(LowMem.FCBSPtr);
    if (
        recordLength < MFSFCBLen ||
        refNum < FCB_TABLE_HEADER_SIZE ||
        (refNum - FCB_TABLE_HEADER_SIZE) % recordLength !== 0 ||
        !table ||
        refNum + recordLength > memory.u16(table)
    ) {
        return undefined;
    }
    const fcb = readFileControlBlock(memory, table + refNum, recordLength);
    const volume = fcb.volumeAddress
        ? readVolumeControlBlock(memory, fcb.volumeAddress)
        : undefined;
    return {
        refNum,
        name: fcb.name,
        volume,
        parentId: fcb.parentId,
        fileId: fcb.fileId,
    };
}

type FileControlBlock = {
    volumeAddress: number;
    parentId?: number;
    fileId: number;
    name?: string;
};

/**
 * Read the MFS or extended HFS FCB fields used for source attribution.
 */
function readFileControlBlock(
    memory: MacMemoryReader,
    address: number,
    recordLength: number
): FileControlBlock {
    const fcb = memory.subarray(address, address + recordLength);
    return {
        volumeAddress: fcb.pointer(FCBFields.fcbVPtr),
        fileId: fcb.u32(FCBFields.fcbFlNm),
        parentId:
            recordLength >= fcbEntLen ? fcb.u32(FCBFields.fcbDirID) : undefined,
        name:
            recordLength >= fcbEntLen
                ? fcb.pstring(FCBFields.fcbCName, FILE_NAME_MAX_LENGTH) ||
                  undefined
                : undefined,
    };
}

// FCB sizes and field names from Apple's FSEqu.a.
const fcbEntLen = 94;
const MFSFCBLen = 30;
enum FCBFields {
    fcbFlNm = 0,
    fcbVPtr = 20,
    fcbDirID = 58,
    fcbCName = 62,
}

export type VolumeControlBlock = {
    signature: number;
    name: string;
    creationDate: number;
};

function readVolumeControlBlock(
    memory: MacMemoryReader,
    address: number
): VolumeControlBlock {
    return {
        signature: memory.u16(address + VCBFields.vcbSigWord),
        name: memory.pstring(address + VCBFields.vcbVN, VOLUME_NAME_MAX_LENGTH),
        creationDate: memory.u32(address + VCBFields.vcbCrDate),
    };
}

enum VCBFields {
    vcbSigWord = 8,
    vcbCrDate = 10,
    vcbVN = 44,
}
