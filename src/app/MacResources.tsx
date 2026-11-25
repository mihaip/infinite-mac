import {Drawer, DrawerContents, DrawerHeader} from "@/controls/Drawer";
import resourcesIcon from "@/Images/Resources.png";
import {useCallback, useLayoutEffect, useSyncExternalStore} from "react";
import {useVirtualizedList} from "@/lib/useVirtualizedList";
import {type EmulatorResourceEvents} from "@/emulator/ui/resource-events";
import {type ResourceLoadEvent} from "@/emulator/common/resource-events";
import "@/app/MacResources.css";

export function MacResources({events}: {events: EmulatorResourceEvents}) {
    return (
        <Drawer
            title="Resources"
            titleIconUrl={resourcesIcon}
            contents={() => (
                <DrawerContents>
                    <ResourceEvents events={events} />
                </DrawerContents>
            )}
        />
    );
}

function ResourceEvents({events}: {events: EmulatorResourceEvents}) {
    const snapshot = useSyncExternalStore(events.subscribe, events.getSnapshot);
    const resourceEvents = snapshot.events;
    const {virtualizer, scrollRef} =
        useResourceEventsVirtualizer(resourceEvents);
    useLayoutEffect(() => {
        virtualizer.scrollToEnd();
    }, [events, virtualizer]);
    return (
        <div
            className="MacResources-Container"
            onKeyDown={event => event.stopPropagation()}
            onKeyUp={event => event.stopPropagation()}>
            <ResourceEventsHeader snapshot={snapshot} />
            <div
                className="MacResources"
                ref={scrollRef}
                role="region"
                aria-label="Resource loads"
                tabIndex={0}>
                {resourceEvents.length === 0 ? (
                    <p>Waiting for resource loads…</p>
                ) : (
                    <ol
                        className="MacResources-Events"
                        style={{height: virtualizer.getTotalSize()}}>
                        {virtualizer.getVirtualItems().map(item => (
                            <li
                                className="MacResources-Row"
                                key={item.key}
                                ref={virtualizer.measureElement}
                                data-index={item.index}
                                aria-posinset={item.index + 1}
                                aria-setsize={resourceEvents.length}
                                style={{top: item.start}}>
                                <ResourceEvent
                                    event={resourceEvents[item.index]}
                                />
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </div>
    );
}

function ResourceEventsHeader({
    snapshot,
}: {
    snapshot: ReturnType<EmulatorResourceEvents["getSnapshot"]>;
}) {
    return (
        <DrawerHeader>
            <div className="MacResources-Status">
                <div>
                    {snapshot.events.length.toLocaleString()} resource{" "}
                    {snapshot.events.length === 1 ? "load" : "loads"}
                </div>
                {snapshot.discardedCount > 0 && (
                    <p>
                        {snapshot.discardedCount.toLocaleString()} older events
                        discarded.
                    </p>
                )}
                {snapshot.oversizedCount > 0 && (
                    <p>
                        {snapshot.oversizedCount.toLocaleString()} resources
                        exceeded the size capture limit.
                    </p>
                )}
                {snapshot.unavailableCount > 0 && (
                    <p>
                        {snapshot.unavailableCount.toLocaleString()} resource
                        payloads were unavailable.
                    </p>
                )}
            </div>
        </DrawerHeader>
    );
}

function ResourceEvent({event}: {event: ResourceLoadEvent}) {
    let source;
    if (event.isRom) {
        source = "ROM";
    } else {
        source = event.file?.name ?? "Source unavailable";
        if (event.file?.volumeName) {
            source += ` (${event.file.volumeName})`;
        }
    }
    return (
        <div className="MacResources-Event">
            <div className="MacResources-EventHeader">
                <strong>
                    {event.type} {event.resourceId}
                </strong>
                {event.name && <span>{event.name}</span>}
                <time dateTime={new Date(event.timestamp).toISOString()}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                </time>
            </div>
            <div>
                {source}
                {" · "}
                {event.data.byteLength.toLocaleString()} bytes
            </div>
            <pre>{hexSnippet(event.data)}</pre>
        </div>
    );
}

function useResourceEventsVirtualizer(events: readonly ResourceLoadEvent[]) {
    return useVirtualizedList({
        count: events.length,
        getItemKey: useCallback(index => events[index].id, [events]),
        estimateSize: () => 140,
        overscan: 5,
    });
}

const HEX_SNIPPET_BYTES = 64;
const HEX_BYTES_PER_LINE = 16;

function hexSnippet(data: Uint8Array): string {
    const lines: string[] = [];
    const length = Math.min(data.byteLength, HEX_SNIPPET_BYTES);
    for (let offset = 0; offset < length; offset += HEX_BYTES_PER_LINE) {
        const bytes = data.subarray(
            offset,
            Math.min(offset + HEX_BYTES_PER_LINE, length)
        );
        lines.push(
            Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join(
                " "
            )
        );
    }
    if (data.byteLength > length) {
        lines.push("…");
    }
    return lines.join("\n");
}
