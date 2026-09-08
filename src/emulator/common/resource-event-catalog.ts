import {
    type ResourceLoadEvent,
    type ResourceSnapshot,
    type ResourceFile,
} from "./inspector";

// A browser of the event history. Each resource points to its first immutable
// event, so selecting an old file never asks the guest to read memory again.
export function resourceEventCatalog(
    events: ResourceLoadEvent[],
    selectedKey?: string
): ResourceSnapshot | undefined {
    const latest = events.at(-1);
    if (!latest) return undefined;
    const files = new Map<string, ResourceFile>();
    const details = new Map<string, ResourceLoadEvent["detail"]>();
    for (const event of events) {
        let file = files.get(event.file.key);
        if (!file) {
            file = {...event.file, recent: false, current: false, types: []};
            files.set(file.key, file);
        }
        file.lastSeen = event.capturedAt;
        let type = file.types.find(t => t.type === event.type);
        if (!type) file.types.push((type = {type: event.type, resources: []}));
        const key = `${file.key}/${event.type}:${event.resource.id}`;
        const resource = {
            ...event.resource,
            key,
            cached: true,
            resident: false,
        };
        const index = type.resources.findIndex(r => r.id === resource.id);
        if (index < 0) type.resources.push(resource);
        else type.resources[index] = resource;
        details.set(key, {...event.detail, key});
    }
    return {
        files: [...files.values()],
        processName: latest.processName,
        capturedAt: latest.capturedAt,
        pointerBits: latest.pointerBits,
        detail: selectedKey ? details.get(selectedKey) : undefined,
        previews: [...details.values()],
    };
}
