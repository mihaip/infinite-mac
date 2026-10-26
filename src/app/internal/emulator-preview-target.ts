export type TargetRect = {x: number; y: number; width: number; height: number};
export type ScreenFrame = {
    data: Uint8ClampedArray<ArrayBuffer>;
    width: number;
    height: number;
};
export type TargetImage = {
    x: number;
    y: number;
    screenWidth: number;
    screenHeight: number;
    image: ImageData;
};

type TargetMetadata = Omit<TargetImage, "image">;
const METADATA_KEY = "InfiniteMacTarget";

export function targetImageName(id: string): string {
    return `${id
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}.png`;
}

export function targetMatches(
    frame: ScreenFrame,
    target: TargetImage
): boolean {
    const {x, y, screenWidth, screenHeight, image} = target;
    if (
        frame.width !== screenWidth ||
        frame.height !== screenHeight ||
        x < 0 ||
        y < 0 ||
        x + image.width > frame.width ||
        y + image.height > frame.height
    ) {
        return false;
    }
    for (let row = 0; row < image.height; row++) {
        let actual = ((y + row) * frame.width + x) * 4;
        let expected = row * image.width * 4;
        for (
            let col = 0;
            col < image.width;
            col++, actual += 4, expected += 4
        ) {
            // Alpha is not part of the guest framebuffer's visible contents.
            if (
                frame.data[actual] !== image.data[expected] ||
                frame.data[actual + 1] !== image.data[expected + 1] ||
                frame.data[actual + 2] !== image.data[expected + 2]
            ) {
                return false;
            }
        }
    }
    return true;
}

export function readTargetMetadata(bytes: Uint8Array): TargetMetadata {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let offset = 8; offset + 12 <= bytes.length;) {
        const length = view.getUint32(offset);
        if (offset + 12 + length > bytes.length) break;
        const type = new TextDecoder().decode(
            bytes.subarray(offset + 4, offset + 8)
        );
        if (type === "tEXt") {
            const text = new TextDecoder().decode(
                bytes.subarray(offset + 8, offset + 8 + length)
            );
            if (text.startsWith(`${METADATA_KEY}\0`)) {
                const metadata = JSON.parse(
                    text.slice(METADATA_KEY.length + 1)
                );
                const {x, y, screenWidth, screenHeight} = metadata;
                if (
                    [x, y, screenWidth, screenHeight].every(
                        Number.isSafeInteger
                    ) &&
                    x >= 0 &&
                    y >= 0 &&
                    screenWidth > x &&
                    screenHeight > y
                ) {
                    return {x, y, screenWidth, screenHeight};
                }
                break;
            }
        }
        offset += length + 12;
    }
    throw new Error(
        "Target PNG has no valid screen coordinates. Save it using Save Target Image…"
    );
}

export async function loadTargetImage(url: string): Promise<TargetImage> {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`Could not load target (${response.status})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const metadata = readTargetMetadata(bytes);
    const bitmap = await createImageBitmap(
        new Blob([bytes], {type: "image/png"})
    );
    try {
        if (
            metadata.x + bitmap.width > metadata.screenWidth ||
            metadata.y + bitmap.height > metadata.screenHeight
        ) {
            throw new Error("Target rectangle extends beyond the screen");
        }
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        return {
            ...metadata,
            image: context.getImageData(0, 0, bitmap.width, bitmap.height),
        };
    } finally {
        bitmap.close();
    }
}

export async function createTargetImage(
    frame: ScreenFrame,
    rect: TargetRect
): Promise<Blob> {
    const canvas = document.createElement("canvas");
    canvas.width = rect.width;
    canvas.height = rect.height;
    const context = canvas.getContext("2d")!;
    context.putImageData(
        new ImageData(frame.data, frame.width, frame.height),
        -rect.x,
        -rect.y
    );
    const png = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            blob =>
                blob
                    ? resolve(blob)
                    : reject(new Error("Could not encode target image")),
            "image/png"
        );
    });
    const metadata: TargetMetadata = {
        x: rect.x,
        y: rect.y,
        screenWidth: frame.width,
        screenHeight: frame.height,
    };
    return addTargetMetadata(new Uint8Array(await png.arrayBuffer()), metadata);
}

export function addTargetMetadata(
    png: Uint8Array<ArrayBuffer>,
    metadata: TargetMetadata
): Blob {
    const data = new TextEncoder().encode(
        `${METADATA_KEY}\0${JSON.stringify(metadata)}`
    );
    const chunk = new Uint8Array(data.length + 12);
    new DataView(chunk.buffer).setUint32(0, data.length);
    chunk.set(new TextEncoder().encode("tEXt"), 4);
    chunk.set(data, 8);
    let crc = 0xffffffff;
    for (const byte of chunk.subarray(4, -4)) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++)
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    new DataView(chunk.buffer).setUint32(
        chunk.length - 4,
        (crc ^ 0xffffffff) >>> 0
    );
    // Native canvas PNGs end with the 12-byte IEND chunk.
    return new Blob([png.subarray(0, -12), chunk, png.subarray(-12)], {
        type: "image/png",
    });
}
