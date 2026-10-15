// Bundle with esbuild, then run with node --test (see cdrom-data.test.ts).
import assert from "node:assert/strict";
import {test} from "node:test";
import {EmulatorWorkerDisksApi} from "../../src/emulator/worker/disks";

test("same-name queued floppies retain separate contents across eject and reinsert", () => {
    const memory = new Uint8Array(16);
    const api = new EmulatorWorkerDisksApi([], false, {
        HEAPU8: memory,
    } as EmscriptenModule);
    const floppy = (value: number) => ({
        name: "LisaDraw.image",
        size: 1,
        isFloppy: true,
        read: (buffer: Uint8Array) => {
            buffer[0] = value;
            return 1;
        },
        write: () => 1,
    });
    api.addDisk(floppy(11));
    api.addDisk(floppy(22));
    const first = api.open(api.consumeDiskName()!);
    api.read(first, 0, 0, 1);
    assert.equal(memory[0], 11);
    api.close(first, true);
    const second = api.open(api.consumeDiskName()!);
    api.read(second, 0, 0, 1);
    assert.equal(memory[0], 22);
    api.close(second, true);
    api.addDisk(floppy(33));
    const third = api.open(api.consumeDiskName()!);
    api.read(third, 0, 0, 1);
    assert.equal(memory[0], 33);
    assert.equal(api.consumeDiskName(), undefined);
});
