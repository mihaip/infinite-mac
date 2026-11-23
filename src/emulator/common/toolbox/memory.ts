import {LowMem} from "@/emulator/common/toolbox/lowmem";

/**
 * A borrowed view for one synchronous observation. Copy any bytes retained
 * before returning control to the guest. All numeric fields are big-endian.
 */
export class MacMemoryReader {
    readonly pointerBits: 24 | 32;
    #view: DataView;

    constructor(
        private readonly ram: Uint8Array,
        pointerBits?: 24 | 32
    ) {
        this.#view = new DataView(ram.buffer, ram.byteOffset, ram.byteLength);
        this.pointerBits = pointerBits ?? readPointerBits(this);
    }

    get byteLength(): number {
        return this.ram.byteLength;
    }

    bytes(address: number, length: number): Uint8Array {
        this.#checkRange(address, length);
        return this.ram.subarray(address, address + length);
    }

    /**
     * Offsets in the child reader are relative to start. Pointer values remain
     * guest addresses and should be dereferenced through the full-RAM reader.
     */
    subarray(start: number, end = this.ram.byteLength): MacMemoryReader {
        return new MacMemoryReader(
            this.bytes(start, end - start),
            this.pointerBits
        );
    }

    u8(address: number): number {
        this.#checkRange(address, 1);
        return this.#view.getUint8(address);
    }

    u16(address: number): number {
        this.#checkRange(address, 2);
        return this.#view.getUint16(address, false);
    }

    i16(address: number): number {
        this.#checkRange(address, 2);
        return this.#view.getInt16(address, false);
    }

    u32(address: number): number {
        this.#checkRange(address, 4);
        return this.#view.getUint32(address, false);
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
        const length = this.u8(address);
        if (length > maxLength) {
            throw new Error("Invalid Pascal string");
        }
        return macRoman.decode(this.bytes(address + 1, length));
    }

    handle(handle: number): {address: number; size: number} | undefined {
        handle = this.normalize(handle);
        if (!handle || handle % HANDLE_ALIGNMENT) {
            throw new Error("Invalid resource handle");
        }
        const address = this.pointer(handle);
        if (!address) {
            return undefined;
        }
        const header = readHeapBlockHeader(this, address);
        if (header.blockType !== tybkRel) {
            throw new Error("Handle does not reference a relocatable block");
        }
        const size =
            header.physicalSize - header.byteLength - header.sizeCorrection;
        if (size < 0) {
            throw new Error("Invalid resource block size");
        }
        this.#checkRange(header.address, header.physicalSize);
        return {address, size};
    }

    #checkRange(address: number, length: number): void {
        if (
            !Number.isSafeInteger(address) ||
            !Number.isSafeInteger(length) ||
            address < 0 ||
            length < 0 ||
            address + length > this.ram.byteLength
        ) {
            throw new Error("Invalid Mac memory range");
        }
    }
}

const macRoman = new TextDecoder("macintosh");

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
const HANDLE_ALIGNMENT = 2;
const PASCAL_STRING_MAX_LENGTH = 255;

type HeapBlockHeader = {
    address: number;
    byteLength: number;
    blockType: number;
    physicalSize: number;
    sizeCorrection: number;
};

/**
 * Normalize the 24- and 32-bit Memory Manager header layouts so we can validate
 * a relocatable block and determine its logical payload size.
 */
function readHeapBlockHeader(
    memory: MacMemoryReader,
    dataAddress: number
): HeapBlockHeader {
    const byteLength =
        memory.pointerBits === 24
            ? HeapBlockFields.blkData24
            : HeapBlockFields.blkData32;
    const address = dataAddress - byteLength;
    const header = memory.subarray(address, address + byteLength);
    const tag = header.u8(HeapBlockFields.tagBC);
    return {
        address,
        byteLength,
        blockType: (tag >>> HEAP_BLOCK_TYPE_SHIFT) & tybkMask,
        physicalSize:
            memory.pointerBits === 24
                ? header.u32(HeapBlockFields.tagBC) &
                  HEAP_BLOCK_SIZE_MASK_24_BIT
                : header.u32(HeapBlockFields.blkSize32),
        sizeCorrection:
            memory.pointerBits === 24
                ? tag & HEAP_BLOCK_SIZE_CORRECTION_MASK_24_BIT
                : header.u8(HeapBlockFields.SizeCor32),
    };
}

// Field names from SysEqu.a and InternalOnlyEqu.a. blkData is also the header size.
enum HeapBlockFields {
    tagBC = 0,
    SizeCor32 = 3,
    blkSize32 = 4,
    blkData24 = 8,
    blkData32 = 12,
}

// Block types from Apple's SysEqu.a; the value occupies the top two tag bits.
const tybkMask = 3;
const tybkRel = 2;
const HEAP_BLOCK_TYPE_SHIFT = 6;
const HEAP_BLOCK_SIZE_MASK_24_BIT = 0xffffff;
const HEAP_BLOCK_SIZE_CORRECTION_MASK_24_BIT = 0x0f;
