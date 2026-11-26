import {Drawer, DrawerContents, DrawerHeader} from "@/controls/Drawer";
import {Input} from "@/controls/Input";
import resourcesIcon from "@/Images/Resources.png";
import {
    useCallback,
    useLayoutEffect,
    useState,
    useSyncExternalStore,
} from "react";
import {useVirtualizedList} from "@/lib/useVirtualizedList";
import {useSearchFilter} from "@/lib/search";
import {
    type EmulatorResourceEvents,
    createResourceEventSearchPredicate,
    formatResourceEventSource,
} from "@/emulator/ui/resource-events";
import {type ResourceLoadEvent} from "@/emulator/common/resource-events";
import "@/app/MacResources.css";

export function MacResources({events}: {events: EmulatorResourceEvents}) {
    const [search, setSearch] = useState("");
    return (
        <Drawer
            title="Resources"
            titleIconUrl={resourcesIcon}
            contents={() => (
                <DrawerContents>
                    <ResourceEvents
                        events={events}
                        search={search}
                        onSearchChange={setSearch}
                    />
                </DrawerContents>
            )}
        />
    );
}

function ResourceEvents({
    events,
    search,
    onSearchChange,
}: {
    events: EmulatorResourceEvents;
    search: string;
    onSearchChange: (value: string) => void;
}) {
    const snapshot = useSyncExternalStore(events.subscribe, events.getSnapshot);
    const resourceEvents = useSearchFilter(
        snapshot.events,
        search,
        createResourceEventSearchPredicate
    );
    const {virtualizer, scrollRef} =
        useResourceEventsVirtualizer(resourceEvents);
    useLayoutEffect(() => {
        virtualizer.scrollToEnd();
    }, [events, search, virtualizer]);
    return (
        <div
            className="MacResources-Container"
            onKeyDown={event => event.stopPropagation()}
            onKeyUp={event => event.stopPropagation()}>
            <ResourceEventsHeader
                snapshot={snapshot}
                search={search}
                onSearchChange={onSearchChange}
                filteredCount={resourceEvents.length}
            />
            <div
                className="MacResources"
                ref={scrollRef}
                role="region"
                aria-label="Resource loads"
                tabIndex={0}>
                {resourceEvents.length === 0 ? (
                    <p>
                        {snapshot.events.length
                            ? "No resource loads match your search."
                            : "Waiting for resource loads…"}
                    </p>
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
    search,
    onSearchChange,
    filteredCount,
}: {
    snapshot: ReturnType<EmulatorResourceEvents["getSnapshot"]>;
    search: string;
    onSearchChange: (value: string) => void;
    filteredCount: number;
}) {
    return (
        <DrawerHeader>
            <Input
                type="search"
                className="MacResources-Search"
                aria-label="Filter resources"
                placeholder="Filter resources…"
                title={
                    'Combine words, "quoted phrases", type:ICON, id:128, name:"About", file:Finder, and app:TeachText.'
                }
                spellCheck={false}
                value={search}
                onChange={event => onSearchChange(event.currentTarget.value)}
            />
            <div className="MacResources-Status">
                <div>
                    {search.trim() && `${filteredCount.toLocaleString()} of `}
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
                {formatResourceEventSource(event)}
                {" · "}
                {event.data.byteLength.toLocaleString()} bytes
            </div>
            {event.processName && <div>Loaded by {event.processName}</div>}
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
