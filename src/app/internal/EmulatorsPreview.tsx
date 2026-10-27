import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type CSSProperties,
} from "react";
import {Button} from "@/controls/Button";
import {Select} from "@/controls/Select";
import {type RunDef, runDefToUrl} from "@/defs/run-def";
import {
    type EmbedControlEvent,
    type EmbedNotificationEvent,
} from "@/embed-types";
import {iso} from "@/lib/iso";
import {EmulatorTargetDialog} from "@/app/internal/EmulatorTargetDialog";
import {
    loadTargetImage,
    targetImageName,
    targetMatches,
    type ScreenFrame,
    type TargetImage,
} from "@/app/internal/emulator-preview-target";
import {
    admitPreview,
    isPreviewActive,
    previewConcurrency,
    type PreviewStatus,
} from "@/app/internal/emulator-preview-governor";
import {
    EMULATOR_PREVIEW_PRESETS,
    type EmulatorPreviewCase,
} from "@/app/internal/emulator-preview-presets";
import "@/app/internal/EmulatorsPreview.css";
import {machineDisplayName} from "@/defs/machines";

export default function EmulatorsPreview() {
    const [presetId, setPresetId] = useState(() => {
        const id = iso().location.searchParams.get("preset");
        return (
            EMULATOR_PREVIEW_PRESETS.find(preset => preset.id === id)?.id ??
            "cores"
        );
    });
    const preset = EMULATOR_PREVIEW_PRESETS.find(
        preset => preset.id === presetId
    )!;
    const [columns, setColumns] = useState(3);
    const logicalCores =
        typeof navigator === "undefined"
            ? undefined
            : navigator.hardwareConcurrency;
    const [limit, setLimit] = useState(() => previewConcurrency(logicalCores));
    const [timeout, setTimeoutSeconds] = useState(300);
    const [generation, setGeneration] = useState(0);
    return (
        <main className="EmulatorsPreview">
            <header className="EmulatorsPreview-Header">
                <h1>Emulators</h1>
                <div className="EmulatorsPreview-Toolbar">
                    <label>
                        Preset{" "}
                        <Select
                            value={presetId}
                            onChange={event => {
                                const id = event.target.value;
                                setPresetId(id);
                                const url = new URL(iso().location.href);
                                url.searchParams.set("preset", id);
                                history.replaceState({}, "", url);
                            }}>
                            {EMULATOR_PREVIEW_PRESETS.map(preset => (
                                <option key={preset.id} value={preset.id}>
                                    {preset.label} ({preset.cases.length})
                                </option>
                            ))}
                        </Select>
                    </label>
                    <label>
                        Columns{" "}
                        <Select
                            value={columns}
                            onChange={event =>
                                setColumns(Number(event.target.value))
                            }>
                            {[1, 2, 3, 4, 8, 12].map(count => (
                                <option key={count}>{count}</option>
                            ))}
                        </Select>
                    </label>
                </div>
            </header>
            <PreviewSession
                key={`${presetId}/${generation}`}
                cases={preset.cases}
                columns={columns}
                limit={limit}
                setLimit={setLimit}
                timeout={timeout}
                setTimeoutSeconds={setTimeoutSeconds}
                logicalCores={logicalCores}
                onRestart={() => setGeneration(current => current + 1)}
            />
        </main>
    );
}

function PreviewSession({
    cases,
    columns,
    limit,
    setLimit,
    timeout,
    setTimeoutSeconds,
    logicalCores,
    onRestart,
}: {
    cases: EmulatorPreviewCase[];
    columns: number;
    limit: number;
    setLimit: (limit: number) => void;
    timeout: number;
    setTimeoutSeconds: (timeout: number) => void;
    logicalCores?: number;
    onRestart: () => void;
}) {
    const ids = useMemo(() => cases.map(testCase => testCase.id), [cases]);
    const [statuses, setStatuses] = useState<Record<string, PreviewStatus>>(
        () => Object.fromEntries(ids.map(id => [id, "Queued"]))
    );
    const onStatus = useCallback((id: string, status: PreviewStatus) => {
        setStatuses(current =>
            current[id] === status ? current : {...current, [id]: status}
        );
    }, []);
    useEffect(() => {
        const timer = window.setInterval(
            () => setStatuses(current => admitPreview(current, ids, limit)),
            750
        );
        return () => window.clearInterval(timer);
    }, [ids, limit]);

    function handleLimitChange(event: ChangeEvent<HTMLSelectElement>) {
        const limit = Number(event.target.value);
        setLimit(limit);
        setStatuses(current => {
            let active = 0;
            return Object.fromEntries(
                Object.entries(current).map(([id, status]) => {
                    const overLimit =
                        isPreviewActive(status) && ++active > limit;
                    return [id, overLimit ? "Queued" : status];
                })
            );
        });
    }

    const values = Object.values(statuses);
    const matched = values.filter(status => status === "Matched").length;
    const hasFailures = values.some(status =>
        ["Error", "Exited", "Timed out"].includes(status)
    );
    return (
        <>
            <div className="EmulatorsPreview-Toolbar EmulatorsPreview-Governor">
                <label>
                    Active limit{" "}
                    <Select
                        className="EmulatorsPreview-ActiveLimit"
                        value={limit}
                        onChange={handleLimitChange}>
                        <option value="" disabled>
                            {logicalCores
                                ? `${logicalCores} logical cores`
                                : "Logical core count unavailable"}
                        </option>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                            <option key={n}>{n}</option>
                        ))}
                    </Select>
                </label>
                <label>
                    Boot timeout{" "}
                    <Select
                        value={timeout}
                        onChange={event =>
                            setTimeoutSeconds(Number(event.target.value))
                        }>
                        {[60, 180, 300, 600].map(n => (
                            <option key={n} value={n}>
                                {n / 60} min
                            </option>
                        ))}
                    </Select>
                </label>
                <Button onClick={onRestart}>Restart all</Button>
            </div>
            <p className="EmulatorsPreview-Counters" role="status">
                {cases.length} instances •{" "}
                <span
                    className={
                        hasFailures
                            ? "EmulatorsPreview-Count-Failed"
                            : "EmulatorsPreview-Count-Matched"
                    }>
                    {matched === cases.length
                        ? "all matched"
                        : `${matched}/${cases.length} matched`}
                </span>
            </p>
            <div
                className="EmulatorsPreview-Grid"
                style={{"--columns": columns} as CSSProperties}>
                {cases.map(testCase => (
                    <EmulatorPanel
                        key={testCase.id}
                        testCase={testCase}
                        status={statuses[testCase.id]}
                        onStatus={onStatus}
                        timeout={timeout}
                    />
                ))}
            </div>
        </>
    );
}

function EmulatorPanel({
    testCase,
    status,
    onStatus,
    timeout,
}: {
    testCase: EmulatorPreviewCase;
    status: PreviewStatus;
    onStatus: (id: string, status: PreviewStatus) => void;
    timeout: number;
}) {
    const {runDef, label, id} = testCase;
    const {machine, disks} = runDef;
    const target = useEmulatorPreviewTarget(id);
    const emulator = useEmulatorPreview({
        id,
        runDef,
        status,
        onStatus,
        timeout,
        target: target.image,
    });
    const viewport = usePreviewViewport();
    const {active, mounted, screenSize, frame} = emulator;
    const standaloneUrl = useMemo(
        () =>
            runDefToUrl({
                ...runDef,
                screenSize: "auto",
                screenScale: undefined,
            }),
        [runDef]
    );
    const disk = disks[0];
    const title = `${disk?.displayName ?? "Boot from ROM"}${disk?.displaySubtitle ? ` (${disk.displaySubtitle})` : ""}${label ? ` · ${label}` : ""}`;
    const targetNotice =
        target.notice ??
        (status === "Timed out" ? `No match within ${timeout}s` : undefined);

    function handleActionChange(event: ChangeEvent<HTMLSelectElement>) {
        switch (event.target.value) {
            case "start":
                emulator.restart();
                break;
            case "pause":
                if (active) emulator.pause();
                else emulator.resume();
                break;
            case "stop":
                emulator.stop();
                break;
            case "target": {
                const frame = emulator.captureFrame();
                if (frame) target.openCapture(frame);
                break;
            }
        }
    }

    return (
        <section
            className="EmulatorsPreview-Panel"
            data-preview-id={target.name}>
            <header className="EmulatorsPreview-PanelHeader">
                <div className="EmulatorsPreview-PanelTitle">
                    <h2>
                        <a
                            href={standaloneUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open separately">
                            {title}
                        </a>
                    </h2>
                    <p>
                        {machine.emulatorType} · {machineDisplayName(machine)}
                    </p>
                </div>
                <div className="EmulatorsPreview-PanelToolbar">
                    <span
                        className={`EmulatorsPreview-Status EmulatorsPreview-Status-${status.replaceAll(" ", "-")}`}
                        role="status">
                        {status}
                    </span>
                    <Select
                        aria-label={`Actions for ${title}, ${machine.name}`}
                        value=""
                        style={{width: 20}}
                        onChange={handleActionChange}>
                        <option value="" disabled>
                            …
                        </option>
                        <option value="start">
                            {mounted ? "Restart" : "Start"}
                        </option>
                        <option
                            value="pause"
                            disabled={!mounted || status === "Queued"}>
                            {active ? "Pause" : "Resume"}
                        </option>
                        <option
                            value="stop"
                            disabled={!mounted && status !== "Queued"}>
                            Stop
                        </option>
                        <option value="target" disabled={!frame}>
                            Save Target Image…
                        </option>
                    </Select>
                </div>
            </header>
            <div
                className="EmulatorsPreview-Viewport"
                ref={viewport.ref}
                style={{
                    aspectRatio: `${screenSize.width} / ${screenSize.height}`,
                }}>
                {mounted && viewport.width > 0 ? (
                    <iframe
                        key={emulator.generation}
                        ref={emulator.iframeRef}
                        src={emulator.embedUrl}
                        width={screenSize.width}
                        height={screenSize.height}
                        allow="cross-origin-isolated"
                        title={`${title} on ${machine.name}`}
                        style={{
                            transform: `scale(${viewport.width / screenSize.width})`,
                            pointerEvents: active ? undefined : "none",
                        }}
                    />
                ) : frame ? (
                    <PreviewFrame frame={frame} />
                ) : (
                    <div className="EmulatorsPreview-Placeholder">{status}</div>
                )}
                {status === "Matched" && (
                    <button
                        type="button"
                        className="EmulatorsPreview-MatchedOverlay"
                        aria-label={`Resume ${title} on ${machine.name}`}
                        title="Resume emulator"
                        onClick={emulator.resume}>
                        <svg
                            className="EmulatorsPreview-MatchedCheck"
                            viewBox="0 0 24 24"
                            aria-hidden="true">
                            <path
                                d="M5 12l4 4L19 6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <svg
                            className="EmulatorsPreview-MatchedPlay"
                            viewBox="0 0 24 24"
                            aria-hidden="true">
                            <path d="M8 5v14l11-7z" fill="currentColor" />
                        </svg>
                    </button>
                )}
            </div>
            {targetNotice && (
                <p className="EmulatorsPreview-Notice">{targetNotice}</p>
            )}
            {emulator.error && (
                <p className="EmulatorsPreview-Error" role="alert">
                    {emulator.error}
                </p>
            )}
            {target.capture && (
                <EmulatorTargetDialog
                    frame={target.capture}
                    name={target.name}
                    initialRect={target.initialRect}
                    onClose={target.closeCapture}
                    onSave={target.saveCapture}
                />
            )}
        </section>
    );
}

/** Show the last received screen after the embedded emulator is removed. */
function PreviewFrame({frame}: {frame: ScreenFrame}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        canvasRef
            .current!.getContext("2d")!
            .putImageData(
                new ImageData(frame.data, frame.width, frame.height),
                0,
                0
            );
    }, [frame]);
    return (
        <canvas
            className="EmulatorsPreview-FrozenFrame"
            ref={canvasRef}
            width={frame.width}
            height={frame.height}
            aria-label="Last screen before the emulator stopped"
        />
    );
}

/** Own an embedded preview's controls, screen updates, and boot matching. */
function useEmulatorPreview({
    id,
    runDef,
    status,
    onStatus,
    timeout,
    target,
}: {
    id: string;
    runDef: RunDef;
    status: PreviewStatus;
    onStatus: (id: string, status: PreviewStatus) => void;
    timeout: number;
    target?: TargetImage;
}) {
    const [screenSize, setScreenSize] = useState(
        runDef.machine.fixedScreenSize ?? {width: 640, height: 480}
    );
    const [generation, setGeneration] = useState(0);
    const [loadState, setLoadState] = useState<"idle" | "loading" | "ready">(
        "idle"
    );
    const [error, setError] = useState<string>();
    const [hasFrame, setHasFrame] = useState(false);
    const targetRef = useRef(target);
    targetRef.current = target;
    const ignoreMatchRef = useRef(false);
    // Keep screen updates out of state so each frame doesn't rerender the panel.
    const latestFrameRef = useRef<ScreenFrame>();
    const statusRef = useRef(status);
    statusRef.current = status;
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const lastControlRef = useRef<string>();
    const active = isPreviewActive(status);
    // Queued resumes retain their iframe; new guests wait to be admitted.
    const mounted =
        active ||
        (loadState !== "idle" &&
            ["Queued", "Paused", "Matched"].includes(status));
    const changeStatus = useCallback(
        (status: PreviewStatus) => onStatus(id, status),
        [id, onStatus]
    );
    const send = useCallback((event: EmbedControlEvent, retry = false) => {
        const contentWindow = iframeRef.current?.contentWindow;
        if (!contentWindow || (!retry && lastControlRef.current === event.type))
            return;
        lastControlRef.current = event.type;
        contentWindow.postMessage(event, window.location.origin);
    }, []);

    const checkTarget = useCallback(() => {
        const frame = latestFrameRef.current;
        const target = targetRef.current;
        if (
            statusRef.current !== "Running" ||
            ignoreMatchRef.current ||
            !frame ||
            !target
        )
            return;
        if (targetMatches(frame, target)) {
            statusRef.current = "Matched";
            send({type: "emulator_pause"});
            changeStatus("Matched");
        }
    }, [send, changeStatus]);
    useEffect(() => {
        checkTarget();
    }, [target, status, checkTarget]);

    useEffect(() => {
        if (active)
            setLoadState(current => (current === "idle" ? "loading" : current));
        else if (!mounted) setLoadState("idle");
    }, [active, mounted]);

    useEffect(() => {
        // The first command can precede the embed's message listener. Also,
        // guest initialization may repeat after it has reported ready.
        // Reassert the desired state while this slot is active.
        if (!active) return;
        const timer = window.setInterval(() => {
            if (isPreviewActive(statusRef.current)) {
                send({type: "emulator_unpause"}, true);
            }
        }, 500);
        return () => window.clearInterval(timer);
    }, [active, send]);
    useEffect(() => {
        if (!active) send({type: "emulator_pause"});
        if (loadState !== "ready") return;
        if (status === "Starting") changeStatus("Running");
        send({
            type:
                status === "Running" || status === "Starting"
                    ? "emulator_unpause"
                    : "emulator_pause",
        });
    }, [status, loadState, active, send, changeStatus]);
    useEffect(() => {
        if (!active) return;
        const timer = window.setTimeout(
            () =>
                changeStatus(targetRef.current ? "Timed out" : "Needs target"),
            timeout * 1000
        );
        return () => window.clearTimeout(timer);
    }, [active, timeout, changeStatus]);
    useEffect(() => {
        const listener = (event: MessageEvent<EmbedNotificationEvent>) => {
            if (
                event.origin !== window.location.origin ||
                event.source !== iframeRef.current?.contentWindow ||
                !event.data
            )
                return;
            switch (event.data.type) {
                case "emulator_loaded":
                    setLoadState("ready");
                    break;
                case "emulator_exited":
                    changeStatus("Exited");
                    break;
                case "emulator_error":
                    changeStatus("Error");
                    setError(event.data.error);
                    break;
                case "emulator_screen": {
                    const frame = event.data;
                    latestFrameRef.current = frame;
                    setHasFrame(true);
                    setScreenSize(current =>
                        current.width === frame.width &&
                        current.height === frame.height
                            ? current
                            : {width: frame.width, height: frame.height}
                    );
                    // The embed already coalesces screen updates.
                    checkTarget();
                    break;
                }
            }
        };
        window.addEventListener("message", listener);
        return () => window.removeEventListener("message", listener);
    }, [changeStatus, checkTarget]);

    const embedUrl = useMemo(() => {
        const url = new URL(
            runDefToUrl(
                {
                    ...runDef,
                    flags: {
                        ...runDef.flags,
                        startPaused: true,
                        autoPause: false,
                    },
                    screenUpdateMessages: true,
                    screenUpdateInterval: 250,
                },
                true
            )
        );
        url.searchParams.set("saved_hd", "false");
        url.searchParams.set("infinite_hd", "false");
        url.searchParams.set("library", "false");
        return url.href;
    }, [runDef]);

    function restart() {
        send({type: "emulator_pause"});
        lastControlRef.current = undefined;
        setGeneration(current => current + 1);
        setLoadState("idle");
        setHasFrame(false);
        latestFrameRef.current = undefined;
        ignoreMatchRef.current = false;
        setError(undefined);
        changeStatus("Queued");
    }

    function pause() {
        send({type: "emulator_pause"});
        if (mounted) changeStatus("Paused");
    }

    function resume() {
        ignoreMatchRef.current = true;
        changeStatus("Queued");
    }

    function stop() {
        send({type: "emulator_pause"});
        setLoadState("idle");
        setHasFrame(false);
        latestFrameRef.current = undefined;
        changeStatus("Stopped");
    }

    function captureFrame() {
        const frame = latestFrameRef.current;
        if (frame) pause();
        return frame;
    }

    return {
        iframeRef,
        embedUrl,
        generation,
        screenSize,
        active,
        mounted,
        error,
        frame: hasFrame ? latestFrameRef.current : undefined,
        restart,
        pause,
        resume,
        stop,
        captureFrame,
    };
}

const TARGET_URLS = import.meta.glob("./targets/*.png", {
    eager: true,
    query: "?url",
    import: "default",
}) as Record<string, string>;

/** Load a preview's reference image and manage its target capture dialog. */
function useEmulatorPreviewTarget(id: string) {
    const name = targetImageName(id);
    const targetUrl = TARGET_URLS[`./targets/${name}`];
    const [image, setImage] = useState<TargetImage>();
    const [error, setError] = useState<string>();
    const [capture, setCapture] = useState<ScreenFrame>();

    useEffect(() => {
        if (!targetUrl) return;
        let cancelled = false;
        loadTargetImage(targetUrl)
            .then(image => {
                if (!cancelled) setImage(image);
            })
            .catch(error => {
                if (!cancelled) setError(String(error));
            });
        return () => {
            cancelled = true;
        };
    }, [targetUrl]);

    function openCapture(frame: ScreenFrame) {
        setCapture(frame);
    }

    function closeCapture() {
        setCapture(undefined);
    }

    function saveCapture(blob: Blob) {
        const url = URL.createObjectURL(blob);
        loadTargetImage(url)
            .then(image => {
                setImage(image);
                setError(undefined);
            })
            .catch(error => setError(String(error)))
            .finally(() => URL.revokeObjectURL(url));
        closeCapture();
    }

    return {
        name,
        image,
        notice:
            error ??
            (!targetUrl && !image
                ? "No target image — save one after booting"
                : undefined),
        capture,
        initialRect: image
            ? {
                  x: image.x,
                  y: image.y,
                  width: image.image.width,
                  height: image.image.height,
              }
            : undefined,
        openCapture,
        closeCapture,
        saveCapture,
    };
}

/** Measure the available width for scaling an embedded preview. */
function usePreviewViewport() {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const observer = new ResizeObserver(([entry]) =>
            setWidth(entry.contentRect.width)
        );
        observer.observe(ref.current!);
        return () => observer.disconnect();
    }, []);

    return {ref, width};
}
