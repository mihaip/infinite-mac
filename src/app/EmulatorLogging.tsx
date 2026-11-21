import {
    useCallback,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import {
    elementScroll,
    observeElementOffset,
    observeElementRect,
    useVirtualizer,
} from "@tanstack/react-virtual";
import {saveAs} from "file-saver";
import {Button} from "@/controls/Button";
import {Input} from "@/controls/Input";
import {Select} from "@/controls/Select";
import {Drawer, DrawerContents, DrawerHeader} from "@/controls/Drawer";
import {
    type EmulatorLog,
    type EmulatorLogMessage,
    createEmulatorLogSearchPredicate,
    parseEmulatorLogMessage,
} from "@/emulator/ui/log";
import noteIcon from "@/Images/Note.png";
import "@/app/EmulatorLogging.css";
import classNames from "classnames";

export function EmulatorLogging({
    log,
    setToastText,
}: {
    log: EmulatorLog;
    setToastText: ToastSetter;
}) {
    const [wrapLines, setWrapLines] = useState(true);
    const [search, setSearch] = useState("");
    const pauseableLog = useMemo(() => new EmulatorPauseableLog(log), [log]);
    return (
        <Drawer
            title="Debug Log"
            titleIconUrl={noteIcon}
            contents={() => (
                <DrawerContents>
                    <EmulatorLogOutput
                        log={pauseableLog}
                        search={search}
                        onSearchChange={setSearch}
                        wrapLines={wrapLines}
                        onWrapLinesChange={setWrapLines}
                        setToastText={setToastText}
                    />
                </DrawerContents>
            )}
        />
    );
}

type ToastSetter = (text: string, timeout?: number) => void;

function EmulatorLogOutput({
    log,
    search,
    onSearchChange,
    wrapLines,
    onWrapLinesChange,
    setToastText,
}: {
    log: EmulatorPauseableLog;
    search: string;
    onSearchChange: (value: string) => void;
    wrapLines: boolean;
    onWrapLinesChange: (wrapLines: boolean) => void;
    setToastText: ToastSetter;
}) {
    const rawMessages = useSyncExternalStore(log.subscribe, log.getSnapshot);
    const messages = useSearchFilter(rawMessages, search);
    const {virtualizer, scrollRef, handleWrapLinesChange} =
        useEmulatorLogVirtualizer({messages, wrapLines, onWrapLinesChange});
    // Start out scrolled to the bottom
    useLayoutEffect(() => {
        virtualizer.scrollToEnd();
    }, [log, search, virtualizer]);

    return (
        <div
            className="EmulatorLogging-Container"
            // Keep keyboard interaction with the controls and log out of the emulator.
            onKeyDown={e => e.stopPropagation()}
            onKeyUp={e => e.stopPropagation()}>
            <EmulatorLogHeader
                log={log}
                search={search}
                onSearchChange={onSearchChange}
                onWrapLinesChange={handleWrapLinesChange}
                wrapLines={wrapLines}
                setToastText={setToastText}
            />
            <div
                className={classNames("EmulatorLogging", {
                    "WrapLines": wrapLines,
                })}
                ref={scrollRef}
                role="region"
                aria-label="Emulator debug log"
                tabIndex={0}>
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
                        {rawMessages.length
                            ? "No log messages match your search."
                            : log.isPaused()
                              ? "Log updates paused."
                              : "Waiting for log output…"}
                    </pre>
                )}
            </div>
        </div>
    );
}

function EmulatorLogHeader({
    log,
    search,
    onSearchChange,
    wrapLines,
    onWrapLinesChange,
    setToastText,
}: {
    log: EmulatorPauseableLog;
    search: string;
    onSearchChange: (value: string) => void;
    wrapLines: boolean;
    onWrapLinesChange: (value: boolean) => void;
    setToastText: ToastSetter;
}) {
    const getText = () =>
        log
            .getSnapshot()
            .map(message => message.message)
            .join("\n");

    const handlePauseResume = () => {
        log.setPaused(!log.isPaused());
    };
    const handleClear = () => {
        log.clear();
        setToastText("Log cleared.");
    };
    const handleDownload = () => {
        const blob = new Blob([getText()], {type: "text/plain;charset=utf-8"});
        saveAs(
            blob,
            `infinite-mac-debug-log-${new Date().toISOString().replaceAll(":", "-")}.txt`
        );
        setToastText("Log downloaded.");
    };
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(getText());
            setToastText("Log copied.");
        } catch (error) {
            console.warn("Could not copy emulator log", error);
            setToastText("Could not copy log.");
        }
    };
    const handleMoreAction = (action: string) => {
        switch (action) {
            case "download":
                handleDownload();
                break;
            case "copy":
                void handleCopy();
                break;
            case "wrap":
                onWrapLinesChange(!wrapLines);
                break;
        }
    };

    return (
        <DrawerHeader>
            <Input
                type="search"
                className="EmulatorLogging-Search"
                aria-label="Filter log"
                placeholder="Filter log…"
                title={
                    'Combine words, "quoted phrases", level:WARN, and file:ppcmmu.cpp.'
                }
                spellCheck={false}
                value={search}
                onChange={e => onSearchChange(e.currentTarget.value)}
            />
            <div className="EmulatorLogging-Controls">
                <Button onClick={handlePauseResume}>
                    {log.isPaused() ? "Resume" : "Pause"}
                </Button>
                <Button onClick={handleClear}>Clear</Button>
                <Select
                    className="EmulatorLogging-MoreActions"
                    aria-label="More log actions"
                    noLabel
                    value=""
                    onChange={e => handleMoreAction(e.currentTarget.value)}>
                    <option value="" disabled hidden />
                    <option value="download">Download Log</option>
                    <option value="copy">Copy Log</option>
                    <option value="separator" disabled />
                    <option value="wrap">
                        {wrapLines ? "✓ Wrap Lines" : "Wrap Lines"}
                    </option>
                </Select>
            </div>
        </DrawerHeader>
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

function useEmulatorLogVirtualizer({
    messages,
    wrapLines,
    onWrapLinesChange,
}: {
    messages: readonly EmulatorLogMessage[];
    wrapLines: boolean;
    onWrapLinesChange: (value: boolean) => void;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const reportScrollOffset =
        useRef<(offset: number, isScrolling: boolean) => void>();
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
        // Following new messages can scroll past the rendered rows before the
        // browser sends a scroll event, briefly showing a blank log. Report
        // non-smooth scroll changes ourselves, after React finishes its current
        // update but before the browser draws the next frame. This lets
        // TanStack render the rows at the new position in time.
        observeElementOffset(instance, onOffset) {
            reportScrollOffset.current = onOffset;
            const unsubscribe = observeElementOffset(instance, onOffset);
            return () => {
                reportScrollOffset.current = undefined;
                unsubscribe?.();
            };
        },
        scrollToFn(offset, options, instance) {
            const previousOffset = instance.scrollElement?.scrollTop;
            elementScroll(offset, options, instance);
            if (
                options.behavior !== "smooth" &&
                instance.scrollElement &&
                instance.scrollElement.scrollTop !== previousOffset
            ) {
                queueMicrotask(() => {
                    if (instance.scrollElement) {
                        reportScrollOffset.current?.(
                            instance.scrollElement.scrollTop,
                            true
                        );
                    }
                });
            }
        },
        // Keep following when a viewport resize reduces its height.
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

    // Preserve logical scroll position when toggling wrapped lines.
    const wrapScrollAnchor = useRef<{atEnd: boolean; index: number}>();

    useLayoutEffect(() => {
        const anchor = wrapScrollAnchor.current;
        if (!anchor) {
            return;
        }
        wrapScrollAnchor.current = undefined;
        virtualizer.measure();
        // Explicit multiline rows may keep the same height, so ResizeObserver
        // won't remeasure them after the cache is cleared.
        scrollRef.current
            ?.querySelectorAll<HTMLDivElement>(".EmulatorLogging-Row")
            .forEach(element => virtualizer.measureElement(element));
        if (anchor.atEnd) {
            virtualizer.scrollToEnd();
        } else {
            virtualizer.scrollToIndex(anchor.index, {align: "start"});
        }
    }, [virtualizer, scrollRef, wrapLines]);

    const handleWrapLinesChange = useCallback(
        (value: boolean) => {
            wrapScrollAnchor.current = {
                atEnd: virtualizer.isAtEnd(),
                index:
                    virtualizer.getVirtualItemForOffset(
                        virtualizer.scrollOffset ?? 0
                    )?.index ?? 0,
            };
            onWrapLinesChange(value);
        },
        [virtualizer, onWrapLinesChange]
    );

    return {virtualizer, scrollRef, handleWrapLinesChange};
}

const logTimeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hourCycle: "h23",
});

class EmulatorPauseableLog {
    constructor(log: EmulatorLog) {
        this.#log = log;
    }

    #log: EmulatorLog;
    #pausedSnapshot: readonly EmulatorLogMessage[] | undefined;

    getSnapshot = () => {
        return this.#pausedSnapshot ?? this.#log.getSnapshot();
    };

    subscribe = (listener: () => void) => {
        this.#listeners.add(listener);
        this.#updateUpstreamSubscription();
        return () => {
            this.#listeners.delete(listener);
            this.#updateUpstreamSubscription();
        };
    };

    wraps(log: EmulatorLog): boolean {
        return this.#log === log;
    }

    clear(): void {
        // Recapture the paused snapshot with the new cleared state.
        if (this.#pausedSnapshot) {
            this.#pausedSnapshot = [];
        }
        this.#log.clear();
        this.#notifyListeners();
    }

    setPaused(paused: boolean): void {
        if (paused === this.isPaused()) {
            return;
        }
        this.#pausedSnapshot = paused
            ? Array.from(this.#log.getSnapshot())
            : undefined;
        this.#updateUpstreamSubscription();
        this.#notifyListeners();
    }

    isPaused(): boolean {
        return this.#pausedSnapshot !== undefined;
    }

    #listeners = new Set<() => void>();

    #notifyListeners(): void {
        this.#cancelNotificationFrame();
        for (const listener of this.#listeners) {
            listener();
        }
    }

    #cancelNotificationFrame(): void {
        if (this.#notificationFrame !== undefined) {
            cancelAnimationFrame(this.#notificationFrame);
            this.#notificationFrame = undefined;
        }
    }

    #removeUpstreamSubscription: (() => void) | undefined;
    #notificationFrame: number | undefined;

    #updateUpstreamSubscription(): void {
        const needsUpstreamSubscription =
            this.#listeners.size > 0 && !this.isPaused();
        if (!needsUpstreamSubscription) {
            this.#cancelNotificationFrame();
        }
        if (!needsUpstreamSubscription && this.#removeUpstreamSubscription) {
            this.#removeUpstreamSubscription();
            this.#removeUpstreamSubscription = undefined;
        } else if (
            !this.#removeUpstreamSubscription &&
            needsUpstreamSubscription
        ) {
            this.#removeUpstreamSubscription = this.#log.subscribe(() => {
                // Keep collecting every message, but render at most once per
                // frame instead of once per worker postMessage.
                this.#notificationFrame ??= requestAnimationFrame(() => {
                    this.#notificationFrame = undefined;
                    this.#notifyListeners();
                });
            });
        }
    }
}

function useSearchFilter(
    rawMessages: readonly EmulatorLogMessage[],
    search: string
): readonly EmulatorLogMessage[] {
    const searchPredicate = useMemo(
        () =>
            search.trim()
                ? createEmulatorLogSearchPredicate(search)
                : undefined,
        [search]
    );
    const messages = useMemo(
        () =>
            searchPredicate ? rawMessages.filter(searchPredicate) : rawMessages,
        [rawMessages, searchPredicate]
    );
    return messages;
}
