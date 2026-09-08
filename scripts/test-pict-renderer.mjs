// Checks the committed Emscripten assets directly; no browser/UI harness.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";
import createRenderer from "../src/pict/generated/pict.js";

const module = await createRenderer({
    wasmBinary: await readFile(
        new URL("../src/pict/generated/pict.wasm", import.meta.url)
    ),
});

function picture(deviceTable) {
    const bytes = [];
    const u16 = n => bytes.push((n >>> 8) & 255, n & 255);
    const u32 = n => {
        u16(n >>> 16);
        u16(n);
    };
    const rect = () => [0, 0, 1, 2].forEach(u16);
    u16(0);
    rect();
    u16(0x11);
    u16(0x2ff);
    u16(0x0c00);
    [0xffffffff, 0, 0, 2 << 16, 1 << 16, 0].forEach(u32);
    u16(0x98); // PackBitsRect with a 2-pixel indexed PixMap.
    u16(0x8002);
    rect();
    u16(0);
    u16(0);
    u32(0);
    u32(72 << 16);
    u32(72 << 16);
    u16(0);
    u16(8);
    u16(1);
    u16(8);
    u32(0);
    u32(0);
    u32(0);
    u32(0);
    u16(deviceTable ? 0x8000 : 0);
    u16(1);
    // Device entries deliberately have the same value, as in Aaron Docs.
    // Explicit entries are reversed to verify value-based palette indexing.
    if (deviceTable) {
        [0, 65535, 65535, 65535, 0, 0, 0, 65535].forEach(u16);
    } else {
        [1, 0, 0, 65535, 0, 65535, 65535, 65535].forEach(u16);
    }
    rect();
    rect();
    u16(0);
    bytes.push(0, 1);
    u16(0xff);
    return Uint8Array.from(bytes);
}

function decode(bytes) {
    const input = module._pict_allocate(bytes.length);
    const out = module._pict_allocate(16);
    let pixels = 0,
        length = 0;
    try {
        module.HEAPU8.set(bytes, input);
        const status = module._pict_decode(input, bytes.length, out);
        if (status) return {status};
        const [pointer, size, width, height] = module.HEAPU32.slice(
            out / 4,
            out / 4 + 4
        );
        pixels = pointer;
        length = size;
        return {
            status,
            width,
            height,
            rgba: [...module.HEAPU8.slice(pixels, pixels + length)],
        };
    } finally {
        if (pixels) module._pict_free(pixels, length);
        module._pict_free(input, bytes.length);
        module._pict_free(out, 16);
    }
}

test("device and explicitly indexed palettes render identically", () => {
    const expected = {
        status: 0,
        width: 2,
        height: 1,
        rgba: [255, 255, 255, 255, 0, 0, 255, 255],
    };
    assert.deepEqual(decode(picture(true)), expected);
    assert.deepEqual(decode(picture(false)), expected);
});
test("invalid and truncated input fail without breaking subsequent previews", () => {
    assert.notEqual(decode(new Uint8Array([0, 1, 2])).status, 0);
    assert.notEqual(decode(picture(true).slice(0, 60)).status, 0);
    for (let i = 0; i < 100; i++) assert.equal(decode(picture(true)).status, 0);
});
