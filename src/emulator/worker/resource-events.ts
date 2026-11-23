import {
    type ResourceLoadEvent,
    type ResourceEventsMessage,
} from "@/emulator/common/resource-events";
import {MacMemoryReader} from "@/emulator/common/toolbox/memory";
import {fourCCToString} from "@/emulator/common/toolbox/fourcc";
import {
    readResourceReferenceEntry,
    readResourceMetadata,
} from "@/emulator/common/toolbox/resources";

export class EmulatorWorkerResourceEvents {
    constructor(private send: (message: ResourceEventsMessage) => void) {}

    /**
     * Called synchronously by the emulator core after the resource loader and
     * compatibility patches.
     *
     * @param ram The current state of the emulator's RAM.
     * @param type The resource type/FourCC.
     * @param id The resource ID.
     * @param handle The handle to the resource data.
     * @param referenceEntryAddress The guest address of the resource's
     * ReferenceEntry in its resource map.
     */
    resourceLoaded(
        ram: Uint8Array,
        type: number,
        id: number,
        handle: number,
        referenceEntryAddress: number
    ) {
        try {
            this.#resourceLoadedImpl(
                ram,
                type,
                id,
                handle,
                referenceEntryAddress
            );
        } catch (error) {
            this.#unavailableCount++;
            console.warn(
                "Could not capture resource",
                {type: fourCCToString(type), id, handle, referenceEntryAddress},
                error
            );
        }
    }

    tick() {
        if (Date.now() - this.#lastFlush >= RESOURCE_FLUSH_INTERVAL_MS) {
            this.flush();
        }
    }

    flush() {
        this.#lastFlush = Date.now();
        if (
            !this.#pending.length &&
            !this.#oversizedCount &&
            !this.#unavailableCount
        ) {
            return;
        }
        this.send({
            type: "emulator_resource_events",
            events: this.#pending,
            oversizedCount: this.#oversizedCount,
            unavailableCount: this.#unavailableCount,
        });
        this.#pending = [];
        this.#pendingBytes = 0;
        this.#oversizedCount = 0;
        this.#unavailableCount = 0;
    }

    #idCounter = 0;
    #oversizedCount = 0;
    #unavailableCount = 0;

    #pending: ResourceLoadEvent[] = [];
    #pendingBytes = 0;
    #lastFlush = Date.now();

    /**
     * Some resources are loaded very frequently (e.g., MBDF ID 0 while opening
     * menus), so we track which ones have already been reported to avoid
     * duplicates.
     */
    #reported = new Set<string>();

    #resourceLoadedImpl(
        ram: Uint8Array,
        type: number,
        id: number,
        handle: number,
        referenceEntryAddress: number
    ) {
        const key = `${type}:${id}:${handle}:${referenceEntryAddress}`;
        if (this.#reported.has(key)) {
            return;
        }
        const memory = new MacMemoryReader(ram);
        const referenceEntry = readResourceReferenceEntry(
            memory,
            referenceEntryAddress
        );
        if (
            referenceEntry.handle !== memory.normalize(handle) ||
            referenceEntry.id !== id
        ) {
            throw new Error("Resource reference does not match loader");
        }
        const block = memory.handle(handle);
        if (!block) {
            throw new Error("Resource is not resident");
        }
        if (block.size > RESOURCE_EVENT_BYTES) {
            this.#oversizedCount++;
            return;
        }
        const event: ResourceLoadEvent = {
            id: this.#idCounter++,
            timestamp: Date.now(),
            type: fourCCToString(type),
            resourceId: id,
            data: memory.bytes(block.address, block.size).slice(),
        };
        // A transient or malformed map must not discard a valid payload.
        try {
            Object.assign(
                event,
                readResourceMetadata(memory, referenceEntry, event.type)
            );
        } catch (error) {
            // Source metadata is best effort.
            console.warn(
                "Could not read resource metadata",
                {type: event.type, id, referenceEntryAddress},
                error
            );
        }

        this.#pending.push(event);
        this.#pendingBytes += event.data.byteLength;
        if (
            this.#pending.length >= RESOURCE_BATCH_EVENT_LIMIT ||
            this.#pendingBytes >= RESOURCE_BATCH_BYTE_LIMIT
        ) {
            this.flush();
        }

        this.#reported.add(key);
        if (this.#reported.size > REPORTED_RESOURCE_LIMIT) {
            this.#reported.delete(this.#reported.keys().next().value!);
        }
    }
}

const RESOURCE_EVENT_BYTES = 64 * 1024 * 1024;
const REPORTED_RESOURCE_LIMIT = 32_768;
const RESOURCE_BATCH_EVENT_LIMIT = 64;
const RESOURCE_BATCH_BYTE_LIMIT = 4 * 1024 * 1024;
const RESOURCE_FLUSH_INTERVAL_MS = 500;
