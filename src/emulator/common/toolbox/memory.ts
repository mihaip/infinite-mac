import {LowMem} from "@/emulator/common/toolbox/lowmem";
import {pstring} from "@/emulator/common/toolbox/strings";

/**
 * Borrowed RAM/ROM regions for one synchronous observation. Each read must fit
 * within one region. Copy any bytes retained before returning control to the
 * guest. All numeric fields are big-endian.
 */
export class MacMemoryReader {
    readonly pointerBits: 24 | 32;
    #regions: readonly MacMemoryRegionView[];

    private constructor(
        regions: readonly MacMemoryRegionView[],
        pointerBits?: 24 | 32
    ) {
        this.#regions = regions;
        this.pointerBits = pointerBits ?? readPointerBits(this);
    }

    /** Create region views; adapters supply ordered, non-overlapping regions. */
    static fromRegions(regions: readonly MacMemoryRegion[]): MacMemoryReader {
        return new MacMemoryReader(regions.map(createRegionView));
    }

    bytes(address: number, length: number): Uint8Array {
        const region = this.#region(address, length);
        const offset = address - region.baseAddress;
        return region.data.subarray(offset, offset + length);
    }

    /**
     * Offsets in the child reader are relative to start. Pointer values remain
     * guest addresses and should be dereferenced through the full-memory reader.
     */
    subarray(start: number, end: number): MacMemoryReader {
        const region = this.#region(start, end - start);
        return new MacMemoryReader(
            [
                createRegionView({
                    baseAddress: 0,
                    data: region.data.subarray(
                        start - region.baseAddress,
                        end - region.baseAddress
                    ),
                    kind: region.kind,
                }),
            ],
            this.pointerBits
        );
    }

    u8(address: number): number {
        const region = this.#region(address, 1);
        return region.view.getUint8(address - region.baseAddress);
    }

    u16(address: number): number {
        const region = this.#region(address, 2);
        return region.view.getUint16(address - region.baseAddress, false);
    }

    i16(address: number): number {
        const region = this.#region(address, 2);
        return region.view.getInt16(address - region.baseAddress, false);
    }

    u32(address: number): number {
        const region = this.#region(address, 4);
        return region.view.getUint32(address - region.baseAddress, false);
    }

    /**
     * Strip pointer flags in 24-bit mode, or interpret the full address as
     * unsigned in 32-bit mode (in case we get a value via EM_ASM, which does
     * a signed conversion).
     */
    normalize(pointer: number): number {
        return this.pointerBits === 24
            ? pointer & ADDRESS_MASK_24_BIT
            : pointer >>> 0;
    }

    pointer(address: number): number {
        return this.normalize(this.u32(address));
    }

    pstring(address: number, maxLength = PASCAL_STRING_MAX_LENGTH): string {
        const length = Math.min(this.u8(address), maxLength);
        return pstring(this.bytes(address, length + 1), 0, maxLength);
    }

    handle(
        handle: number
    ): {address: number; size: number; isRom: boolean} | undefined {
        handle = this.normalize(handle);
        if (!handle) {
            return undefined;
        }
        const address = this.pointer(handle);
        if (!address) {
            return undefined;
        }
        const region = this.#region(address, 1);
        const isRom = region.kind === "rom";
        const header = isRom
            ? readRomHeapBlockHeader(this, address, region)
            : readHeapBlockHeader(this, address, this.pointerBits);
        const size =
            header.physicalSize - header.byteLength - header.sizeCorrection;
        if (size < 0) {
            throw new Error("Invalid resource block size");
        }
        const headerOffset = header.address - region.baseAddress;
        if (
            headerOffset < 0 ||
            headerOffset + header.physicalSize > region.data.byteLength
        ) {
            throw new Error("Resource block crosses memory regions");
        }
        return {address, size, isRom};
    }

    #region(address: number, length: number): MacMemoryRegionView {
        if (
            !Number.isSafeInteger(address) ||
            !Number.isSafeInteger(length) ||
            address < 0 ||
            length < 0
        ) {
            throw new Error(
                `Invalid Mac memory range: address=${address}, length=${length}`
            );
        }
        for (const region of this.#regions) {
            const offset = address - region.baseAddress;
            if (offset >= 0 && offset + length <= region.data.byteLength) {
                return region;
            }
        }
        throw new Error(
            `Invalid Mac memory range: address=${address}, length=${length}`
        );
    }
}

export type MacMemoryRegion = {
    baseAddress: number;
    data: Uint8Array;
    kind: "ram" | "rom";
};

type MacMemoryRegionView = MacMemoryRegion & {view: DataView};

function createRegionView(region: MacMemoryRegion): MacMemoryRegionView {
    return {
        ...region,
        view: new DataView(
            region.data.buffer,
            region.data.byteOffset,
            region.data.byteLength
        ),
    };
}

function readPointerBits(memory: MacMemoryReader): 24 | 32 {
    const mask = memory.u32(LowMem.Lo3Bytes);
    if (mask !== ADDRESS_MASK_24_BIT && mask !== ADDRESS_MASK_32_BIT) {
        throw new Error("Memory Manager is not initialized");
    }
    // MMU32Bit is already set during ROM startup, before SysVersion is
    // initialized. Lo3Bytes can remain a 24-bit mask on 32-bit systems.
    return mask === ADDRESS_MASK_32_BIT || memory.u8(LowMem.MMU32Bit) === 1
        ? 32
        : 24;
}

const ADDRESS_MASK_24_BIT = 0xffffff;
const ADDRESS_MASK_32_BIT = 0xffffffff;
const PASCAL_STRING_MAX_LENGTH = 255;

type HeapBlockHeader = {
    address: number;
    byteLength: number;
    physicalSize: number;
    sizeCorrection: number;
};

/**
 * Read block sizing fields from the 24- or 32-bit Memory Manager header.
 */
function readHeapBlockHeader(
    memory: MacMemoryReader,
    dataAddress: number,
    pointerBits: 24 | 32
): HeapBlockHeader {
    const byteLength =
        pointerBits === 24
            ? HeapBlockFields.blkData24
            : HeapBlockFields.blkData32;
    const address = dataAddress - byteLength;
    const header = memory.subarray(address, address + byteLength);
    return {
        address,
        byteLength,
        physicalSize:
            pointerBits === 24
                ? header.u32(HeapBlockFields.tagBC) &
                  HEAP_BLOCK_SIZE_MASK_24_BIT
                : header.u32(HeapBlockFields.blkSize32),
        sizeCorrection:
            pointerBits === 24
                ? header.u8(HeapBlockFields.tagBC) &
                  HEAP_BLOCK_SIZE_CORRECTION_MASK_24_BIT
                : header.u8(HeapBlockFields.SizeCor32),
    };
}

/** ROM block headers describe their layout independently of the active RAM heap. */
function readRomHeapBlockHeader(
    memory: MacMemoryReader,
    dataAddress: number,
    region: MacMemoryRegionView
): HeapBlockHeader {
    const headerAddress = dataAddress - HeapBlockFields.blkData32;
    const headerOffset = headerAddress - region.baseAddress;
    // ROM blocks set both type bits; their state byte can change after boot.
    // MMFlags is unreliable: Figment initializes it to 5, clearing the ROM
    // layout bit. Check the size too, so bytes before a 24-bit header cannot
    // be mistaken for a 32-bit header.
    const is32Bit =
        headerOffset >= 0 &&
        memory.u8(headerAddress) >>> HEAP_BLOCK_TYPE_SHIFT === ROM_BLOCK_TYPE &&
        memory.u32(headerAddress + HeapBlockFields.blkSize32) <=
            region.data.byteLength - headerOffset;
    return readHeapBlockHeader(memory, dataAddress, is32Bit ? 32 : 24);
}

// Field names from SysEqu.a and InternalOnlyEqu.a. blkData is also the header size.
enum HeapBlockFields {
    tagBC = 0,
    SizeCor32 = 3,
    blkSize32 = 4,
    blkData24 = 8,
    blkData32 = 12,
}

// ROM builder (Hiram) marks blocks as both relocatable and non-relocatable.
const ROM_BLOCK_TYPE = 3;
const HEAP_BLOCK_TYPE_SHIFT = 6;
const HEAP_BLOCK_SIZE_MASK_24_BIT = 0xffffff;
const HEAP_BLOCK_SIZE_CORRECTION_MASK_24_BIT = 0x0f;
