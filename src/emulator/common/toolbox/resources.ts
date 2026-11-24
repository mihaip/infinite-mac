import {type MacMemoryReader} from "@/emulator/common/toolbox/memory";
import {LowMem} from "@/emulator/common/toolbox/lowmem";
import {fourCCToString} from "@/emulator/common/toolbox/fourcc";
import {
    readOpenFileInfo,
    type OpenFileInfo,
} from "@/emulator/common/toolbox/files";

/**
 * Read the ReferenceEntry fields used for source metadata.
 * @see {@link https://developer.apple.com/library/archive/documentation/mac/pdf/MoreMacintoshToolbox.pdf#page=154 | Figure 1-16 (page 1-124)}
 */
function readResourceReferenceEntry(
    memory: MacMemoryReader,
    referenceEntryAddress: number
): ResourceReferenceEntry {
    const address = memory.normalize(referenceEntryAddress);
    if (!address) {
        throw new Error("Invalid resource reference entry address");
    }
    const entry = memory.subarray(
        address,
        address + RESOURCE_REFERENCE_ENTRY_SIZE
    );
    return {
        address,
        id: entry.i16(ReferenceEntryFields.rID),
        nameOffset: entry.u16(ReferenceEntryFields.rNameOffset),
    };
}

/**
 * Walk map headers to find this reference's owner and validate its type entry,
 * without reading other resources' payloads.
 */
export function readResourceMetadata(
    memory: MacMemoryReader,
    referenceEntryAddress: number,
    type: string
): ResourceMetadata | undefined {
    const referenceEntry = readResourceReferenceEntry(
        memory,
        referenceEntryAddress
    );
    let map = memory.pointer(LowMem.TopMapHndl);
    const visited = new Set<number>();
    while (map) {
        if (visited.has(map) || visited.size >= RESOURCE_MAP_CHAIN_LIMIT) {
            throw new Error("Invalid resource map chain");
        }
        visited.add(map);
        const block = memory.handle(map);
        if (
            !block ||
            block.size < RESOURCE_MAP_HEADER_SIZE + RESOURCE_TYPE_COUNT_SIZE
        ) {
            throw new Error("Invalid resource map");
        }
        const base = block.address;
        const mapMemory = memory.subarray(base, base + block.size);
        const mapHeader = readResourceMapHeader(mapMemory, 0);
        if (
            referenceEntry.address < base ||
            referenceEntry.address + RESOURCE_REFERENCE_ENTRY_SIZE >
                base + block.size
        ) {
            map = mapHeader.nextMapHandle;
            continue;
        }
        const typeBase = mapHeader.typeListOffset;
        const count = (mapMemory.u16(typeBase) + 1) & RESOURCE_COUNT_MASK;
        const typeEntries = mapMemory.subarray(
            typeBase + RESOURCE_TYPE_COUNT_SIZE,
            typeBase +
                RESOURCE_TYPE_COUNT_SIZE +
                count * RESOURCE_TYPE_ENTRY_SIZE
        );
        for (let index = 0; index < count; index++) {
            const typeEntry = readResourceTypeEntry(
                typeEntries,
                index * RESOURCE_TYPE_ENTRY_SIZE
            );
            if (typeEntry.type !== type) {
                continue;
            }
            const referenceListOffset =
                typeBase + typeEntry.referenceListOffset;
            const referenceListSize =
                typeEntry.resourceCount * RESOURCE_REFERENCE_ENTRY_SIZE;
            const referenceOffset =
                referenceEntry.address - base - referenceListOffset;
            if (
                referenceOffset % RESOURCE_REFERENCE_ENTRY_SIZE !== 0 ||
                referenceOffset < 0 ||
                referenceOffset + RESOURCE_REFERENCE_ENTRY_SIZE >
                    referenceListSize
            ) {
                return undefined;
            }
            // File metadata can fail independently of the resource name.
            const file = readOpenFileInfo(memory, mapHeader.fileRefNum) ?? {
                refNum: mapHeader.fileRefNum,
            };
            let name: string | undefined;
            try {
                if (referenceEntry.nameOffset !== NO_RESOURCE_NAME) {
                    const offset =
                        mapHeader.nameListOffset + referenceEntry.nameOffset;
                    name = mapMemory.pstring(offset) || undefined;
                }
            } catch (error) {
                // Preserve file attribution even if the resource name is corrupt.
                console.warn(
                    "Could not read resource name",
                    {
                        type,
                        id: referenceEntry.id,
                        referenceEntryAddress: referenceEntry.address,
                    },
                    error
                );
            }
            return {file, name};
        }
        return undefined;
    }
    return undefined;
}

type ResourceReferenceEntry = {
    address: number;
    id: number;
    nameOffset: number;
};

export type ResourceMetadata = {
    file?: OpenFileInfo;
    name?: string;
};

const RESOURCE_MAP_CHAIN_LIMIT = 1024;
const RESOURCE_REFERENCE_ENTRY_SIZE = 12;
const RESOURCE_MAP_HEADER_SIZE = 28;
const RESOURCE_TYPE_ENTRY_SIZE = 8;
const RESOURCE_TYPE_COUNT_SIZE = 2;
const RESOURCE_COUNT_MASK = 0xffff;
const NO_RESOURCE_NAME = 0xffff;

// Field names from Apple's ResourceMgrPriv.h.
enum ReferenceEntryFields {
    rID = 0,
    rNameOffset = 2,
}

enum ResourceMapHeaderFields {
    mNext = 16,
    mRefNum = 20,
    mTypes = 24,
    mNames = 26,
}

enum TypeEntryFields {
    tType = 0,
    tCount = 4,
    tOffset = 6,
}

type ResourceMapHeader = {
    nextMapHandle: number;
    fileRefNum: number;
    typeListOffset: number;
    nameListOffset: number;
};

/**
 * Read the fields used by capture from Apple's ResourceMapHeader.
 * @see {@link https://developer.apple.com/library/archive/documentation/mac/pdf/MoreMacintoshToolbox.pdf#page=153 | Figure 1-14 (page 1-123)}
 */
function readResourceMapHeader(
    memory: MacMemoryReader,
    address: number
): ResourceMapHeader {
    const header = memory.subarray(address, address + RESOURCE_MAP_HEADER_SIZE);
    return {
        nextMapHandle: header.pointer(ResourceMapHeaderFields.mNext),
        fileRefNum: header.i16(ResourceMapHeaderFields.mRefNum),
        typeListOffset: header.u16(ResourceMapHeaderFields.mTypes),
        nameListOffset: header.u16(ResourceMapHeaderFields.mNames),
    };
}

type ResourceTypeEntry = {
    type: string;
    resourceCount: number;
    referenceListOffset: number;
};

/**
 * Read Apple's TypeEntry, converting its count-minus-one to a resource count.
 * @see {@link https://developer.apple.com/library/archive/documentation/mac/pdf/MoreMacintoshToolbox.pdf#page=153 | Figure 1-15 (page 1-123)}
 */
function readResourceTypeEntry(
    memory: MacMemoryReader,
    address: number
): ResourceTypeEntry {
    const entry = memory.subarray(address, address + RESOURCE_TYPE_ENTRY_SIZE);
    return {
        type: fourCCToString(entry.u32(TypeEntryFields.tType)),
        resourceCount:
            (entry.u16(TypeEntryFields.tCount) + 1) & RESOURCE_COUNT_MASK,
        referenceListOffset: entry.u16(TypeEntryFields.tOffset),
    };
}
