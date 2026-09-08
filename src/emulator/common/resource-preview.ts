export type ResourceBitmap = {
    width: number;
    height: number;
    rgba: Uint8ClampedArray;
    hotspot?: {x: number; y: number};
};

export function hasResourceBitmap(type: string) {
    return /^(ICON|ICN#|ics#|CURS|SICN|PAT |PAT#|ppat|cicn|icl[48]|ics[48])$/.test(
        type
    );
}

// Fixed-size classic monochrome formats. More codecs can be added here without
// involving the emulator or changing the inspector protocol.
export function resourceBitmap(
    type: string,
    data: Uint8Array,
    mask?: Uint8Array
): ResourceBitmap | undefined {
    if (type === "cicn") return colorIcon(data);
    if (type === "ppat") return pixelPattern(data);
    if (type === "PAT#") {
        const count = resourcePatternCount(data);
        if (!count) return undefined;
        // A contact sheet makes lists recognizable even when pattern 1 is white.
        const rgba = new Uint8ClampedArray(32 * 32 * 4).fill(255);
        for (let i = 0; i < Math.min(count, 4); i++) {
            const pattern = resourceBitmap("PAT ", data.subarray(2 + i * 8))!;
            for (let y = 0; y < 14; y++)
                for (let x = 0; x < 14; x++) {
                    const dest =
                        ((Math.floor(i / 2) * 18 + y) * 32 + (i % 2) * 18 + x) *
                        4;
                    const source = ((y % 8) * 8 + (x % 8)) * 4;
                    rgba.set(pattern.rgba.subarray(source, source + 4), dest);
                }
        }
        return {width: 32, height: 32, rgba};
    }
    if (/^(icl|ics)[48]$/.test(type)) {
        const width = type.startsWith("icl") ? 32 : 16;
        const depth = type.endsWith("4") ? 4 : 8;
        const pixels = width * width;
        if (data.length < (pixels * depth) / 8) return undefined;
        const rgba = new Uint8ClampedArray(pixels * 4);
        for (let p = 0; p < pixels; p++) {
            const index =
                depth === 8 ? data[p] : (data[p >> 1] >> (p % 2 ? 0 : 4)) & 15;
            const rgb = depth === 8 ? color256(index) : COLOR_16[index];
            rgba[p * 4] = rgb >> 16;
            rgba[p * 4 + 1] = (rgb >> 8) & 255;
            rgba[p * 4 + 2] = rgb & 255;
            rgba[p * 4 + 3] =
                mask && mask.length >= pixels / 4
                    ? mask[pixels / 8 + (p >> 3)] & (0x80 >> p % 8)
                        ? 255
                        : 0
                    : 255;
        }
        return {width, height: width, rgba};
    }
    let width: number,
        height: number,
        masked = false;
    switch (type) {
        case "ICON":
            width = height = 32;
            break;
        case "ICN#":
            width = height = 32;
            masked = true;
            break;
        case "ics#":
            width = height = 16;
            masked = true;
            break;
        case "CURS":
            width = height = 16;
            masked = true;
            break;
        case "SICN":
            width = height = 16;
            break;
        case "PAT ":
            width = height = 8;
            break;
        default:
            return undefined;
    }
    const bitmapBytes = (width * height) / 8;
    if (data.length < bitmapBytes * (masked ? 2 : 1)) return undefined;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let p = 0; p < width * height; p++) {
        const bit = 0x80 >> p % 8;
        const black = !!(data[p >> 3] & bit);
        const visible = !masked || !!(data[bitmapBytes + (p >> 3)] & bit);
        const index = p * 4;
        rgba[index] = rgba[index + 1] = rgba[index + 2] = black ? 0 : 255;
        rgba[index + 3] = visible ? 255 : 0;
    }
    let hotspot;
    if (type === "CURS" && data.length >= 68) {
        const signed = (n: number) => (n >= 32768 ? n - 65536 : n);
        hotspot = {
            y: signed(data[64] * 256 + data[65]),
            x: signed(data[66] * 256 + data[67]),
        };
    }
    return {width, height, rgba, hotspot};
}

// Inside Macintosh: Imaging With QuickDraw, compiled PAT# and ppat layouts:
// https://dev.os9.ca/techpubs/mac/QuickDraw/QuickDraw-195.html
// https://dev.os9.ca/techpubs/mac/QuickDraw/QuickDraw-266.html
export function resourcePatternCount(data: Uint8Array): number | undefined {
    if (data.length < 2) return undefined;
    const count = data[0] * 256 + data[1];
    return count <= 4096 && 2 + count * 8 <= data.length ? count : undefined;
}

function pixelPattern(data: Uint8Array): ResourceBitmap | undefined {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const u16 = (offset: number) => view.getUint16(offset);
    const u32 = (offset: number) => view.getUint32(offset);
    if (data.length < 28 || u16(0) !== 1) return undefined;
    const map = u32(2),
        pixels = u32(6);
    // These are offsets within a compiled resource, never guest pointers.
    if (map < 28 || map + 50 > data.length || pixels < map + 50)
        return undefined;
    const table = u32(map + 42);
    const rowBytes = u16(map + 4) & 0x3fff;
    const height = view.getInt16(map + 10) - view.getInt16(map + 6);
    const width = view.getInt16(map + 12) - view.getInt16(map + 8);
    const depth = u16(map + 32);
    if (
        width <= 0 ||
        height <= 0 ||
        width > 256 ||
        height > 256 ||
        ![1, 2, 4, 8].includes(depth) ||
        u16(map + 30) !== 0 ||
        u16(map + 34) !== 1 ||
        u16(map + 36) !== depth ||
        u16(map + 16) !== 0 ||
        rowBytes < Math.ceil((width * depth) / 8) ||
        table < pixels + rowBytes * height ||
        table + 8 > data.length
    )
        return undefined;
    const count = u16(table + 6) + 1;
    if (count > 256 || table + 8 + count * 8 > data.length) return undefined;
    const palette = new Map<number, number[]>();
    for (let i = 0; i < count; i++) {
        const entry = table + 8 + i * 8;
        // Device color tables use entry positions; PixMap tables use values.
        const index = u16(table + 4) & 0x8000 ? i : u16(entry);
        palette.set(index, [data[entry + 2], data[entry + 4], data[entry + 6]]);
    }
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
            const bit = x * depth;
            const index =
                (data[pixels + y * rowBytes + (bit >> 3)] >>
                    (8 - depth - (bit % 8))) &
                ((1 << depth) - 1);
            const color = palette.get(index);
            if (!color) return undefined;
            rgba.set([...color, 255], (y * width + x) * 4);
        }
    return {width, height, rgba};
}

// A compiled cicn contains an inline PixMap, mask and monochrome BitMaps,
// followed by their data, a ColorTable, and the indexed pixel data.
// Inside Macintosh: Imaging With QuickDraw, figure 4-18:
// https://developer.apple.com/library/archive/documentation/mac/pdf/Imaging_With_QuickDraw/Imaging_LOF.pdf
function colorIcon(data: Uint8Array): ResourceBitmap | undefined {
    if (data.length < 90) return undefined;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const pixRowBytes = view.getUint16(4) & 0x3fff;
    const top = view.getInt16(6);
    const left = view.getInt16(8);
    const height = view.getInt16(10) - top;
    const width = view.getInt16(12) - left;
    const depth = view.getUint16(32);
    const maskRowBytes = view.getUint16(54) & 0x3fff;
    const maskHeight = view.getInt16(60) - view.getInt16(56);
    const maskWidth = view.getInt16(62) - view.getInt16(58);
    const bitmapRowBytes = view.getUint16(68) & 0x3fff;
    const bitmapHeight = view.getInt16(74) - view.getInt16(70);
    const bitmapWidth = view.getInt16(76) - view.getInt16(72);
    const hasBitmap = bitmapRowBytes !== 0;
    if (
        width <= 0 ||
        height <= 0 ||
        width > 256 ||
        height > 256 ||
        maskWidth !== width ||
        maskHeight !== height ||
        (hasBitmap && bitmapWidth !== width) ||
        (hasBitmap && bitmapHeight !== height) ||
        ![1, 2, 4, 8].includes(depth) ||
        view.getUint16(16) !== 0 ||
        view.getUint16(30) !== 0 ||
        view.getUint16(34) !== 1 ||
        view.getUint16(36) !== depth ||
        pixRowBytes < Math.ceil((width * depth) / 8) ||
        maskRowBytes < Math.ceil(width / 8) ||
        (hasBitmap && bitmapRowBytes < Math.ceil(width / 8))
    )
        return undefined;
    const maskOffset = 82;
    const bitmapOffset = maskOffset + maskRowBytes * height;
    const tableOffset =
        bitmapOffset + (hasBitmap ? bitmapRowBytes * bitmapHeight : 0);
    if (tableOffset + 8 > data.length) return undefined;
    const count = view.getUint16(tableOffset + 6) + 1;
    const pixelsOffset = tableOffset + 8 + count * 8;
    if (
        count > 256 ||
        pixelsOffset + pixRowBytes * height > data.length
    )
        return undefined;
    const palette = new Map<number, number[]>();
    for (let i = 0; i < count; i++) {
        const entry = tableOffset + 8 + i * 8;
        const index =
            view.getUint16(tableOffset + 4) & 0x8000
                ? i
                : view.getUint16(entry);
        palette.set(index, [data[entry + 2], data[entry + 4], data[entry + 6]]);
    }
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
            const pixelBit = x * depth;
            const colorIndex =
                (data[pixelsOffset + y * pixRowBytes + (pixelBit >> 3)] >>
                    (8 - depth - (pixelBit % 8))) &
                ((1 << depth) - 1);
            const color = palette.get(colorIndex);
            if (!color) return undefined;
            const visible =
                data[maskOffset + y * maskRowBytes + (x >> 3)] &
                (0x80 >> x % 8);
            rgba.set([...color, visible ? 255 : 0], (y * width + x) * 4);
        }
    return {width, height, rgba};
}

// Standard Macintosh icon palettes. The 256-color table is a 6³ cube
// (excluding black), then ten intermediate shades each of R, G, B, and gray,
// followed by black. Palette values verified against libicns' colormap data:
// https://github.com/kornelski/libicns/blob/master/src/icns_colormaps.h
const COLOR_16 = [
    0xffffff, 0xfcf305, 0xff6402, 0xdd0806, 0xf20884, 0x4600a5, 0x0000d4,
    0x02abea, 0x1fb714, 0x006411, 0x562c05, 0x90713a, 0xc0c0c0, 0x808080,
    0x404040, 0x000000,
];
function color256(index: number): number {
    if (index < 215) {
        const red = 255 - Math.floor(index / 36) * 51;
        const green = 255 - (Math.floor(index / 6) % 6) * 51;
        const blue = 255 - (index % 6) * 51;
        return red * 65536 + green * 256 + blue;
    }
    if (index === 255) return 0;
    const shades = [238, 221, 187, 170, 136, 119, 85, 68, 34, 17];
    const shade = shades[(index - 215) % 10];
    return shade * [65536, 256, 1, 65793][Math.floor((index - 215) / 10)];
}

const decoder = new TextDecoder("macintosh");
export function resourceStrings(
    type: string,
    data: Uint8Array
): string[] | undefined {
    if (type === "TEXT") return [decoder.decode(data)];
    if (type !== "STR " && type !== "STR#") return undefined;
    let offset = type === "STR#" ? 2 : 0;
    if (data.length < offset) return undefined;
    const count = type === "STR#" ? data[0] * 256 + data[1] : 1;
    if (count > 4096) return undefined;
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
        if (offset >= data.length) return undefined;
        const length = data[offset++];
        if (offset + length > data.length) return undefined;
        result.push(decoder.decode(data.subarray(offset, offset + length)));
        offset += length;
    }
    return result;
}
