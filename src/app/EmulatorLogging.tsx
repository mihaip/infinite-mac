import {
    useCallback,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import {
    observeElementRect,
    type ReactVirtualizer,
    useVirtualizer,
} from "@tanstack/react-virtual";
import {saveAs} from "file-saver";
import {Button} from "@/controls/Button";
import {Select} from "@/controls/Select";
import {
    Drawer,
    DrawerContents,
    DrawerHeader,
    DrawersContainer,
} from "@/controls/Drawer";
import {
    type EmulatorLog,
    type EmulatorLogMessage,
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
    const pauseableLog = useMemo(() => new EmulatorPauseableLog(log), [log]);
    return (
        <DrawersContainer placement="right">
            <Drawer
                title="Debug Log"
                titleIconUrl={noteIcon}
                contents={() => (
                    <DrawerContents>
                        <EmulatorLogOutput
                            log={pauseableLog}
                            wrapLines={wrapLines}
                            onWrapLinesChange={setWrapLines}
                            setToastText={setToastText}
                        />
                    </DrawerContents>
                )}
            />
        </DrawersContainer>
    );
}
type ToastSetter = (text: string, timeout?: number) => void;

function EmulatorLogOutput({
    log,
    wrapLines,
    onWrapLinesChange,
    setToastText,
}: {
    log: EmulatorPauseableLog;
    wrapLines: boolean;
    onWrapLinesChange: (wrapLines: boolean) => void;
    setToastText: ToastSetter;
}) {
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

    const handleWrapLinesChange = useWrapLines({
        virtualizer,
        scrollRef,
        onWrapLinesChange,
    });

    return (
        <div
            className="EmulatorLogging-Container"
            // Keep keyboard interaction with the controls and log out of the emulator.
            onKeyDown={e => e.stopPropagation()}
            onKeyUp={e => e.stopPropagation()}>
            <EmulatorLogHeader
                log={log}
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
                        {log.isPaused()
                            ? "Log updates paused."
                            : "Waiting for log output…"}
                    </pre>
                )}
            </div>
        </div>
    );
}

function useWrapLines({
    virtualizer,
    scrollRef,
    onWrapLinesChange,
}: {
    virtualizer: ReactVirtualizer<HTMLDivElement, Element>;
    scrollRef: React.RefObject<HTMLDivElement>;
    onWrapLinesChange: (value: boolean) => void;
}) {
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
    }, [virtualizer, scrollRef.current]);

    return useCallback(
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
}

function EmulatorLogHeader({
    log,
    wrapLines,
    onWrapLinesChange,
    setToastText,
}: {
    log: EmulatorPauseableLog;
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
            <div className="EmulatorLogging-Controls">
                <Button onClick={handlePauseResume}>
                    {log.isPaused() ? "Resume" : "Pause"}
                </Button>
                <Button onClick={handleClear}>Clear</Button>
            </div>
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
        for (const listener of this.#listeners) {
            listener();
        }
    }

    #removeUpstreamSubscription: (() => void) | undefined;

    #updateUpstreamSubscription(): void {
        const needsUpstreamSubscription =
            this.#listeners.size > 0 && !this.isPaused();
        if (!needsUpstreamSubscription && this.#removeUpstreamSubscription) {
            this.#removeUpstreamSubscription();
            this.#removeUpstreamSubscription = undefined;
        } else if (
            !this.#removeUpstreamSubscription &&
            needsUpstreamSubscription
        ) {
            this.#removeUpstreamSubscription = this.#log.subscribe(() => {
                this.#notifyListeners();
            });
        }
    }
}
