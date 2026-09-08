// Inspectors consume guest addresses through this interface. Each core is
// responsible for translating them and supplying a coherent, immutable view
// for the duration of capture; inspectors never retain Wasm heap views.
export interface GuestMemory {
    read(address: number, length: number): Uint8Array;
}

export class GuestMemoryReader {
    constructor(
        readonly memory: GuestMemory,
        readonly pointerBits: 24 | 32
    ) {}
    bytes(address: number, length: number) {
        if (
            !Number.isSafeInteger(address) ||
            !Number.isSafeInteger(length) ||
            address < 0 ||
            length < 0 ||
            address + length > 0x100000000
        ) {
            throw new Error("Invalid guest memory range");
        }
        return this.memory.read(address, length);
    }
    u8(address: number) {
        return this.bytes(address, 1)[0];
    }
    u16(address: number) {
        const b = this.bytes(address, 2);
        return b[0] * 256 + b[1];
    }
    i16(address: number) {
        const n = this.u16(address);
        return n >= 0x8000 ? n - 0x10000 : n;
    }
    u32(address: number) {
        const b = this.bytes(address, 4);
        return b[0] * 0x1000000 + b[1] * 0x10000 + b[2] * 256 + b[3];
    }
    normalize(pointer: number) {
        return this.pointerBits === 24 ? pointer & 0xffffff : pointer;
    }
    pointer(address: number) {
        return this.normalize(this.u32(address));
    }
    pstring(address: number, maxLength = 255) {
        const length = this.u8(address);
        if (length > maxLength) throw new Error("Invalid Pascal string");
        return macRoman.decode(this.bytes(address + 1, length));
    }
    handle(handle: number) {
        handle = this.normalize(handle);
        if (!handle || handle % 2) throw new Error("Invalid resource handle");
        const address = this.pointer(handle);
        if (!address) return undefined;
        const headerLength = this.pointerBits === 24 ? 8 : 12;
        const header = address - headerLength;
        const tag = this.u8(header);
        if ((tag & 0xc0) !== 0x80)
            throw new Error("Resource does not reference a relocatable block");
        const physicalSize =
            this.pointerBits === 24
                ? this.u32(header) & 0xffffff
                : this.u32(header + 4);
        const correction =
            this.pointerBits === 24 ? tag & 15 : this.u8(header + 3);
        const size = physicalSize - headerLength - correction;
        if (size < 0 || physicalSize > 16 * 1024 * 1024)
            throw new Error("Invalid resource block size");
        this.bytes(header, physicalSize);
        return {address, size};
    }
}

export const macRoman = new TextDecoder("macintosh");

export function ramMemory(ram: Uint8Array): GuestMemory {
    return {
        read(address, length) {
            if (address < 0 || length < 0 || address + length > ram.length) {
                throw new Error(
                    `Guest address $${address.toString(16)} is outside captured RAM`
                );
            }
            return ram.subarray(address, address + length);
        },
    };
}
