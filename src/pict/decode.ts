import {type PictModule} from "./generated/pict";

export type PictBitmap = {
    width: number;
    height: number;
    rgba: Uint8ClampedArray;
};

// Synchronous Wasm boundary with explicit allocation cleanup.
export function decodePict(module: PictModule, bytes: Uint8Array): PictBitmap {
    let input = 0;
    let result = 0;
    let pixels = 0;
    let length = 0;
    try {
        input = module._pict_allocate(bytes.length);
        result = module._pict_allocate(16);
        module.HEAPU8.set(bytes, input);
        const status = module._pict_decode(input, bytes.length, result);
        if (status !== 0) {
            throw new Error(
                status === 2
                    ? "Embedded QuickTime pictures are not supported yet."
                    : status === 3
                      ? "This picture is too large to preview."
                      : "This PICT could not be decoded."
            );
        }
        // Allocation can grow memory, so fetch fresh heap views after decoding.
        const fields = module.HEAPU32.subarray(result / 4, result / 4 + 4);
        [pixels, length] = fields;
        return {
            width: fields[2],
            height: fields[3],
            rgba: new Uint8ClampedArray(
                module.HEAPU8.slice(pixels, pixels + length)
            ),
        };
    } finally {
        if (pixels) module._pict_free(pixels, length);
        if (result) module._pict_free(result, 16);
        if (input) module._pict_free(input, bytes.length);
    }
}
