import {
    type InspectorControl,
    type InspectorMessage,
    type InspectorWorkerConfig,
    readInspectorControl,
} from "../common/inspector";
import {GuestMemoryReader, ramMemory} from "./inspectors/memory";
import {ResourceInspector, ResourceLoadHints} from "./inspectors/resources";
import {HFSPathResolver, type ReadableDisk} from "./inspectors/hfs-paths";

export class EmulatorWorkerInspector {
    #control: InspectorControl = {version: 1, subscriptions: []};
    #controlSequence = -1;
    #sequence = 0;
    #supported = false;
    #resources?: ResourceInspector;
    #generation = 0;
    #lastError?: string;
    #nextCapture = 0;
    #loadHints?: ResourceLoadHints;
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
        const previousControl = this.#control;
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
        if (!active) {
            this.#resources = undefined;
            this.#lastError = undefined;
            this.#loadHints = undefined;
        }
        if (active && this.#control.paused) {
            this.#loadHints = undefined;
            if (this.#control !== previousControl) {
                const snapshot = this.#resources?.snapshot(
                    this.#control.resourceKey,
                    this.#control.previewKeys
                );
                if (snapshot)
                    this.send({
                        type: "inspector_snapshot",
                        version: 1,
                        inspector: "resources",
                        sequence: ++this.#sequence,
                        snapshot,
                        paused: true,
                    });
            }
            return false;
        }
        return active;
    }
    // Preserve transient files before CloseResFile removes their maps. The next
    // periodic capture publishes history; this hook does not update the UI.
    beforeResourceFileClose(ram: Uint8Array) {
        if (this.active()) this.capture(ram, false);
    }

    capture(ram: Uint8Array, publish = true) {
        const hints = this.#loadHints;
        this.#loadHints = undefined;
        try {
            const memory = inspectorMemory(ram);
            this.#resources ??= new ResourceInspector(
                ++this.#generation,
                this.#pathResolver
            );
            const snapshot = this.#resources.capture(
                memory,
                this.#control.resourceKey,
                Date.now(),
                this.#control.previewKeys,
                hints
            );
            if (publish)
                this.send({
                    type: "inspector_snapshot",
                    version: 1,
                    inspector: "resources",
                    sequence: ++this.#sequence,
                    snapshot,
                });
            this.#lastError = undefined;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            if (publish && message !== this.#lastError) {
                this.send({
                    type: "inspector_error",
                    version: 1,
                    inspector: "resources",
                    error: message,
                });
                this.#lastError = message;
            }
        }
    }

    // Called after Basilisk II's existing resource-loader patch. Copy only this
    // resource, without walking maps or publishing an extra UI snapshot.
    resourceLoaded(
        ram: Uint8Array,
        type: number,
        id: number,
        handle: number,
        reference: number
    ) {
        if (!this.active()) return;
        try {
            this.#loadHints ??= new ResourceLoadHints();
            this.#loadHints.record(
                inspectorMemory(ram),
                type,
                id,
                handle,
                reference,
                Date.now()
            );
        } catch {
            // A ROM resource or a transient/unsupported heap layout is only a
            // missed hint. Never let instrumentation interrupt guest execution.
        }
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
