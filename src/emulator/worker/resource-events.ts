import {
    type ResourceLoadEvent,
    type ResourceEventsMessage,
} from "@/emulator/common/resource-events";
import {
    MacMemoryReader,
    type MacMemoryRegion,
} from "@/emulator/common/toolbox/memory";
import {readResourceMetadata} from "@/emulator/common/toolbox/resources";

export class EmulatorWorkerResourceEvents {
    constructor(private send: (message: ResourceEventsMessage) => void) {}

    /**
     * Called synchronously by the emulator core after the resource loader and
     * compatibility patches.
     *
     * @param regions The RAM and ROM regions
     * @param handle The handle to the resource data.
     * @param referenceEntryAddress The guest address of the resource's
     * ReferenceEntry in its resource map.
     */
    resourceLoaded(
        regions: readonly MacMemoryRegion[],
        handle: number,
        referenceEntryAddress: number
    ) {
        try {
            this.#resourceLoadedImpl(regions, handle, referenceEntryAddress);
        } catch (error) {
            this.#unavailableCount++;
            console.warn(
                "Could not capture resource",
                {handle, referenceEntryAddress},
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
     * Some resources can load repeatedly (e.g. MBDF ID 0 while tracking menus).
     * Quickly reject consecutive loads with the same parameters, but only
     * the last few to avoid collisions if handles and reference entries are
     * reused.
     */
    #recentLoadKeys = new Set<string>();
    /**
     * More precise already-loaded map that takes into account resource ID/type.
     */
    #reportedResources = new Set<string>();

    #resourceLoadedImpl(
        regions: readonly MacMemoryRegion[],
        handle: number,
        referenceEntryAddress: number
    ) {
        const loadKey = `${handle}:${referenceEntryAddress}`;
        if (this.#recentLoadKeys.has(loadKey)) {
            return;
        }
        this.#recentLoadKeys.add(loadKey);
        if (this.#recentLoadKeys.size > 5) {
            this.#recentLoadKeys.delete(
                this.#recentLoadKeys.values().next().value!
            );
        }

        const memory = MacMemoryReader.fromRegions(regions);
        const metadata = readResourceMetadata(memory, referenceEntryAddress);
        if (!metadata) {
            throw new Error("Resource type is unavailable");
        }
        const {mapHandle, id: resourceId, ...eventMetadata} = metadata;
        // Handles and reference entries can move without changing the resource.
        const resourceKey = `${mapHandle}:${metadata.type}:${metadata.id}`;
        if (this.#reportedResources.has(resourceKey)) {
            return;
        }

        const block = memory.handle(handle);
        if (!block) {
            throw new Error("Resource is not resident");
        }
        if (block.size > RESOURCE_PAYLOAD_BYTE_LIMIT) {
            this.#oversizedCount++;
            return;
        }
        const event: ResourceLoadEvent = {
            id: this.#idCounter++,
            timestamp: Date.now(),
            resourceId,
            ...eventMetadata,
            isRom: block.isRom,
            data: memory.bytes(block.address, block.size).slice(),
        };

        this.#pending.push(event);
        this.#pendingBytes += event.data.byteLength;
        if (
            this.#pending.length >= RESOURCE_BATCH_EVENT_LIMIT ||
            this.#pendingBytes >= RESOURCE_BATCH_BYTE_LIMIT
        ) {
            this.flush();
        }

        this.#reportedResources.add(resourceKey);
        if (this.#reportedResources.size > REPORTED_RESOURCE_LIMIT) {
            this.#reportedResources.delete(
                this.#reportedResources.values().next().value!
            );
        }
    }
}

const RESOURCE_PAYLOAD_BYTE_LIMIT = 64 * 1024 * 1024;
const REPORTED_RESOURCE_LIMIT = 32_768;
const RESOURCE_BATCH_EVENT_LIMIT = 64;
const RESOURCE_BATCH_BYTE_LIMIT = 4 * 1024 * 1024;
const RESOURCE_FLUSH_INTERVAL_MS = 500;
