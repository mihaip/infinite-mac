// Run with:
// node_modules/.bin/esbuild scripts/tests/cdrom-data.test.ts --bundle --platform=node --format=esm --outfile=/tmp/cdrom-data.test.mjs
// node --test /tmp/cdrom-data.test.mjs
import assert from "node:assert/strict";
import {test} from "node:test";
import {
    createEmulatorWorkerCDROMDisk,
    EmulatorWorkerCDROMDataDisk,
    EmulatorWorkerMode1SectorDisk,
} from "../../src/emulator/worker/cdrom-disk";

class MemoryDisk {
    name = "Test CD";
    reads: [number, number][] = [];
    constructor(public bytes: Uint8Array) {}
    get size() {
        return this.bytes.length;
    }
    read(buffer: Uint8Array, offset: number, length: number) {
        this.reads.push([offset, length]);
        buffer.set(this.bytes.subarray(offset, offset + length));
        return length;
    }
    write(buffer: Uint8Array, offset: number, length: number) {
        this.bytes.set(buffer.subarray(0, length), offset);
        return length;
    }
}

test("decoded byte offsets can start between CD sectors, and stop at the selected volume end", () => {
    const source = new MemoryDisk(
        Uint8Array.from({length: 8192}, (_, i) => i % 251)
    );
    const view = new EmulatorWorkerCDROMDataDisk(source, 512, 2048);
    const output = new Uint8Array(16).fill(255);
    assert.equal(view.name, source.name);
    assert.equal(view.size, 2048);
    assert.equal(view.read(output, 2044, output.length), 4);
    assert.deepEqual(output.subarray(0, 4), source.bytes.subarray(2556, 2560));
    assert.deepEqual(output.subarray(4), new Uint8Array(12).fill(255));
    assert.deepEqual(source.reads, [[2556, 4]]);
    assert.equal(view.read(output, 2048, 16), 0);
    assert.equal(view.read(output, 2050, 16), 0);
    assert.equal(source.reads.length, 1);
});

test("a selected raw-CD volume reads across payload boundaries without exposing sector headers", () => {
    const cooked = Uint8Array.from({length: 3 * 2048}, (_, i) => i % 251);
    const raw = new Uint8Array(3 * 2352).fill(255);
    for (let sector = 0; sector < 3; sector++) {
        raw.set(
            cooked.subarray(sector * 2048, (sector + 1) * 2048),
            sector * 2352 + 16
        );
    }
    const source = new MemoryDisk(raw);
    const view = new EmulatorWorkerCDROMDataDisk(
        new EmulatorWorkerMode1SectorDisk(source),
        2045,
        20
    );
    const output = new Uint8Array(20);
    assert.equal(view.read(output, 0, 20), 20);
    assert.deepEqual(output, cooked.subarray(2045, 2065));

    const before = raw.slice();
    assert.equal(view.write(new Uint8Array([4, 5, 6]), 4, 3), 3);
    assert.deepEqual(raw.subarray(2369, 2372), new Uint8Array([4, 5, 6]));
    assert.deepEqual(raw.subarray(0, 2369), before.subarray(0, 2369));
    assert.deepEqual(raw.subarray(2372), before.subarray(2372));
});

test("the CD factory applies selection after decoding, and preserves existing whole-CD behavior", () => {
    const delegate = {
        willLoadChunk() {},
        didLoadChunk() {},
        didFailToLoadChunk() {},
    };
    const cd = {
        name: "Test CD",
        srcUrl: "r2://media/test.media",
        fileSize: 3 * 2352,
        mode: "MODE1/2352" as const,
    };
    const whole = createEmulatorWorkerCDROMDisk(cd, delegate);
    assert.equal(whole.size, 3 * 2048);
    assert.equal(whole.isCdrom, true);
    const selected = createEmulatorWorkerCDROMDisk(
        {...cd, dataOffset: 512, dataSize: 2048},
        delegate
    );
    assert.equal(selected.size, 2048);
    assert.equal(selected.isCdrom, true);
    const remaining = createEmulatorWorkerCDROMDisk(
        {...cd, dataOffset: 2048},
        delegate
    );
    assert.equal(remaining.size, 4096);
});
