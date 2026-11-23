import {Drawer, DrawerContents} from "@/controls/Drawer";
import resourcesIcon from "@/Images/Resources.png";
import {useSyncExternalStore} from "react";
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
    return (
        <div
            className="MacResources"
            role="region"
            aria-label="Resource loads"
            tabIndex={0}
            onKeyDown={event => event.stopPropagation()}
            onKeyUp={event => event.stopPropagation()}>
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
            {snapshot.events.length === 0 ? (
                <p>Waiting for resource loads…</p>
            ) : (
                <ol className="MacResources-Events">
                    {[...snapshot.events].reverse().map(event => (
                        <ResourceEvent key={event.id} event={event} />
                    ))}
                </ol>
            )}
        </div>
    );
}

function ResourceEvent({event}: {event: ResourceLoadEvent}) {
    return (
        <li className="MacResources-Event">
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
                {event.file?.name ?? "Source unavailable"}
                {event.file?.volumeName && ` (${event.file.volumeName})`}
                {" · "}
                {event.data.byteLength.toLocaleString()} bytes
            </div>
            <pre>{hexSnippet(event.data)}</pre>
        </li>
    );
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
