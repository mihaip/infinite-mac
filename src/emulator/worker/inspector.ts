import {
    ResourceEventCapture,
    resourceCallName,
    type LoadedResource,
} from "./inspectors/resource-events";
import {
    type ResourceLoadEvent,
    type InspectorControl,
    type InspectorMessage,
    type InspectorWorkerConfig,
    readInspectorControl,
} from "../common/inspector";
import {GuestMemoryReader, ramMemory} from "./inspectors/memory";
import {HFSPathResolver, type ReadableDisk} from "./inspectors/hfs-paths";

export class EmulatorWorkerInspector {
    #events?: ResourceEventCapture;
    #pendingEvents: ResourceLoadEvent[] = [];
    #eventBytes = 0;
    #lastEventError?: string;
    #control: InspectorControl = {version: 1, subscriptions: []};
    #controlSequence = -1;
    #sequence = 0;
    #supported = false;
    #nextCapture = 0;
    #pathResolver?: HFSPathResolver;
    constructor(
        private config: InspectorWorkerConfig,
        private consumeFallback: () => InspectorControl | undefined,
        private send: (message: InspectorMessage) => void
    ) {}
    setDisks(disks: ReadableDisk[]) {
        this.#pathResolver = new HFSPathResolver(disks);
    }
    initialize(model: number | "BasiliskII") {
        this.#supported = model === "BasiliskII" || model > 0;
        this.send({
            type: "inspector_capabilities",
            version: 1,
            inspectors: this.#supported ? ["resources"] : [],
        });
    }
    active() {
        if (!this.#supported) return false;
        if (this.config.type === "shared-memory") {
            const update = readInspectorControl(
                this.config.control,
                this.#controlSequence
            );
            if (update) {
                this.#control = update.control;
                this.#controlSequence = update.sequence;
            }
        } else {
            const update = this.consumeFallback();
            if (update?.version === 1) this.#control = update;
        }
        const active = this.#control.subscriptions.includes("resources");
        return active && !this.#control.paused;
    }

    // Preserve transient files before CloseResFile removes their maps. The next
    // periodic capture publishes history; this hook does not update the UI.
    beforeResourceFileClose(ram: Uint8Array) {
        if (this.active()) this.capture(ram, false);
    }

    capture(ram: Uint8Array, publish = true) {
        if (!this.active()) return;
        this.captureEvents(ram, "Memory scan");
        this.flushEvents();
        if (!publish) return;
        try {
            const memory = inspectorMemory(ram);
            // The event catalog owns the captured resources. Publish only the
            // heartbeat/context here, not a second full snapshot and byte cache.
            this.send({
                type: "inspector_snapshot",
                version: 1,
                inspector: "resources",
                sequence: ++this.#sequence,
                snapshot: {
                    files: [],
                    capturedAt: Date.now(),
                    pointerBits: memory.pointerBits,
                    processName: memory.pstring(0x910, 31),
                    warning: this.#lastEventError,
                },
            });
        } catch (error) {
            this.send({
                type: "inspector_error",
                version: 1,
                inspector: "resources",
                error: String(error),
            });
        }
    }

    private captureEvents(
        ram: Uint8Array,
        source: string,
        handle?: number,
        pc?: number,
        loaded?: LoadedResource
    ) {
        if (!this.active()) return;
        try {
            this.#events ??= new ResourceEventCapture(this.#pathResolver);
            const events = this.#events.capture(
                inspectorMemory(ram),
                source,
                Date.now(),
                handle,
                pc,
                loaded
            );
            this.#pendingEvents.push(...events);
            this.#eventBytes += events.reduce(
                (n, event) =>
                    n +
                    event.detail.data.length +
                    (event.detail.mask?.length ?? 0),
                0
            );
            if (
                this.#eventBytes > 4 * 1024 * 1024 ||
                this.#pendingEvents.length >= 64
            )
                this.flushEvents();
            this.#lastEventError = undefined;
        } catch (error) {
            // A call can enter with a temporarily inconsistent map. Preserve
            // prior events and retry at the next boundary, without guest calls.
            const message = String(error);
            if (message !== this.#lastEventError)
                console.debug("Resource event scan:", source, message);
            this.#lastEventError = message;
        }
    }
    private flushEvents() {
        if (!this.#pendingEvents.length) return;
        this.send({
            type: "inspector_events",
            version: 1,
            events: this.#pendingEvents,
        });
        this.#pendingEvents = [];
        this.#eventBytes = 0;
    }
    callObserved(
        ram: Uint8Array,
        source: number,
        returning: boolean,
        handle = 0,
        reference = 0,
        type = 0,
        pc = 0
    ) {
        // The vector return is the earliest coherent observation of the final
        // bytes. A0/A2 must still describe the same Resource Manager reference.
        let loaded: LoadedResource | undefined;
        if (source === 0x7f0) {
            if (!returning || !this.active()) return;
            try {
                const memory = inspectorMemory(ram);
                reference = memory.normalize(reference);
                if (
                    !handle ||
                    !reference ||
                    memory.pointer(reference + 8) !== memory.normalize(handle)
                )
                    return;
                loaded = {type, reference, id: memory.i16(reference)};
            } catch {
                return;
            }
        }
        this.captureEvents(
            ram,
            `${resourceCallName(source)} ${returning ? "return" : "entry"}`,
            loaded ? handle : undefined,
            pc,
            loaded
        );
    }

    // Basilisk II calls after its existing resource-loader compatibility patch.
    // Match the validated handle to the map while file metadata still exists.
    resourceLoaded(
        ram: Uint8Array,
        type: number,
        id: number,
        handle: number,
        reference: number
    ) {
        if (!this.active()) return;
        try {
            const memory = inspectorMemory(ram);
            if (
                memory.pointer(memory.normalize(reference) + 8) !==
                    memory.normalize(handle) ||
                memory.i16(memory.normalize(reference)) !== id
            )
                return;
        } catch {
            return;
        }
        this.captureEvents(ram, "Resource loader", handle, undefined, {
            type,
            id,
            reference,
        });
    }

    // Basilisk II calls at an opcode boundary on its single emulation thread.
    // Subscription checks stay cheap; only active inspectors walk guest RAM.
    tick(ram: Uint8Array) {
        if (!this.active()) return;
        const now = Date.now();
        if (now < this.#nextCapture) return;
        this.#nextCapture = now + 500;
        this.capture(ram);
    }
}

function inspectorMemory(ram: Uint8Array) {
    const probe = new GuestMemoryReader(ramMemory(ram), 24);
    // Lo3Bytes remains a 24-bit mask on some 32-bit systems. MMU32Bit
    // distinguishes those systems; pre-System 7 heaps are 24-bit.
    const mask = probe.u32(0x31a);
    if (mask !== 0xffffff && mask !== 0xffffffff)
        throw new Error("Waiting for the Memory Manager");
    return new GuestMemoryReader(
        ramMemory(ram),
        mask === 0xffffffff ||
        (probe.u16(0x15a) >= 0x700 && probe.u8(0xcb2) === 1)
            ? 32
            : 24
    );
}
