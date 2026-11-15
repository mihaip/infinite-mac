import {
    useCallback,
    useLayoutEffect,
    useMemo,
    useRef,
    useSyncExternalStore,
} from "react";
import {observeElementRect, useVirtualizer} from "@tanstack/react-virtual";
import {Drawer, DrawerContents, DrawersContainer} from "@/controls/Drawer";
import {
    type EmulatorLog,
    type EmulatorLogMessage,
    parseEmulatorLogMessage,
} from "@/emulator/ui/log";
import noteIcon from "@/Images/Note.png";
import "@/app/EmulatorLogging.css";

export function EmulatorLogging({log}: {log: EmulatorLog}) {
    return (
        <DrawersContainer placement="right">
            <Drawer
                title="Debug Log"
                titleIconUrl={noteIcon}
                contents={() => (
                    <DrawerContents>
                        <EmulatorLogOutput log={log} />
                    </DrawerContents>
                )}
            />
        </DrawersContainer>
    );
}

function EmulatorLogOutput({log}: {log: EmulatorLog}) {
    const messages = useSyncExternalStore(log.subscribe, log.getSnapshot);
    const scrollRef = useRef<HTMLDivElement>(null);
    // TanStack Virtual exposes mutable state through the virtualizer instance.
    // oxlint-disable-next-line react/incompatible-library
    const virtualizer = useVirtualizer({
        count: messages.length,
        getScrollElement: () => scrollRef.current,
        getItemKey: useCallback(index => messages[index].id, [messages]),
        estimateSize: () => 18,
        overscan: 10,
        anchorTo: "end",
        followOnAppend: true,
        scrollEndThreshold: 8,
        observeElementRect(instance, onRect) {
            return observeElementRect(instance, rect => {
                const previousHeight = instance.scrollRect?.height;
                // isAtEnd() reads the already-resized DOM clientHeight, so use
                // the cached previous height to check whether we were at the end.
                const wasAtEnd =
                    instance.getTotalSize() -
                        (previousHeight ?? 0) -
                        (instance.scrollOffset ?? 0) <=
                    instance.options.scrollEndThreshold;
                onRect(rect);
                // Keep following when a viewport resize reduces its height.
                if (
                    previousHeight !== undefined &&
                    previousHeight !== rect.height &&
                    wasAtEnd
                ) {
                    instance.scrollToEnd();
                }
            });
        },
    });

    useLayoutEffect(() => {
        virtualizer.scrollToEnd();
    }, [log, virtualizer]);

    return (
        <div
            className="EmulatorLogging"
            ref={scrollRef}
            role="region"
            aria-label="Emulator debug log"
            // Capture key events so that arrow keys, etc. can be used to scroll
            // when we're focused.
            tabIndex={0}
            onKeyDown={e => e.stopPropagation()}
            onKeyUp={e => e.stopPropagation()}>
            {messages.length ? (
                <div
                    className="EmulatorLogging-List"
                    style={{height: virtualizer.getTotalSize()}}>
                    {virtualizer.getVirtualItems().map(item => (
                        <div
                            className="EmulatorLogging-Row"
                            key={item.key}
                            ref={virtualizer.measureElement}
                            data-index={item.index}
                            style={{top: item.start}}>
                            <EmulatorLogMessageView
                                message={messages[item.index]}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <pre className="EmulatorLogging-Waiting">
                    Waiting for log output…
                </pre>
            )}
        </div>
    );
}

function EmulatorLogMessageView({message}: {message: EmulatorLogMessage}) {
    const {parsed, timestamp, formattedTimestamp} = useMemo(() => {
        const parsed = parseEmulatorLogMessage(message);
        const timestamp = new Date(parsed.timestamp);
        const formattedTimestamp = logTimeFormatter.format(timestamp);
        return {parsed, timestamp, formattedTimestamp};
    }, [message]);

    return (
        <pre className="EmulatorLogMessage" data-level={parsed.level}>
            <time
                className="EmulatorLogMessage-Timestamp"
                dateTime={timestamp.toISOString()}
                title={timestamp.toString()}>
                {formattedTimestamp}
            </time>
            <span className="EmulatorLogMessage-Content">
                {parsed.level && (
                    <>
                        <span className="EmulatorLogMessage-Level">
                            {parsed.level}
                        </span>{" "}
                    </>
                )}
                {parsed.source && (
                    <>
                        <span className="EmulatorLogMessage-Source">
                            {parsed.source}
                            {parsed.sourceLine !== undefined &&
                                `:${parsed.sourceLine}`}
                        </span>{" "}
                    </>
                )}
                <span className="EmulatorLogMessage-Text">
                    {parsed.message}
                </span>
            </span>
        </pre>
    );
}

const logTimeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hourCycle: "h23",
});
