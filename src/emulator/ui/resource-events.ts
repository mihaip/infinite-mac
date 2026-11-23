import {
    type ResourceEventsMessage,
    type ResourceLoadEvent,
} from "@/emulator/common/resource-events";

// Session history outlives the drawer. Only a new worker clears the captures.
export class EmulatorResourceEvents {
    append(message: ResourceEventsMessage) {
        const events = [...this.#snapshot.events, ...message.events];
        const start = Math.max(0, events.length - RESOURCE_EVENT_LIMIT);
        this.#snapshot = {
            events: start ? events.slice(start) : events,
            discardedCount: this.#snapshot.discardedCount + start,
            oversizedCount:
                this.#snapshot.oversizedCount + message.oversizedCount,
            unavailableCount:
                this.#snapshot.unavailableCount + message.unavailableCount,
        };
        this.#notify();
    }

    clear() {
        this.#snapshot = emptySnapshot();
        this.#notify();
    }

    getSnapshot = () => this.#snapshot;

    subscribe = (listener: () => void) => {
        this.#listeners.add(listener);
        return () => {
            this.#listeners.delete(listener);
        };
    };

    #snapshot = emptySnapshot();
    #listeners = new Set<() => void>();

    #notify() {
        for (const listener of this.#listeners) {
            listener();
        }
    }
}

const RESOURCE_EVENT_LIMIT = 10_000;

type ResourceEventsSnapshot = {
    events: readonly ResourceLoadEvent[];
    discardedCount: number;
    oversizedCount: number;
    unavailableCount: number;
};

function emptySnapshot(): ResourceEventsSnapshot {
    return {
        events: [],
        discardedCount: 0,
        oversizedCount: 0,
        unavailableCount: 0,
    };
}
