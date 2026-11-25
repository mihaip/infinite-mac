import {pstring} from "@/emulator/common/toolbox/strings";

/**
 * @fileoverview Helpers for dealing with HFS volumes and on-disk data
 * structures. See files.ts for in-memory/File Manager helpers.
 */

export const HFS_ROOT_DIRECTORY_ID = 2;

/**
 * Accept bare HFS partitions and Apple Partition Map device images.
 */
export function readHFSVolumes(disk: HFSReadableDisk): HFSVolume[] {
    if (disk.size < 3 * BLOCK_SIZE) return [];
    const flat = volumeAt(disk, 0);
    if (flat) return [flat];
    const first = readExact(disk, BLOCK_SIZE, BLOCK_SIZE);
    const firstView = view(first);
    if (firstView.getUint16(PartitionMapFields.pmSig) !== PARTITION_SIGNATURE)
        return [];
    const volumes: HFSVolume[] = [];
    const partitionCount = firstView.getUint32(PartitionMapFields.pmMapBlkCnt);
    if (partitionCount > MAX_PARTITIONS) {
        console.warn("HFS partition map exceeds the scan limit", {
            partitionCount,
            limit: MAX_PARTITIONS,
        });
    }
    const count = Math.min(partitionCount, MAX_PARTITIONS);
    for (let index = 1; index <= count; index++) {
        const block =
            index === 1
                ? first
                : readExact(disk, index * BLOCK_SIZE, BLOCK_SIZE);
        const partition = view(block);
        const type = block.subarray(
            PartitionMapFields.pmParType,
            PartitionMapFields.pmParType + 32
        );
        const end = type.indexOf(0);
        if (
            partition.getUint16(PartitionMapFields.pmSig) !==
                PARTITION_SIGNATURE ||
            new TextDecoder().decode(
                end === -1 ? type : type.subarray(0, end)
            ) !== "Apple_HFS"
        )
            continue;
        const volume = volumeAt(
            disk,
            partition.getUint32(PartitionMapFields.pmPyPartStart) * BLOCK_SIZE
        );
        if (volume) volumes.push(volume);
    }
    return volumes;
}

/**
 * Find the empty-name key for a directory ID, then read its parent ID and name.
 */
export function readHFSDirectoryThread(volume: HFSVolume, directoryId: number) {
    const header = view(readCatalog(volume, 0, BTreeHeaderFields.nodeSize + 2));
    const nodeSize = header.getUint16(BTreeHeaderFields.nodeSize);
    let nodeNumber = header.getUint32(BTreeHeaderFields.rootNode);
    if (nodeSize < MIN_NODE_SIZE || nodeSize > MAX_NODE_SIZE)
        throw new Error("Invalid HFS B-tree node size");
    for (let depth = 0; nodeNumber && depth < MAX_BTREE_DEPTH; depth++) {
        const data = readCatalog(volume, nodeNumber * nodeSize, nodeSize);
        const node = view(data);
        const offsets = recordOffsets(node);
        const kind = node.getInt8(NodeDescriptorFields.kind);
        if (kind === INDEX_NODE) {
            let child = 0;
            for (const offset of offsets) {
                const key = catalogKey(data, node, offset);
                if (compareThreadKey(key, directoryId) > 0) break;
                child = node.getUint32(key.dataOffset);
            }
            nodeNumber = child;
            continue;
        }
        if (kind !== LEAF_NODE)
            throw new Error("Invalid HFS catalog node kind");
        for (const offset of offsets) {
            const key = catalogKey(data, node, offset);
            const comparison = compareThreadKey(key, directoryId);
            if (comparison > 0) break;
            if (comparison) continue;
            const record = new DataView(
                data.buffer,
                data.byteOffset + key.dataOffset,
                data.byteLength - key.dataOffset
            );
            if (
                record.getUint16(CatalogThreadFields.recordType) !==
                DIRECTORY_THREAD_RECORD
            )
                throw new Error("Invalid HFS directory thread");
            return {
                parentId: record.getUint32(CatalogThreadFields.parentID),
                name: pstring(
                    data,
                    key.dataOffset + CatalogThreadFields.nodeName,
                    FILE_NAME_MAX_LENGTH
                ),
            };
        }
        return undefined;
    }
    if (nodeNumber) throw new Error("Invalid HFS B-tree depth");
    return undefined;
}

export type HFSReadableDisk = {
    readonly size: number;
    read(buffer: Uint8Array, offset: number, length: number): number;
};

export type HFSVolume = {
    /** Raw HFS timestamp, in seconds since January 1, 1904. */
    creationDate: number;
    name: string;
    allocationBlockSize: number;
    allocationStart: number;
    catalogSize: number;
    catalogExtents: Extent[];
    disk: HFSReadableDisk;
};

type Extent = {start: number; count: number};

const BLOCK_SIZE = 512;
const HFS_SIGNATURE = 0x4244; // 'BD'
const PARTITION_SIGNATURE = 0x504d; // 'PM'
const MAX_PARTITIONS = 64;
const MAX_BTREE_DEPTH = 16;
const FILE_NAME_MAX_LENGTH = 31;
const VOLUME_NAME_MAX_LENGTH = 27;
const MASTER_DIRECTORY_BLOCK_SIZE = 162;
const NODE_DESCRIPTOR_SIZE = 14;
const MIN_CATALOG_KEY_LENGTH = 6;
const MIN_NODE_SIZE = 256;
const MAX_NODE_SIZE = 32768;
const DIRECTORY_THREAD_RECORD = 0x0300;
const INDEX_NODE = 0;
const LEAF_NODE = -1;

// HFS fields from Apple's hfs_format.h:
// https://github.com/apple-oss-distributions/hfs/blob/main/core/hfs_format.h
enum MasterDirectoryBlockFields {
    drSigWord = 0,
    drCrDate = 2,
    drAlBlkSiz = 20,
    drAlBlSt = 28,
    drVN = 36,
    drCTFlSize = 146,
    drCTExtRec = 150,
}

enum PartitionMapFields {
    pmSig = 0,
    pmMapBlkCnt = 4,
    pmPyPartStart = 8,
    pmParType = 48,
}

enum BTreeHeaderFields {
    rootNode = NODE_DESCRIPTOR_SIZE + 2,
    nodeSize = NODE_DESCRIPTOR_SIZE + 18,
}

enum NodeDescriptorFields {
    kind = 8,
    numRecords = 10,
}

enum CatalogKeyFields {
    keyLength = 0,
    parentID = 2,
    nodeName = 6,
}

enum CatalogThreadFields {
    recordType = 0,
    parentID = 10,
    nodeName = 14,
}

function view(data: Uint8Array): DataView {
    return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function readExact(
    disk: HFSReadableDisk,
    offset: number,
    length: number
): Uint8Array {
    if (offset < 0 || length < 0 || offset + length > disk.size) {
        throw new Error("Invalid HFS disk range");
    }
    const data = new Uint8Array(length);
    if (disk.read(data, offset, length) !== length) {
        throw new Error("Incomplete HFS disk read");
    }
    return data;
}

function volumeAt(disk: HFSReadableDisk, start: number): HFSVolume | undefined {
    const data = readExact(
        disk,
        start + 2 * BLOCK_SIZE,
        MASTER_DIRECTORY_BLOCK_SIZE
    );
    const mdb = view(data);
    if (mdb.getUint16(MasterDirectoryBlockFields.drSigWord) !== HFS_SIGNATURE)
        return undefined;
    const name = pstring(
        data,
        MasterDirectoryBlockFields.drVN,
        VOLUME_NAME_MAX_LENGTH
    );
    const allocationBlockSize = mdb.getUint32(
        MasterDirectoryBlockFields.drAlBlkSiz
    );
    const allocationStart =
        start + mdb.getUint16(MasterDirectoryBlockFields.drAlBlSt) * BLOCK_SIZE;
    const catalogSize = mdb.getUint32(MasterDirectoryBlockFields.drCTFlSize);
    if (!allocationBlockSize || allocationBlockSize % BLOCK_SIZE) {
        throw new Error("Invalid HFS allocation block size");
    }
    const catalogExtents: Extent[] = [];
    for (let index = 0; index < 3; index++) {
        const offset = MasterDirectoryBlockFields.drCTExtRec + index * 4;
        const extent = {
            start: mdb.getUint16(offset),
            count: mdb.getUint16(offset + 2),
        };
        if (extent.count) catalogExtents.push(extent);
    }
    const covered = catalogExtents.reduce(
        (total, extent) => total + extent.count * allocationBlockSize,
        0
    );
    // Only catalogs covered by the MDB's three extents are supported. Catalogs
    // that require the extents-overflow file remain unresolved.
    if (!catalogSize) {
        console.warn("HFS volume has no catalog", {name, start});
        return undefined;
    }
    if (covered < catalogSize) {
        console.warn("HFS catalog requires unsupported overflow extents", {
            name,
            start,
            catalogSize,
            coveredBytes: covered,
        });
        return undefined;
    }
    return {
        name,
        creationDate: mdb.getUint32(MasterDirectoryBlockFields.drCrDate),
        allocationBlockSize,
        allocationStart,
        catalogSize,
        catalogExtents,
        disk,
    };
}

/**
 * Read a catalog-file range, including reads that cross its initial extents.
 */
function readCatalog(
    volume: HFSVolume,
    offset: number,
    length: number
): Uint8Array {
    if (offset < 0 || length < 0 || offset + length > volume.catalogSize) {
        throw new Error("Invalid HFS catalog range");
    }
    const result = new Uint8Array(length);
    let resultOffset = 0;
    let fileOffset = offset;
    for (const extent of volume.catalogExtents) {
        const extentLength = extent.count * volume.allocationBlockSize;
        if (fileOffset >= extentLength) {
            fileOffset -= extentLength;
            continue;
        }
        const partLength = Math.min(
            length - resultOffset,
            extentLength - fileOffset
        );
        const diskOffset =
            volume.allocationStart +
            extent.start * volume.allocationBlockSize +
            fileOffset;
        result.set(
            readExact(volume.disk, diskOffset, partLength),
            resultOffset
        );
        resultOffset += partLength;
        fileOffset = 0;
        if (resultOffset === length) return result;
    }
    throw new Error("HFS catalog extents do not cover the requested range");
}

function recordOffsets(node: DataView): number[] {
    const count = node.getUint16(NodeDescriptorFields.numRecords);
    const tableStart = node.byteLength - (count + 1) * 2;
    if (tableStart < NODE_DESCRIPTOR_SIZE)
        throw new Error("Invalid HFS node record count");
    const offsets: number[] = [];
    for (let index = 0; index < count; index++) {
        const offset = node.getUint16(node.byteLength - (index + 1) * 2);
        if (offset < NODE_DESCRIPTOR_SIZE || offset >= tableStart)
            throw new Error("Invalid HFS node record offset");
        offsets.push(offset);
    }
    return offsets;
}

function catalogKey(data: Uint8Array, node: DataView, offset: number) {
    const length = node.getUint8(offset + CatalogKeyFields.keyLength);
    if (length < MIN_CATALOG_KEY_LENGTH || offset + 1 + length > data.length) {
        throw new Error("Invalid HFS catalog key");
    }
    return {
        parentId: node.getUint32(offset + CatalogKeyFields.parentID),
        name: pstring(
            data,
            offset + CatalogKeyFields.nodeName,
            FILE_NAME_MAX_LENGTH
        ),
        // Catalog record data begins on an even byte boundary.
        dataOffset: (offset + 1 + length + 1) & ~1,
    };
}

function compareThreadKey(
    key: {parentId: number; name: string},
    directoryId: number
): number {
    if (key.parentId !== directoryId) return key.parentId - directoryId;
    return key.name.length ? 1 : 0;
}
