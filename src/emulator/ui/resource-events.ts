import {
    type ResourceEventsMessage,
    type ResourceLoadEvent,
} from "@/emulator/common/resource-events";
import {parseSearchQuery} from "@/lib/search";

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

export function createResourceEventSearchPredicate(
    query: string
): (event: ResourceLoadEvent) => boolean {
    const terms = parseSearchQuery(query);
    // Captured events are immutable. Reuse matches as new events are appended.
    const results = new WeakMap<ResourceLoadEvent, boolean>();
    return event => {
        const cached = results.get(event);
        if (cached !== undefined) {
            return cached;
        }
        let text: string | undefined;
        let source: string | undefined;
        const matches = terms.every(term => {
            switch (term.operator) {
                case undefined:
                    text ??= [
                        `${event.type.trimEnd()} ${event.resourceId}`,
                        event.name,
                        formatResourceEventSource(event),
                        event.processName,
                    ]
                        .join("\n")
                        .toLowerCase();
                    return text.includes(term.value);
                case "type":
                    return (
                        event.type.toLowerCase().trimEnd() ===
                        term.value.trimEnd()
                    );
                case "id":
                    return String(event.resourceId) === term.value;
                case "name":
                    return (
                        event.name?.toLowerCase().includes(term.value) ?? false
                    );
                case "file":
                    source ??= formatResourceEventSource(event).toLowerCase();
                    return source.includes(term.value);
                case "app":
                case "program":
                    return (
                        event.processName?.toLowerCase().includes(term.value) ??
                        false
                    );
                default:
                    return false;
            }
        });
        results.set(event, matches);
        return matches;
    };
}

export function formatResourceEventSource(event: ResourceLoadEvent): string {
    if (event.isRom) {
        return "ROM";
    }
    let source = event.file?.path ?? event.file?.name ?? "Source unavailable";
    if (!event.file?.path && event.file?.volume?.name) {
        source += ` (${event.file.volume.name})`;
    }
    return source;
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
