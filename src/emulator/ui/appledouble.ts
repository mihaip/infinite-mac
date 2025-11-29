import {fixArchiveFinderInfo} from "@/emulator/common/finder";

const APPLEDOUBLE_MAGIC = 0x00051607;
const APPLEDOUBLE_VERSION = 0x00020000;

const RESOURCE_FORK_ID = 2;
const METADATA_ID = 9;

export function parseAppleDouble(
    buffer: ArrayBuffer,
    name: string
): {
    resourceFork?: Blob;
    metadata?: Blob;
} {
    const data = new DataView(buffer);
    const magic = data.getUint32(0);
    if (magic !== APPLEDOUBLE_MAGIC) {
        throw new Error(`Invalid AppleDouble magic ${magic.toString(16)}`);
    }
    const version = data.getUint32(4);
    if (version !== APPLEDOUBLE_VERSION) {
        throw new Error(`Invalid AppleDouble version ${version.toString(16)}`);
    }

    const entryCount = data.getUint16(24);
    let cursor = 26;
    let resourceFork;
    let metadata;
    for (let i = 0; i < entryCount; i++) {
        const entryID = data.getUint32(cursor);
        const offset = data.getUint32(cursor + 4);
        const length = data.getUint32(cursor + 8);
        switch (entryID) {
            case RESOURCE_FORK_ID:
                resourceFork = new Blob([
                    buffer.slice(offset, offset + length),
                ]);
                break;
            case METADATA_ID: {
                const metadataBuffer = buffer.slice(offset, offset + length);
                fixArchiveFinderInfo(metadataBuffer);
                metadata = new Blob([metadataBuffer]);
                break;
            }
            default:
                console.log(
                    `Ignoring unexpected entry ID ${entryID} found in ${name}`
                );
        }
        cursor += 12;
    }

    return {resourceFork, metadata};
}

export function buildAppleDouble(
    metadata?: Uint8Array,
    resourceFork?: Uint8Array
): Uint8Array | undefined {
    const entries: {id: number; data: Uint8Array}[] = [];
    if (metadata?.length) {
        // Pad Finder Info to 32 bytes if shorter (FInfo/DInfo is 16 bytes).
        let data = metadata;
        if (metadata.byteLength < 32) {
            const padded = new Uint8Array(32);
            padded.set(metadata, 0);
            data = padded;
        }
        entries.push({id: METADATA_ID, data});
    }
    if (resourceFork?.length) {
        entries.push({id: RESOURCE_FORK_ID, data: resourceFork});
    }
    if (!entries.length) {
        return undefined;
    }

    // Header: 4 (magic) + 4 (version) + 16 (filler) + 2 (entryCount)
    const headerSize = 4 + 4 + 16 + 2;
    const tocSize = entries.length * 12; // 12 bytes per entry: id, offset, length
    const dataOffset = headerSize + tocSize;
    const totalSize =
        dataOffset + entries.reduce((s, e) => s + e.data.length, 0);

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const out = new Uint8Array(buffer);

    // Magic and version
    view.setUint32(0, APPLEDOUBLE_MAGIC);
    view.setUint32(4, APPLEDOUBLE_VERSION);
    // 16 bytes of filler (zeros) at 8..23
    // Entry count
    view.setUint16(24, entries.length);

    // Write TOC and payloads
    let tocCursor = 26;
    let payloadCursor = dataOffset;
    for (const {id, data} of entries) {
        view.setUint32(tocCursor + 0, id);
        view.setUint32(tocCursor + 4, payloadCursor);
        view.setUint32(tocCursor + 8, data.length);
        out.set(data, payloadCursor);
        tocCursor += 12;
        payloadCursor += data.length;
    }

    return new Uint8Array(buffer);
}
