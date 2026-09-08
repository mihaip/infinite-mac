export type ReadableDisk = {
    name: string;
    size: number;
    read(buffer: Uint8Array, offset: number, length: number): number;
};

const BLOCK_SIZE = 512;
const HFS_SIGNATURE = 0x4244;
const PARTITION_SIGNATURE = 0x504d;
const ROOT_DIRECTORY_ID = 2;
const MAX_PARTITIONS = 64;
const MAX_PATH_COMPONENTS = 64;

type Extent = {start: number; count: number};

type HFSVolume = {
    name: string;
    allocationBlockSize: number;
    allocationStart: number;
    catalogSize: number;
    catalogExtents: Extent[];
    disk: ReadableDisk;
};

const decoder = new TextDecoder("macintosh");

function pstring(data: Uint8Array, offset: number, limit = 31) {
    if (offset >= data.length) return;
    const length = data[offset];
    if (length > limit || offset + 1 + length > data.length) return;
    return decoder.decode(data.subarray(offset + 1, offset + 1 + length));
}

function cstring(data: Uint8Array, offset: number, length: number) {
    let end = offset;
    while (end < offset + length && data[end]) end++;
    return new TextDecoder().decode(data.subarray(offset, end));
}

function readExact(disk: ReadableDisk, offset: number, length: number) {
    if (offset < 0 || length < 0 || offset + length > disk.size) return;
    const data = new Uint8Array(length);
    return disk.read(data, offset, length) === length ? data : undefined;
}

function volumeAt(disk: ReadableDisk, start: number): HFSVolume | undefined {
    const mdb = readExact(disk, start + 2 * BLOCK_SIZE, 162);
    if (!mdb) return;
    const view = new DataView(mdb.buffer, mdb.byteOffset, mdb.byteLength);
    if (view.getUint16(0) !== HFS_SIGNATURE) return;
    const name = pstring(mdb, 36, 27);
    const allocationBlockSize = view.getUint32(20);
    const allocationStart = start + view.getUint16(28) * BLOCK_SIZE;
    const catalogSize = view.getUint32(146);
    if (
        !name ||
        !allocationBlockSize ||
        allocationBlockSize % BLOCK_SIZE ||
        !catalogSize
    )
        return;
    const catalogExtents: Extent[] = [];
    for (let offset = 150; offset < 162; offset += 4) {
        const extent = {
            start: view.getUint16(offset),
            count: view.getUint16(offset + 2),
        };
        if (extent.count) catalogExtents.push(extent);
    }
    const covered = catalogExtents.reduce(
        (total, extent) => total + extent.count * allocationBlockSize,
        0
    );
    if (covered < catalogSize) return; // Extents overflow is not needed by our images.
    return {
        name,
        allocationBlockSize,
        allocationStart,
        catalogSize,
        catalogExtents,
        disk,
    };
}

function volumesOnDisk(disk: ReadableDisk) {
    const volumes: HFSVolume[] = [];
    const flat = volumeAt(disk, 0);
    if (flat) volumes.push(flat);
    const first = readExact(disk, BLOCK_SIZE, BLOCK_SIZE);
    if (!first) return volumes;
    const firstView = new DataView(
        first.buffer,
        first.byteOffset,
        first.byteLength
    );
    if (firstView.getUint16(0) !== PARTITION_SIGNATURE) return volumes;
    const count = Math.min(firstView.getUint32(4), MAX_PARTITIONS);
    for (let index = 1; index <= count; index++) {
        const block =
            index === 1
                ? first
                : readExact(disk, index * BLOCK_SIZE, BLOCK_SIZE);
        if (!block) continue;
        const view = new DataView(
            block.buffer,
            block.byteOffset,
            block.byteLength
        );
        if (
            view.getUint16(0) === PARTITION_SIGNATURE &&
            cstring(block, 48, 32) === "Apple_HFS"
        ) {
            const volume = volumeAt(disk, view.getUint32(8) * BLOCK_SIZE);
            if (volume) volumes.push(volume);
        }
    }
    return volumes;
}

function readCatalog(volume: HFSVolume, offset: number, length: number) {
    if (offset < 0 || length < 0 || offset + length > volume.catalogSize)
        return;
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
        const part = readExact(volume.disk, diskOffset, partLength);
        if (!part) return;
        result.set(part, resultOffset);
        resultOffset += partLength;
        fileOffset = 0;
        if (resultOffset === length) return result;
    }
}

function recordOffsets(node: Uint8Array) {
    if (node.length < 16) return;
    const view = new DataView(node.buffer, node.byteOffset, node.byteLength);
    const count = view.getUint16(10);
    if (count > (node.length - 14) / 2) return;
    const offsets: number[] = [];
    for (let i = 0; i < count; i++) {
        const offset = view.getUint16(node.length - (i + 1) * 2);
        if (offset < 14 || offset >= node.length - (count + 1) * 2) return;
        offsets.push(offset);
    }
    return offsets;
}

function catalogKey(node: Uint8Array, offset: number) {
    const length = node[offset];
    if (length < 6 || offset + 1 + length > node.length) return;
    const view = new DataView(node.buffer, node.byteOffset, node.byteLength);
    const name = pstring(node, offset + 6);
    if (name === undefined) return;
    return {
        parentID: view.getUint32(offset + 2),
        name,
        dataOffset: (offset + 1 + length + 1) & ~1,
    };
}

function compareThreadKey(
    key: {parentID: number; name: string},
    directoryID: number
) {
    if (key.parentID !== directoryID) return key.parentID - directoryID;
    return key.name.length ? 1 : 0;
}

function directoryThread(volume: HFSVolume, directoryID: number) {
    const headerStart = readCatalog(volume, 0, 64);
    if (!headerStart) return;
    const header = new DataView(
        headerStart.buffer,
        headerStart.byteOffset,
        headerStart.byteLength
    );
    const nodeSize = header.getUint16(32);
    let nodeNumber = header.getUint32(16);
    if (nodeSize < 256 || nodeSize > 32768 || !nodeNumber) return;
    for (let depth = 0; depth < 16; depth++) {
        const node = readCatalog(volume, nodeNumber * nodeSize, nodeSize);
        if (!node) return;
        const offsets = recordOffsets(node);
        if (!offsets) return;
        const kind = new DataView(
            node.buffer,
            node.byteOffset,
            node.byteLength
        ).getInt8(8);
        if (kind === 0) {
            let child: number | undefined;
            for (const offset of offsets) {
                const key = catalogKey(node, offset);
                if (!key) return;
                if (compareThreadKey(key, directoryID) > 0) break;
                if (key.dataOffset + 4 > node.length) return;
                child = new DataView(
                    node.buffer,
                    node.byteOffset,
                    node.byteLength
                ).getUint32(key.dataOffset);
            }
            if (!child) return;
            nodeNumber = child;
            continue;
        }
        if (kind !== -1) return;
        for (const offset of offsets) {
            const key = catalogKey(node, offset);
            if (!key) return;
            const comparison = compareThreadKey(key, directoryID);
            if (comparison > 0) break;
            if (comparison || key.dataOffset + 15 > node.length) continue;
            const view = new DataView(
                node.buffer,
                node.byteOffset,
                node.byteLength
            );
            if (view.getUint16(key.dataOffset) !== 0x0300) return;
            const name = pstring(node, key.dataOffset + 14);
            if (name === undefined) return;
            return {parentID: view.getUint32(key.dataOffset + 10), name};
        }
        return;
    }
}

export class HFSPathResolver {
    #volumes: HFSVolume[] = [];
    #scannedDisks = new WeakSet<ReadableDisk>();
    #directories = new Map<string, string>();

    constructor(private disks: ReadableDisk[]) {}

    resolve(volumeName: string, parentID: number, fileName: string) {
        let volume = this.#volumes.find(
            candidate => candidate.name === volumeName
        );
        if (!volume) {
            for (const disk of this.disks) {
                if (this.#scannedDisks.has(disk)) continue;
                this.#scannedDisks.add(disk);
                const discovered = volumesOnDisk(disk);
                this.#volumes.push(...discovered);
                volume = discovered.find(
                    candidate => candidate.name === volumeName
                );
                if (volume) break;
            }
        }
        if (!volume) return;
        const cacheKey = `${volumeName}:${parentID}`;
        let directory = this.#directories.get(cacheKey);
        if (!directory) {
            const names = [volumeName];
            const visited = new Set<number>();
            let current = parentID;
            while (current !== ROOT_DIRECTORY_ID) {
                if (visited.has(current) || visited.size >= MAX_PATH_COMPONENTS)
                    return;
                visited.add(current);
                const thread = directoryThread(volume, current);
                if (!thread) return;
                names.splice(1, 0, thread.name);
                current = thread.parentID;
            }
            directory = names.join(":");
            this.#directories.set(cacheKey, directory);
        }
        return {directory, path: `${directory}:${fileName}`};
    }
}
