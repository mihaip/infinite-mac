import {ResourceEventCapture} from "../src/emulator/worker/inspectors/resource-events";
import {resourceEventCatalog} from "../src/emulator/common/resource-event-catalog";
import assert from "node:assert/strict";
import {test} from "node:test";
import {resourceStructure} from "../src/emulator/common/resource-structure";

import {
    GuestMemoryReader,
    ramMemory,
} from "../src/emulator/worker/inspectors/memory";
import {
    readResourceMaps,
    ResourceInspector,
    ResourceLoadHints,
} from "../src/emulator/worker/inspectors/resources";
import {EmulatorInspector} from "../src/emulator/ui/inspector";
import {EmulatorWorkerInspector} from "../src/emulator/worker/inspector";
import {
    HFSPathResolver,
    type ReadableDisk,
} from "../src/emulator/worker/inspectors/hfs-paths";
import {
    INSPECTOR_GRACE_MS,
    RESOURCE_EVENT_LIMIT,
    readInspectorControl,
    writeInspectorControl,
    type InspectorMessage,
    type InspectorControl,
} from "../src/emulator/common/inspector";
import {
    resourceBitmap,
    resourcePatternCount,
    resourceStrings,
} from "../src/emulator/common/resource-preview";

test("structured windows and alerts decode signed IDs, bounds, padding, and optional positioning", () => {
    const alert = resourceStructure(
        "ALRT",
        Buffer.from("fffe000a006400c8ff8032100002", "hex")
    )!;
    assert.equal(alert.warning, undefined);
    assert.equal(alert.fields[0].children![0].value, -2);
    assert.equal(alert.fields[1].value, -128);
    assert.equal(alert.fields[1].referenceType, "DITL");
    assert.equal(alert.fields[3].value, 2);
    const dialog = Buffer.from(
        "00000000006400c80000ff00000012345678ff80024869000002",
        "hex"
    );
    const decoded = resourceStructure("DLOG", dialog)!;
    assert.equal(decoded.warning, undefined);
    assert.equal(decoded.fields.find(f => f.name === "Title")!.value, "Hi");
    assert.equal(
        decoded.fields.find(f => f.name === "Positioning")!.offset,
        24
    );
    assert.equal(decoded.fields.find(f => f.name === "Visible")!.value, true);
    assert.equal(
        resourceStructure("DLOG", dialog.subarray(0, 23))!.warning,
        undefined
    );
    assert.ok(resourceStructure("DLOG", dialog.subarray(0, 22))!.warning);
    const window = Buffer.concat([dialog.subarray(0, 18), dialog.subarray(20)]);
    assert.equal(resourceStructure("WIND", window)!.warning, undefined);
});

test("structured menus decode packed items and require a terminator", () => {
    const bytes = Buffer.from(
        "00800000000000000000000000030180045361766500530000012d0000000000",
        "hex"
    );
    const menu = resourceStructure("MENU", bytes)!;
    assert.equal(menu.warning, undefined);
    assert.equal(menu.fields.find(f => f.name === "Title")!.value, "Ä");
    const items = menu.fields.find(f => f.name === "Items")!.children!;
    assert.equal(items.length, 2);
    assert.equal(items[0].children![0].value, "Save");
    assert.equal(items[0].children!.at(-1)!.value, true);
    assert.equal(items[1].children!.at(-1)!.value, false);
    assert.ok(resourceStructure("MENU", bytes.subarray(0, -1))!.warning);
    // Every truncated prefix must be handled, never throw into the UI.
    for (let i = 0; i < bytes.length; i++)
        assert.ok(resourceStructure("MENU", bytes.subarray(0, i))!.warning);
});

test("structured dialog items preserve padding, disabled state, and resource references", () => {
    const bytes = Buffer.from(
        "000100000000000000000014006484034f4b21000000000000000014002800642002ff80",
        "hex"
    );
    const decoded = resourceStructure("DITL", bytes)!;
    assert.equal(decoded.warning, undefined);
    assert.equal(decoded.fields.length, 3);
    const first = decoded.fields[1].children!;
    assert.equal(first.find(f => f.name === "Disabled")!.value, true);
    assert.equal(first.find(f => f.name === "Data")!.value, "OK!");
    const reference = decoded.fields[2].children!.find(
        f => f.name === "Resource"
    )!;
    assert.equal(reference.value, -128);
    assert.equal(reference.referenceType, "ICON");
    assert.equal(
        resourceStructure("DITL", Buffer.from("ffff", "hex"))!.warning,
        undefined
    );
    assert.ok(resourceStructure("DITL", bytes.subarray(0, -1))!.warning);
    assert.deepEqual(JSON.parse(JSON.stringify(decoded)), decoded);
});

test("structured controls and menu bars use reusable fields and bound corrupt counts", () => {
    const control = resourceStructure(
        "CNTL",
        Buffer.from("0000000000140064ffff01000064ff9c0000123456780141", "hex")
    )!;
    assert.equal(control.warning, undefined);
    assert.equal(control.fields.find(f => f.name === "Minimum")!.value, -100);
    const menus = resourceStructure(
        "MBAR",
        Buffer.from("00020080ffff", "hex")
    )!;
    assert.equal(menus.fields[2].value, -1);
    assert.equal(menus.fields[2].referenceType, "MENU");
    assert.ok(resourceStructure("MBAR", Buffer.from("ffff", "hex"))!.warning);
    const huge = new Uint8Array(140000);
    huge[0] = huge[1] = 255;
    assert.match(resourceStructure("MBAR", huge)!.warning!, /limit/);
    assert.equal(resourceStructure("CODE", new Uint8Array()), undefined);
    assert.equal(resourceStructure("__proto__", new Uint8Array()), undefined);
    assert.match(
        resourceStructure("ALRT", new Uint8Array(16))!.warning!,
        /trailing/
    );
});

function fixture(ramSize = 0x10000) {
    const ram = new Uint8Array(ramSize);
    const view = new DataView(ram.buffer);
    const u16 = (address: number, value: number) =>
        view.setUint16(address, value);
    const u32 = (address: number, value: number) =>
        view.setUint32(address, value);
    const pstring = (address: number, value: string) => {
        ram[address] = value.length;
        ram.set(
            Array.from(value, c => c.charCodeAt(0)),
            address + 1
        );
    };
    const block = (handle: number, address: number, data: Uint8Array) => {
        const physical = Math.ceil((data.length + 8) / 4) * 4;
        const correction = physical - data.length - 8;
        u32(handle, 0xe0000000 + address);
        u32(address - 8, (0x80 + correction) * 0x1000000 + physical);
        u32(address - 4, handle); // Relative handle isn't needed for reading.
        ram.set(data, address);
    };
    u32(0x31a, 0xffffff);
    u32(0xa50, 0xc0000200);
    u32(0xa54, 0xc0000204);
    u16(0xa5a, 2);
    u16(0x900, 2);
    pstring(0x910, "Test App");
    block(0x200, 0x2000, new Uint8Array(56));
    u32(0x2010, 0x204);
    u16(0x2014, 2);
    u16(0x2018, 28);
    u16(0x201a, 50);
    u16(0x201c, 0); // One type (count minus one).
    ram.set([83, 84, 82, 32], 0x201e); // STR
    u16(0x2022, 0); // One resource.
    u16(0x2024, 10); // Reference list is relative to the type list.
    u16(0x2026, -128);
    u16(0x2028, 0);
    ram[0x202a] = 0x60;
    u32(0x202e, 0xa0000220);
    pstring(0x2032, "Name");
    block(0x220, 0x4000, new Uint8Array([4, 84, 101, 115, 116]));
    block(0x204, 0x3000, new Uint8Array(30));
    u16(0x3014, 3);
    u16(0x3018, 28);
    u16(0x301a, 30);
    u16(0x301c, 0xffff); // No types.
    return {
        ram,
        reader: new GuestMemoryReader(ramMemory(ram), 24),
        u16,
        u32,
        pstring,
        block,
    };
}

test("24-bit map chain: tagged pointers, signed IDs, names, and padded heap sizes", () => {
    const {reader} = fixture();
    const files = readResourceMaps(reader, 1);
    assert.equal(files.length, 2);
    assert.equal(files[0].file.name, "Test App");
    assert.equal(files[1].file.system, true);
    assert.deepEqual(files[1].file.types, []);
    const r = files[0].file.types[0].resources[0];
    assert.equal(r.id, -128);
    assert.equal(r.name, "Name");
    assert.equal(r.attributes, 0x60);
    assert.equal(r.size, 5); // Header and size correction aren't resource bytes.
    assert.equal(r.resident, true);
    assert.deepEqual(
        Array.from(files[0].data.get("STR :-128")!.data),
        [4, 84, 101, 115, 116]
    );
});

test("System 7 FCB filenames use refNum offsets and Pascal names", () => {
    const f = fixture();
    f.u32(0x34e, 0x5000);
    f.u16(0x3f6, 94);
    f.u16(0x5000, 96);
    f.pstring(0x5000 + 2 + 62, "Resource fork");
    assert.equal(readResourceMaps(f.reader, 1)[0].file.name, "Resource fork");
});

test("HFS directory threads resolve a file's display path", () => {
    const bytes = new Uint8Array(4096);
    const view = new DataView(bytes.buffer);
    const pstring = (offset: number, value: string) => {
        bytes[offset] = value.length;
        bytes.set(
            Array.from(value, c => c.charCodeAt(0)),
            offset + 1
        );
    };
    // Flat HFS volume with a two-node catalog in one initial extent.
    view.setUint16(1024, 0x4244);
    view.setUint32(1024 + 20, 512);
    view.setUint16(1024 + 28, 3);
    pstring(1024 + 36, "Macintosh HD");
    view.setUint32(1024 + 146, 1024);
    view.setUint16(1024 + 150, 1);
    view.setUint16(1024 + 152, 2);
    const catalog = 2048;
    view.setUint32(catalog + 16, 1); // Root node.
    view.setUint16(catalog + 32, 512); // Node size.
    const leaf = catalog + 512;
    view.setInt8(leaf + 8, -1);
    view.setUint16(leaf + 10, 1);
    const record = leaf + 14;
    bytes[record] = 6;
    view.setUint32(record + 2, 42); // Thread key is the directory ID.
    const data = record + 8;
    view.setUint16(data, 0x0300);
    view.setUint32(data + 10, 2);
    pstring(data + 14, "Fonts");
    view.setUint16(leaf + 510, 14);
    view.setUint16(leaf + 508, 40);
    const disk: ReadableDisk & {write(): number} = {
        name: "test",
        size: bytes.length,
        read(buffer, offset, length) {
            buffer.set(bytes.subarray(offset, offset + length));
            return length;
        },
        write() {
            return 0;
        },
    };
    assert.deepEqual(
        new HFSPathResolver([disk]).resolve("Macintosh HD", 42, "New York"),
        {
            directory: "Macintosh HD:Fonts",
            path: "Macintosh HD:Fonts:New York",
        }
    );
});

test("handle relocation refreshes bytes without changing logical resource identity", () => {
    const f = fixture();
    const inspector = new ResourceInspector();
    const first = inspector.capture(f.reader, undefined, 1);
    const key = first.files.find(f => f.name === "Test App")!.types[0]
        .resources[0].key;
    f.block(0x220, 0x4100, new Uint8Array([2, 79, 75]));
    const next = inspector.capture(f.reader, key, 2);
    assert.equal(next.detail!.key, key);
    assert.deepEqual(Array.from(next.detail!.data), [2, 79, 75]);
    assert.equal(next.detail!.cached, false);
});

test("purged and released resources retain bounded copies, not borrowed RAM", () => {
    const f = fixture();
    const inspector = new ResourceInspector();
    const first = inspector.capture(f.reader, undefined, 1);
    const key = first.files.find(f => f.name === "Test App")!.types[0]
        .resources[0].key;
    f.u32(0x220, 0xe0000000); // Empty master pointer with high flag bits.
    f.ram.fill(0, 0x4000, 0x4005);
    const purged = inspector.capture(f.reader, key, 2);
    assert.equal(
        purged.files.find(f => f.name === "Test App")!.types[0].resources[0]
            .resident,
        false
    );
    assert.equal(purged.detail!.cached, true);
    assert.equal(purged.detail!.data[1], 84);
    f.u32(0x202e, 0); // Release/detach the handle entirely.
    assert.equal(inspector.capture(f.reader, key, 3).detail!.cached, true);
    const expired = inspector.capture(f.reader, key, INSPECTOR_GRACE_MS + 2);
    assert.equal(expired.detail, undefined);
    assert.equal(
        expired.files.find(f => f.name === "Test App")!.types[0].resources[0]
            .cached,
        false
    );
});

test("closed/context-switched maps are recent, then expire", () => {
    const f = fixture();
    const inspector = new ResourceInspector();
    inspector.capture(f.reader, undefined, 1);
    f.u32(0xa50, 0x204);
    const recent = inspector.capture(f.reader, undefined, 2);
    assert.equal(recent.files.find(f => f.name === "Test App")!.recent, true);
    const resource = recent.files.find(f => f.name === "Test App")!.types[0]
        .resources[0];
    assert.equal(resource.resident, false);
    assert.equal(resource.cached, true);
    assert.equal(
        inspector.capture(f.reader, undefined, INSPECTOR_GRACE_MS + 2).files
            .length,
        1
    );
});

test("grid previews are requested explicitly, bounded, and survive purging", () => {
    const f = fixture();
    f.u32(0x4000 - 8, 0x80000808); // A 2048-byte relocatable block.
    const inspector = new ResourceInspector();
    const initial = inspector.capture(f.reader, undefined, 1);
    const key = initial.files.find(f => f.name === "Test App")!.types[0]
        .resources[0].key;
    assert.deepEqual(initial.previews, []);
    const grid = inspector.capture(f.reader, undefined, 2, Array(70).fill(key));
    assert.equal(grid.previews!.length, 64);
    assert.equal(grid.previews![0].data.length, 1024);
    assert.equal(grid.previews![0].data.buffer.byteLength, 1024);
    assert.equal(grid.previews![0].size, 2048);
    f.u32(0x220, 0);
    const purged = inspector.capture(f.reader, undefined, 3, [key, "missing"]);
    assert.equal(purged.previews!.length, 1);
    assert.equal(purged.previews![0].cached, true);
    assert.equal(purged.previews![0].data[1], 84);
});

test("invalid map offsets, names, and cycles fail without committing history", () => {
    for (const corrupt of [
        (f: ReturnType<typeof fixture>) => f.u16(0x2018, 65534),
        (f: ReturnType<typeof fixture>) => f.u16(0x2028, 200),
        (f: ReturnType<typeof fixture>) => f.u32(0x3010, 0x200),
    ]) {
        const f = fixture();
        const inspector = new ResourceInspector();
        const before = inspector.capture(f.reader, undefined, 1);
        corrupt(f);
        assert.throws(() => inspector.capture(f.reader, undefined, 2));
        assert.equal(before.files.length, 2);
    }
});

test("a bad resource block is unavailable without hiding the valid map catalog", () => {
    const f = fixture();
    f.u32(0x220, 0x60f00000);
    const r = readResourceMaps(f.reader, 1)[0].file.types[0].resources[0];
    assert.equal(r.resident, true);
    assert.match(r.unavailable!, /heap block/);
});

test("Basilisk capture selects 32-bit heaps even with a 24-bit Lo3Bytes mask", () => {
    const f = fixture();
    f.u16(0x15a, 0x810);
    f.ram[0xcb2] = 1;
    f.u32(0xa50, 0x200);
    f.u32(0xa54, 0x204);
    f.u32(0x202e, 0x220);
    for (const [handle, address, size] of [
        [0x200, 0x2000, 56],
        [0x204, 0x3000, 30],
        [0x220, 0x4000, 5],
    ]) {
        f.u32(handle, address);
        f.u32(address - 12, 0x80000000);
        f.u32(address - 8, size + 12);
        f.u32(address - 4, handle);
    }
    const messages: InspectorMessage[] = [];
    const worker = new EmulatorWorkerInspector(
        {type: "fallback"},
        () => ({version: 1, subscriptions: ["resources"]}),
        m => messages.push(m)
    );
    worker.initialize("BasiliskII");
    worker.tick(f.ram);
    const snapshot = messages.find(m => m.type === "inspector_snapshot");
    assert.ok(snapshot && snapshot.type === "inspector_snapshot");
    assert.equal(snapshot.snapshot.pointerBits, 32);
    assert.equal(
        messages
            .flatMap(m => (m.type === "inspector_events" ? m.events : []))
            .find(e => e.file.name === "Test App")!.detail.size,
        5
    );
    worker.tick(f.ram);
    assert.equal(
        messages.filter(m => m.type === "inspector_snapshot").length,
        1
    ); // One throttled snapshot, plus event data.
});

test("loader hints retain purged bytes, prefer live bytes, and reject stale or mismatched references", () => {
    const f = fixture();
    const hints = new ResourceLoadHints();
    hints.record(f.reader, 0x53545220, -128, 0x220, 0x2026, 100);
    f.ram[0x4001] = 88;
    assert.equal(
        readResourceMaps(f.reader, 200, hints)[0].data.get("STR :-128")!
            .data[1],
        88
    );
    f.u32(0x220, 0); // Purged before the next map snapshot.
    const captured = readResourceMaps(f.reader, 200, hints)[0];
    assert.equal(captured.file.types[0].resources[0].resident, false);
    assert.deepEqual(
        [...captured.data.get("STR :-128")!.data],
        [4, 84, 101, 115, 116]
    );
    assert.equal(readResourceMaps(f.reader, 1101, hints)[0].data.size, 0);
    f.u32(0x202e, 0x224); // A different handle must not inherit old bytes.
    assert.equal(readResourceMaps(f.reader, 200, hints)[0].data.size, 0);
});

test("loader events are batched and ignored while paused or unsubscribed", () => {
    for (const mode of ["active", "paused", "inactive"] as const) {
        const f = fixture();
        let control: InspectorControl = {
            version: 1,
            subscriptions: mode === "inactive" ? [] : ["resources"],
            paused: mode === "paused",
        };
        const messages: InspectorMessage[] = [];
        const worker = new EmulatorWorkerInspector(
            {type: "fallback"},
            () => control,
            m => messages.push(m)
        );
        worker.initialize("BasiliskII");
        worker.resourceLoaded(f.ram, 0x53545220, -128, 0x220, 0x2026);
        assert.equal(messages.length, 1);
        f.u32(0x220, 0);
        control = {version: 1, subscriptions: ["resources"]};
        worker.tick(f.ram);
        const events = messages.flatMap(m =>
            m.type === "inspector_events" ? m.events : []
        );
        assert.equal(events.length, mode === "active" ? 1 : 0);
        if (events.length)
            assert.deepEqual(
                [...events[0].detail.data],
                [4, 84, 101, 115, 116]
            );
    }
});

test("32-bit heap reader uses the 12-byte header, retaining full addresses", () => {
    const ram = new Uint8Array(0x1000);
    const v = new DataView(ram.buffer);
    v.setUint32(0x100, 0x200);
    ram[0x200 - 12] = 0x80;
    ram[0x200 - 9] = 3;
    v.setUint32(0x200 - 8, 20);
    const reader = new GuestMemoryReader(ramMemory(ram), 32);
    assert.deepEqual(reader.handle(0x100), {address: 0x200, size: 5});
    assert.throws(() => reader.bytes(0xffffffff, 2));
});

test("shared control ignores unpublished/torn state and unchanged versions", () => {
    const buffer = new SharedArrayBuffer(4096);
    const control: InspectorControl = {
        version: 1,
        subscriptions: ["resources"],
        resourceKey: "test",
    };
    writeInspectorControl(buffer, control);
    const first = readInspectorControl(buffer, -1)!;
    assert.deepEqual(first.control, control);
    assert.equal(readInspectorControl(buffer, first.sequence), undefined);
    Atomics.add(new Int32Array(buffer), 0, 1);
    assert.equal(readInspectorControl(buffer, -1), undefined);
});

for (const shared of [true, false])
    test(`${shared ? "shared" : "fallback"} capture is lazy, continues for five minutes, cancels expiry on reopening`, context => {
        context.mock.timers.enable({apis: ["setTimeout"]});
        let fallback: InspectorControl | undefined;
        const ui = new EmulatorInspector(shared, control => {
            fallback = control;
        });
        const messages: InspectorMessage[] = [];
        const worker = new EmulatorWorkerInspector(
            ui.workerConfig(),
            () => {
                const c = fallback;
                fallback = undefined;
                return c;
            },
            message => {
                messages.push(message);
                ui.handleMessage(message);
            }
        );
        worker.initialize(8);
        assert.equal(worker.active(), false);
        assert.equal(messages.length, 1); // Only capabilities, no capture.
        ui.setOpen(true);
        assert.equal(worker.active(), true);
        worker.capture(fixture().ram);
        assert.equal(ui.getSnapshot().sequence, 1);
        ui.setOpen(false);
        context.mock.timers.tick(INSPECTOR_GRACE_MS - 1);
        assert.equal(worker.active(), true);
        ui.setOpen(true);
        context.mock.timers.tick(2);
        assert.equal(worker.active(), true);
        ui.setOpen(false);
        context.mock.timers.tick(INSPECTOR_GRACE_MS);
        assert.equal(worker.active(), false);
        assert.equal(ui.getSnapshot().sequence, 1);
        assert.ok(ui.getSnapshot().snapshot); // Last snapshot stays available.
        ui.dispose();
    });

test("worker restarts clear snapshots and accept new sequence numbers", () => {
    const ui = new EmulatorInspector(true);
    ui.handleMessage({
        type: "inspector_capabilities",
        version: 1,
        inspectors: ["resources"],
    });
    ui.workerStopped();
    assert.equal(ui.getSnapshot().supported, false);
    ui.handleMessage({
        type: "inspector_capabilities",
        version: 1,
        inspectors: ["resources"],
    });
    assert.equal(ui.getSnapshot().supported, true);
    ui.dispose();
});

test("monochrome mask, cursor hotspot, and MacRoman string decoding", () => {
    const data = new Uint8Array(68);
    data[0] = 0x80;
    data[32] = 0xc0;
    data[65] = 5;
    data[67] = 7;
    const bitmap = resourceBitmap("CURS", data)!;
    assert.deepEqual(
        [...bitmap.rgba.subarray(0, 12)],
        [0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 0]
    );
    assert.deepEqual(bitmap.hotspot, {x: 7, y: 5});
    assert.equal(resourceBitmap("CURS", new Uint8Array(1)), undefined);
    assert.deepEqual(
        resourceStrings("STR#", new Uint8Array([0, 2, 1, 0x8e, 2, 79, 75])),
        ["é", "OK"]
    );
    assert.equal(resourceStrings("STR ", new Uint8Array([20, 1])), undefined);
});

test("indexed icon previews use classic palettes and companion masks", () => {
    const data4 = new Uint8Array(128);
    data4[0] = 0x1f;
    assert.deepEqual(
        [...resourceBitmap("ics4", data4)!.rgba.subarray(0, 8)],
        [252, 243, 5, 255, 0, 0, 0, 255]
    );
    const data8 = new Uint8Array(256);
    data8.set([0, 215, 245, 255]);
    assert.deepEqual(
        [...resourceBitmap("ics8", data8)!.rgba.subarray(0, 16)],
        [255, 255, 255, 255, 238, 0, 0, 255, 238, 238, 238, 255, 0, 0, 0, 255]
    );
    const mask = new Uint8Array(64);
    mask[32] = 0x80;
    assert.equal(resourceBitmap("ics8", data8, mask)!.rgba[7], 0);
});

test("cicn decodes indexed pixels, row padding, color tables, and its mask", () => {
    const data = new Uint8Array(122);
    const view = new DataView(data.buffer);
    view.setUint16(4, 0x8004); // PixMap with four-byte rows.
    view.setInt16(6, -1);
    view.setInt16(8, 4);
    view.setInt16(10, 1);
    view.setInt16(12, 7); // Bounds: 3 by 2.
    view.setUint16(32, 4);
    view.setUint16(34, 1);
    view.setUint16(36, 4);
    view.setUint16(54, 2);
    for (const offset of [56, 70]) {
        view.setInt16(offset, -1);
        view.setInt16(offset + 2, 4);
        view.setInt16(offset + 4, 1);
        view.setInt16(offset + 6, 7);
    }
    view.setUint16(68, 2);
    data.set([0xc0, 0, 0xe0, 0], 82); // Third top-row pixel is transparent.
    const table = 90;
    view.setUint16(table + 6, 1); // Two colors, stored out of index order.
    view.setUint16(table + 8, 1);
    view.setUint16(table + 10, 65535); // Index 1 = red.
    view.setUint16(table + 16, 0);
    view.setUint16(table + 22, 65535); // Index 0 = blue.
    data.set([0x10, 0x10, 0, 0, 0x10, 0x10, 0, 0], 114);
    const bitmap = resourceBitmap("cicn", data)!;
    assert.equal(bitmap.width, 3);
    assert.equal(bitmap.height, 2);
    assert.deepEqual(
        [...bitmap.rgba.subarray(0, 12)],
        [255, 0, 0, 255, 0, 0, 255, 255, 255, 0, 0, 0]
    );
    view.setUint16(16, 1);
    assert.equal(resourceBitmap("cicn", data), undefined);
    assert.equal(resourceBitmap("cicn", data.subarray(0, 110)), undefined);
});

test("cicn accepts an omitted monochrome fallback bitmap", () => {
    const data = new Uint8Array(194);
    const view = new DataView(data.buffer);
    view.setUint16(4, 0x8004);
    view.setInt16(10, 12);
    view.setInt16(12, 24);
    view.setUint16(32, 1);
    view.setUint16(34, 1);
    view.setUint16(36, 1);
    view.setUint16(54, 4);
    view.setInt16(60, 12);
    view.setInt16(62, 24);
    for (let offset = 82; offset < 130; offset += 4)
        data.set([0xff, 0xff, 0xff, 0], offset);
    view.setUint16(136, 0); // One color at the table starting at 130.
    view.setUint16(138, 1);
    view.setUint16(140, 0x5600);
    view.setUint16(142, 0x2c9d);
    view.setUint16(144, 0x0524);
    data.fill(0xff, 146);
    const bitmap = resourceBitmap("cicn", data)!;
    assert.equal(bitmap.width, 24);
    assert.equal(bitmap.height, 12);
    assert.deepEqual([...bitmap.rgba.subarray(0, 4)], [86, 44, 5, 255]);
});

for (const shared of [true, false])
    test(`${shared ? "shared" : "fallback"} pause freezes memory and preserves browsing across drawer close`, context => {
        context.mock.timers.enable({apis: ["setTimeout", "Date"], now: 1000});
        const f = fixture();
        let fallback: InspectorControl | undefined;
        const ui = new EmulatorInspector(shared, c => {
            fallback = c;
        });
        const messages: InspectorMessage[] = [];
        const worker = new EmulatorWorkerInspector(
            ui.workerConfig(),
            () => {
                const result = fallback;
                fallback = undefined;
                return result;
            },
            message => {
                messages.push(message);
                ui.handleMessage(message);
            }
        );
        worker.initialize(8);
        ui.setOpen(true);
        assert.equal(worker.active(), true);
        worker.capture(f.ram);
        const before = ui.getSnapshot().snapshot!;
        const firstEvent = ui.getSnapshot().events![0];
        const key = firstEvent.resource.key;
        ui.setPaused(true);
        // A capture already in flight must not replace the paused display.
        ui.handleMessage({
            type: "inspector_snapshot",
            version: 1,
            inspector: "resources",
            sequence: 99,
            snapshot: {...before, capturedAt: 9999},
        });
        assert.equal(ui.getSnapshot().snapshot, before);
        assert.equal(worker.active(), false); // No request for a RAM mirror.
        const messageCount = messages.length;
        assert.equal(worker.active(), false);
        assert.equal(messages.length, messageCount); // No repeated frozen snapshots.
        f.block(0x220, 0x4100, new Uint8Array([2, 79, 75]));
        ui.setOpen(false);
        context.mock.timers.tick(INSPECTOR_GRACE_MS * 2);
        ui.setOpen(true);
        ui.selectResource(key);
        ui.selectPreviews([key]);
        assert.equal(worker.active(), false);
        const frozen = ui.getSnapshot().snapshot!;
        assert.equal(frozen.capturedAt, before.capturedAt);
        assert.deepEqual(
            [...ui.getSnapshot().events![0].detail.data],
            [4, 84, 101, 115, 116]
        );
        assert.equal(ui.getSnapshot().events![0], firstEvent);
        ui.setPaused(false);
        assert.equal(worker.active(), true);
        worker.resourceLoaded(f.ram, 0x53545220, -128, 0x220, 0x2026);
        worker.capture(f.ram);
        assert.deepEqual(ui.getSnapshot().events, [firstEvent]);
        f.u16(0x2026, 128); // A different resource can still be captured after resume.
        worker.resourceLoaded(f.ram, 0x53545220, 128, 0x220, 0x2026);
        worker.capture(f.ram);
        assert.deepEqual(
            [...ui.getSnapshot().events!.at(-1)!.detail.data],
            [2, 79, 75]
        );
        assert.ok(ui.getSnapshot().snapshot!.capturedAt > before.capturedAt);
        ui.setOpen(false);
        context.mock.timers.tick(INSPECTOR_GRACE_MS);
        assert.equal(worker.active(), false);
        ui.dispose();
    });

test("PAT# validates its count and previews distinct patterns in a contact sheet", () => {
    const patterns = new Uint8Array([
        0,
        2,
        ...Array(8).fill(0),
        ...Array(8).fill(255),
    ]);
    assert.equal(resourcePatternCount(patterns), 2);
    const bitmap = resourceBitmap("PAT#", patterns)!;
    assert.deepEqual([...bitmap.rgba.subarray(0, 4)], [255, 255, 255, 255]);
    assert.deepEqual([...bitmap.rgba.subarray(18 * 4, 19 * 4)], [0, 0, 0, 255]);
    assert.equal(resourceBitmap("PAT#", patterns.subarray(0, -1)), undefined);
    assert.equal(
        resourceBitmap("PAT#", new Uint8Array([0xff, 0xff])),
        undefined
    );
});

function pixelPatternFixture(depth: number) {
    const data = new Uint8Array(120);
    const view = new DataView(data.buffer);
    view.setUint16(0, 1);
    view.setUint32(2, 28);
    view.setUint32(6, 78);
    view.setUint16(32, 0x8004); // Four-byte rows, including padding.
    view.setInt16(34, -1);
    view.setInt16(36, 4);
    view.setInt16(38, 1);
    view.setInt16(40, 7); // Bounds: 3 by 2.
    view.setUint16(60, depth);
    view.setUint16(62, 1);
    view.setUint16(64, depth);
    view.setUint32(70, 86);
    // Palette values may be sparse and entries needn't be sorted.
    const high = (1 << depth) - 1;
    for (const start of [78, 82])
        for (const x of [0, 2]) {
            const bit = x * depth;
            data[start + (bit >> 3)] |= high << (8 - depth - (bit % 8));
        }
    view.setUint16(92, 1); // Two colors.
    view.setUint16(94, high);
    view.setUint16(96, 65535); // High index = red.
    view.setUint16(102, 0);
    view.setUint16(108, 65535); // Zero = blue.
    return {data: data.subarray(0, 110), view};
}

for (const depth of [1, 2, 4, 8])
    test(`ppat decodes ${depth}-bit pixels, row padding, signed bounds, and explicit palette indices`, () => {
        const {data} = pixelPatternFixture(depth);
        const prefixed = new Uint8Array(data.length + 7);
        prefixed.set(data, 7);
        const bitmap = resourceBitmap("ppat", prefixed.subarray(7))!;
        assert.equal(bitmap.width, 3);
        assert.equal(bitmap.height, 2);
        const row = [255, 0, 0, 255, 0, 0, 255, 255, 255, 0, 0, 255];
        assert.deepEqual([...bitmap.rgba], [...row, ...row]);
    });

test("ppat rejects corrupt offsets, oversized images, missing colors, and unsupported packing", () => {
    for (const mutate of [
        (v: DataView) => v.setUint32(2, 0xffffffe0),
        (v: DataView) => v.setUint32(6, 0xffffff00),
        (v: DataView) => v.setUint32(70, 0xffffffe0),
        (v: DataView) => v.setUint16(92, 0xffff),
        (v: DataView) => v.setUint16(40, 300),
        (v: DataView) => v.setUint16(44, 1),
        (v: DataView) => v.setUint16(94, 4),
    ]) {
        const {data, view} = pixelPatternFixture(1);
        mutate(view);
        assert.equal(resourceBitmap("ppat", data), undefined);
    }
    assert.equal(
        resourceBitmap("ppat", pixelPatternFixture(1).data.subarray(0, 100)),
        undefined
    );
});

test("pre-close capture retains a transient file without publishing and respects pause/disable", () => {
    for (const mode of ["active", "paused", "disabled"] as const) {
        const f = fixture();
        let control: InspectorControl = {
            version: 1,
            subscriptions: mode === "disabled" ? [] : ["resources"],
            paused: mode === "paused",
        };
        const messages: InspectorMessage[] = [];
        const worker = new EmulatorWorkerInspector(
            {type: "fallback"},
            () => control,
            m => messages.push(m)
        );
        worker.initialize("BasiliskII");
        worker.beforeResourceFileClose(f.ram);
        assert.equal(
            messages.filter(m => m.type === "inspector_snapshot").length,
            0
        ); // Close hooks may publish events, never a live snapshot.
        f.u32(0xa50, 0x204); // Close the application map before the next tick.
        f.u32(0x220, 0); // Its resource is no longer resident.
        control = {version: 1, subscriptions: ["resources"]};
        worker.tick(f.ram);
        const message = messages.at(-1);
        assert.ok(message?.type === "inspector_snapshot");
        const events = messages.flatMap(m =>
            m.type === "inspector_events" ? m.events : []
        );
        assert.equal(events.length, mode === "active" ? 1 : 0);
        if (events.length) {
            assert.equal(events[0].file.name, "Test App");
            assert.deepEqual(
                [...events[0].detail.data],
                [4, 84, 101, 115, 116]
            );
        }
        f.u32(0xa50, 0xffff); // Malformed memory must not escape the hook.
        const count = messages.length;
        assert.doesNotThrow(() => worker.beforeResourceFileClose(f.ram));
        assert.equal(messages.length, count);
    }
});

test("first captures survive repeated callbacks, content changes, purge, and reload", () => {
    const f = fixture();
    const capture = new ResourceEventCapture();
    const first = capture.capture(f.reader, "Initial scan", 100);
    assert.equal(first.length, 1);
    assert.equal(first[0].kind, "observed");
    assert.equal(capture.capture(f.reader, "Another scan", 101).length, 0);
    assert.equal(
        capture.capture(f.reader, "Resource loader", 102, 0x220).length,
        0
    );
    f.ram[0x4001] = 88;
    assert.equal(first[0].detail.data[1], 84);
    f.u32(0x220, 0);
    assert.equal(capture.capture(f.reader, "Release", 103).length, 0);
    f.block(0x220, 0x5000, new Uint8Array([1, 89]));
    assert.equal(
        capture.capture(f.reader, "LoadResource return", 104).length,
        0
    );
    const catalog = resourceEventCatalog(first)!;
    assert.equal(catalog.files.length, 1);
    assert.equal(catalog.files[0].types[0].resources.length, 1);
    const key = catalog.files[0].types[0].resources[0].key;
    assert.deepEqual(
        [...resourceEventCatalog(first, key)!.detail!.data],
        [4, 84, 101, 115, 116]
    );
});

test("first capture identity includes source file, type, and ID but not the executing application", () => {
    const f = fixture();
    f.u16(0x3f6, 94);
    f.u32(0x34e, 0x6000);
    f.u16(0x6000, 96);
    f.pstring(0x6040, "Document");
    f.u32(0x6016, 0x7000);
    f.pstring(0x702c, "Disk");
    f.u32(0x603c, 42);
    const capture = new ResourceEventCapture();
    const first = capture.capture(f.reader, "scan", 100)[0];
    f.pstring(0x910, "Another application");
    assert.equal(capture.capture(f.reader, "loader", 101, 0x220).length, 0);
    // Identically named documents in different directories are distinct files.
    f.u32(0x603c, 43);
    const otherFile = capture.capture(f.reader, "scan", 102)[0];
    assert.notEqual(first.file.key, otherFile.file.key);
    f.ram.set([77, 69, 78, 85], 0x201e);
    assert.equal(capture.capture(f.reader, "scan", 103)[0].type, "MENU");
    f.u16(0x2026, 128);
    assert.equal(capture.capture(f.reader, "scan", 104)[0].resource.id, 128);
    // Reopening the original file under another map handle still deduplicates.
    f.u32(0x603c, 42);
    f.ram.set([83, 84, 82, 32], 0x201e);
    f.u16(0x2026, -128);
    f.block(0x208, 0x2100, f.ram.slice(0x2000, 0x2038));
    f.u32(0xa50, 0x208);
    assert.equal(capture.capture(f.reader, "reopened", 105, 0x220).length, 0);
});

test("resource event scans do not count process switches or relocation as loads", () => {
    const f = fixture();
    const capture = new ResourceEventCapture();
    capture.capture(f.reader, "scan", 1);
    f.u32(0xa50, 0x204);
    assert.equal(capture.capture(f.reader, "other process", 2).length, 0);
    f.u32(0xa50, 0x200);
    f.block(0x220, 0x5000, new Uint8Array([4, 84, 101, 115, 116]));
    assert.equal(capture.capture(f.reader, "relocated", 3).length, 0);
});

for (const core of ["Snow", "BasiliskII"] as const) {
    test(`${core} loader events survive a document closing before any periodic scan`, () => {
        const f = fixture();
        const pict = new Uint8Array([
            0, 14, 0, 0, 0, 0, 0, 10, 0, 10, 0x11, 1, 0xff, 0,
        ]);
        f.pstring(0x910, "TeachText");
        f.ram.set([80, 73, 67, 84], 0x201e);
        f.u16(0x2026, 1000);
        f.block(0x220, 0x4000, pict);
        const ui = new EmulatorInspector(true);
        const worker = new EmulatorWorkerInspector(
            ui.workerConfig(),
            () => undefined,
            m => ui.handleMessage(m)
        );
        worker.initialize(core === "Snow" ? 11 : "BasiliskII");
        ui.setOpen(true);
        if (core === "Snow") {
            worker.callObserved(f.ram, 0x7f0, false, 0, 0, 0x50494354, 0x100);
            worker.callObserved(
                f.ram,
                0x7f0,
                true,
                0x220,
                0x2026,
                0x50494354,
                0x100
            );
        } else worker.resourceLoaded(f.ram, 0x50494354, 1000, 0x220, 0x2026);
        // Destroy every live source of these bytes before publication.
        f.u32(0xa50, 0x204);
        f.u32(0x220, 0);
        f.ram.fill(0, 0x4000, 0x4000 + pict.length);
        worker.tick(f.ram);
        const events = ui.getSnapshot().events!;
        assert.equal(events.length, 1);
        assert.equal(events[0].kind, "load");
        assert.equal(events[0].type, "PICT");
        assert.equal(events[0].resource.id, 1000);
        assert.equal(events[0].processName, "TeachText");
        assert.deepEqual(events[0].detail.data, pict);
        assert.equal(resourceEventCatalog(events)!.files.length, 1);
        ui.dispose();
    });
}

test("a loader callback preserves bytes even when its file has left the current map chain", () => {
    const f = fixture();
    f.u32(0xa50, 0x204);
    const events = new ResourceEventCapture().capture(
        f.reader,
        "loader",
        1,
        0x220,
        undefined,
        {type: 0x53545220, id: -128, reference: 0x2026}
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].file.name, "Source unavailable");
    assert.equal(events[0].type, "STR ");
    assert.deepEqual([...events[0].detail.data], [4, 84, 101, 115, 116]);
    assert.equal(
        new ResourceEventCapture().capture(
            f.reader,
            "loader",
            1,
            0x220,
            undefined,
            {type: 0x53545220, id: 99, reference: 0x2026}
        ).length,
        0
    );
});

test("event eviction does not forget worker capture identities", () => {
    const f = fixture();
    const capture = new ResourceEventCapture();
    const event = capture.capture(f.reader, "loader", 1, 0x220)[0];
    const ui = new EmulatorInspector(false);
    const events = Array.from({length: RESOURCE_EVENT_LIMIT + 2}, (_, i) => ({
        ...event,
        id: i + 1,
        resource: i === 0 ? event.resource : {...event.resource, id: i},
    }));
    ui.handleMessage({type: "inspector_events", version: 1, events});
    assert.equal(ui.getSnapshot().events!.length, RESOURCE_EVENT_LIMIT);
    assert.equal(ui.getSnapshot().events![0].id, 3);
    assert.equal(
        capture.capture(f.reader, "repeat after eviction", 2, 0x220).length,
        0
    );
    assert.equal(ui.getSnapshot().events!.at(-1)!.id, RESOURCE_EVENT_LIMIT + 2);
    assert.equal(ui.getSnapshot().droppedEvents, 2);
    ui.workerStopped();
    assert.equal(ui.getSnapshot().events, undefined);
    ui.dispose();
});

test("event data is not truncated to the old snapshot preview limit", () => {
    const f = fixture(1024 * 1024);
    const bytes = Uint8Array.from({length: 300 * 1024}, (_, i) => i & 255);
    f.block(0x220, 0x4000, bytes);
    const event = new ResourceEventCapture().capture(
        f.reader,
        "loader",
        1,
        0x220
    )[0];
    assert.equal(event.detail.data.length, bytes.length);
    f.ram.fill(0, 0x4000);
    assert.deepEqual(event.detail.data, bytes);
});

test("an invalid loader handle does not discard other newly observed resources", () => {
    const f = fixture();
    const capture = new ResourceEventCapture();
    const events = capture.capture(f.reader, "loader", 1, 0x240, undefined, {
        type: 0x50494354,
        id: 1,
        reference: 0xfffe,
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "STR ");
    assert.equal(events[0].kind, "observed");
});

test("catalog edits do not manufacture resource loads or a second source file", () => {
    const f = fixture();
    const capture = new ResourceEventCapture();
    const initial = capture.capture(f.reader, "scan", 1);
    const map = new Uint8Array(64);
    map.set(f.ram.subarray(0x2000, 0x2026));
    map.set(f.ram.subarray(0x2026, 0x2038), 46);
    f.block(0x200, 0x2100, map);
    f.u16(0x211c, 1); // Add an empty CODE type; STR and its handle are unchanged.
    f.u16(0x211a, 58);
    f.u16(0x2124, 18);
    f.ram.set([67, 79, 68, 69], 0x2126);
    f.u16(0x212a, 0xffff);
    f.u16(0x212c, 18);
    assert.equal(capture.capture(f.reader, "catalog changed", 2).length, 0);
    const repeated = capture.capture(f.reader, "loader", 3, 0x220);
    assert.equal(repeated.length, 0);
    assert.equal(
        resourceEventCatalog([...initial, ...repeated])!.files.length,
        1
    );
});

test("targeted loader reads avoid unrelated resources and preserve later scan discoveries", () => {
    const f = fixture(0x40000);
    const count = 1000;
    const base = 0x5000;
    f.block(0x200, base, new Uint8Array(38 + count * 12));
    f.u16(base + 20, 2);
    f.u16(base + 24, 28);
    f.u16(base + 26, 38 + count * 12);
    f.u16(base + 28, 0);
    f.ram.set([83, 84, 82, 32], base + 30);
    f.u16(base + 34, count - 1);
    f.u16(base + 36, 10);
    for (let i = 0; i < count; i++) {
        const ref = base + 38 + i * 12;
        f.u16(ref, i);
        f.u16(ref + 2, 0xffff);
        f.u32(ref + 8, 0x1000 + i * 4);
        f.block(0x1000 + i * 4, 0x10000 + i * 16, new Uint8Array([1, 65]));
    }
    let reads = 0;
    const reader = new GuestMemoryReader(
        {
            read: (address, length) => {
                reads++;
                return ramMemory(f.ram).read(address, length);
            },
        },
        24
    );
    const full = readResourceMaps(reader, 1, undefined, true);
    const fullReads = reads;
    const capture = new ResourceEventCapture();
    reads = 0;
    const first = capture.capture(reader, "loader", 2, 0x1000, undefined, {
        reference: base + 38,
        type: 0x53545220,
        id: 0,
    });
    assert.equal(first.length, 1);
    assert.deepEqual(first[0].detail.data, full[0].data.get("STR :0")!.data);
    assert.ok(
        reads < fullReads / 20,
        `${reads} targeted reads vs ${fullReads} full reads`
    );
    assert.equal(capture.capture(reader, "scan", 3).length, count - 1);
    reads = 0;
    assert.equal(capture.capture(reader, "unchanged scan", 4).length, 0);
    assert.ok(
        reads < fullReads / 2,
        `${reads} cached reads vs ${fullReads} full reads`
    );
    // Same map bytes, but a master pointer is purged then reloaded.
    f.u32(0x1000, 0);
    assert.equal(capture.capture(reader, "purge", 5).length, 0);
    f.block(0x1000, 0x10000, new Uint8Array([1, 66]));
    const reloaded = capture.capture(reader, "reload", 6);
    assert.equal(reloaded.length, 0);
    assert.deepEqual([...first[0].detail.data], [1, 65]);
});

test("a failed map walk does not cache uncommitted discoveries", () => {
    const f = fixture();
    const capture = new ResourceEventCapture();
    capture.capture(f.reader, "initial", 1);
    f.u32(0x220, 0);
    capture.capture(f.reader, "purged", 2);
    f.block(0x220, 0x4000, new Uint8Array([1, 88]));
    f.u16(0x2026, 128); // A previously unseen resource.
    f.u32(0x3010, 0xffff); // Later map is corrupt after the reload is decoded.
    assert.throws(() => capture.capture(f.reader, "broken chain", 3));
    f.u32(0x3010, 0);
    const events = capture.capture(f.reader, "repaired chain", 4);
    assert.equal(events.length, 1);
    assert.deepEqual([...events[0].detail.data], [1, 88]);
});

test("repeated callbacks do not reach the UI, and a new worker starts a fresh history", () => {
    const f = fixture();
    const ui = new EmulatorInspector(true);
    const run = () => {
        const worker = new EmulatorWorkerInspector(
            ui.workerConfig(),
            () => undefined,
            m => ui.handleMessage(m)
        );
        worker.initialize(11);
        ui.setOpen(true);
        worker.resourceLoaded(f.ram, 0x53545220, -128, 0x220, 0x2026);
        worker.capture(f.ram);
        return worker;
    };
    const worker = run();
    const first = ui.getSnapshot().events;
    for (let i = 0; i < 100; i++)
        worker.resourceLoaded(f.ram, 0x53545220, -128, 0x220, 0x2026);
    worker.capture(f.ram);
    assert.equal(ui.getSnapshot().events, first);
    ui.workerStopped();
    assert.equal(ui.getSnapshot().events, undefined);
    run();
    assert.equal(ui.getSnapshot().events!.length, 1);
    ui.dispose();
});

test("targeted color-icon loads keep the companion mask as an immutable copy", () => {
    const f = fixture();
    f.block(0x200, 0x2000, new Uint8Array(70));
    f.u16(0x2014, 2);
    f.u16(0x2018, 28);
    f.u16(0x201a, 70);
    f.u16(0x201c, 1);
    f.ram.set([105, 99, 108, 56], 0x201e); // icl8
    f.u16(0x2022, 0);
    f.u16(0x2024, 18);
    f.ram.set([73, 67, 78, 35], 0x2026); // ICN#
    f.u16(0x202a, 0);
    f.u16(0x202c, 30);
    f.u16(0x202e, 128);
    f.u16(0x2030, 0xffff);
    f.u32(0x2036, 0x220);
    f.u16(0x203a, 128);
    f.u16(0x203c, 0xffff);
    f.u32(0x2042, 0x224);
    f.block(0x220, 0x4000, new Uint8Array(1024));
    f.block(0x224, 0x5000, new Uint8Array(256).fill(255));
    const capture = new ResourceEventCapture();
    f.u32(0x220, 0);
    const mask = capture.capture(f.reader, "scan", 0);
    assert.equal(mask.length, 1);
    assert.equal(mask[0].type, "ICN#");
    f.u32(0x220, 0x4000);
    const event = capture
        .capture(f.reader, "loader", 1, 0x220, undefined, {
            type: 0x69636c38,
            id: 128,
            reference: 0x202e,
        })
        .find(e => e.kind === "load")!;
    assert.equal(event.type, "icl8");
    assert.equal(event.detail.mask!.length, 256);
    f.ram.fill(0, 0x5000, 0x5100);
    assert.ok(event.detail.mask!.every(byte => byte === 255));
});

test("known loader repeats skip payloads, handle validation, path lookup, and unknown fallback", context => {
    const f = fixture();
    f.u16(0x3f6, 94);
    f.u32(0x34e, 0x6000);
    f.u16(0x6000, 96);
    f.pstring(0x6040, "Document");
    f.u32(0x6016, 0x7000);
    f.pstring(0x702c, "Disk");
    f.u32(0x603c, 42);
    const paths = new HFSPathResolver([]);
    const resolve = context.mock.method(paths, "resolve");
    const capture = new ResourceEventCapture(paths);
    const loaded = {type: 0x53545220, id: -128, reference: 0x2026};
    assert.equal(
        capture.capture(f.reader, "loader", 1, 0x220, undefined, loaded).length,
        1
    );
    assert.equal(resolve.mock.callCount(), 1);
    let payloadReads = 0;
    const reader = new GuestMemoryReader(
        {
            read(address, length) {
                if (
                    address === 0x220 ||
                    (address < 0x4010 && address + length > 0x3ff8)
                )
                    payloadReads++;
                return ramMemory(f.ram).read(address, length);
            },
        },
        24
    );
    for (let i = 0; i < 100; i++)
        assert.equal(
            capture.capture(reader, "repeat", 2 + i, 0x220, undefined, loaded)
                .length,
            0
        );
    assert.equal(payloadReads, 0);
    assert.equal(resolve.mock.callCount(), 1);
});

test("failed or purged payloads remain eligible for their first successful capture", () => {
    const f = fixture();
    const capture = new ResourceEventCapture();
    f.u32(0x220, 0);
    assert.equal(capture.capture(f.reader, "purged", 1).length, 0);
    f.u32(0x220, 0x4000);
    f.ram[0x3ff8] = 0;
    assert.equal(capture.capture(f.reader, "invalid heap", 2).length, 0);
    f.block(0x220, 0x4000, new Uint8Array([1, 65]));
    assert.deepEqual(
        [...capture.capture(f.reader, "repaired", 3)[0].detail.data],
        [1, 65]
    );
    assert.equal(capture.capture(f.reader, "repeat", 4).length, 0);
});

test("map cache eviction does not forget captured resources", () => {
    const f = fixture();
    const capture = new ResourceEventCapture();
    assert.equal(capture.capture(f.reader, "initial", 1).length, 1);
    for (let i = 0; i < 1030; i++) {
        const handle = 0x8000 + i * 4;
        f.u32(handle, 0x2000);
        f.u32(0xa50, handle);
        capture.capture(f.reader, "another map", i + 2);
    }
    f.u32(0xa50, 0x200);
    assert.equal(
        capture.capture(f.reader, "original map", 2000, 0x220).length,
        0
    );
});

test("unattributed loader repeats deduplicate by validated allocation without conflating different handles", () => {
    const f = fixture();
    f.u32(0xa50, 0x204);
    const capture = new ResourceEventCapture();
    const loaded = {type: 0x53545220, id: -128, reference: 0x2026};
    assert.equal(
        capture.capture(f.reader, "loader", 1, 0x220, undefined, loaded).length,
        1
    );
    assert.equal(
        capture.capture(f.reader, "repeat", 2, 0x220, undefined, loaded).length,
        0
    );
    f.u32(0x202e, 0x224);
    f.block(0x224, 0x5000, new Uint8Array([1, 66]));
    assert.equal(
        capture.capture(
            f.reader,
            "another allocation",
            3,
            0x224,
            undefined,
            loaded
        ).length,
        1
    );
});
