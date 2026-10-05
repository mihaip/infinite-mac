import {useEffect, useMemo, useRef, useState, type CSSProperties} from "react";
import {Button} from "@/controls/Button";
import {Select} from "@/controls/Select";
import {
    SYSTEM_DISKS_BY_NAME,
    SYSTEM_1_0,
    SYSTEM_1_1,
    SYSTEM_3_0,
    SYSTEM_3_2,
    SYSTEM_6_0_8,
    SYSTEM_7_0_1,
    SYSTEM_7_1,
    SYSTEM_7_1_2,
    SYSTEM_7_5_2,
    MAC_OS_7_6,
    MAC_OS_7_6_1,
    MAC_OS_8_1,
    MAC_OS_8_5,
    MAC_OS_9_0_4,
    MAC_OS_9_2_2,
    MAC_OS_X_10_1_5,
    MAC_OS_X_10_2_8,
    MAC_OS_X_10_3_9,
    NEXTSTEP_1_0,
    NEXTSTEP_3_3,
    OPENSTEP_4_2,
    AUX_3_0_1,
    BEOS_R4,
    systemDiskName,
    type SystemDiskDef,
} from "@/defs/disks";
import {
    MAC_128K,
    MAC_128K_SNOW,
    MAC_512K_SNOW,
    MAC_512KE,
    MAC_512KE_SNOW,
    MAC_PLUS,
    MAC_PLUS_SNOW,
    MAC_SE,
    MAC_SE_SNOW,
    MAC_SE_FDHD_SNOW,
    MAC_CLASSIC_SNOW,
    MAC_II,
    MAC_II_SNOW,
    MAC_II_FDHD_SNOW,
    MAC_IIx,
    MAC_IIx_SNOW,
    MAC_IIcx_SNOW,
    MAC_SE30_SNOW,
    QUADRA_650,
    POWER_MACINTOSH_6100,
    POWER_MACINTOSH_7200,
    POWER_MACINTOSH_7300,
    POWER_MACINTOSH_7500,
    POWER_MACINTOSH_G3_BEIGE,
    POWER_MACINTOSH_G3_BW,
    POWER_MACINTOSH_G4_PEARPC,
    IMAC_G3,
    NEXT_COMPUTER,
    NEXT_CUBE,
    NEXT_STATION,
    NEXT_STATION_TURBO_COLOR,
    type MachineDef,
    POWER_MACINTOSH_G3_BW_DPPC,
    POWER_MACINTOSH_9500,
} from "@/defs/machines";
import {type RunDef, runDefToUrl} from "@/defs/run-def";
import {
    type EmbedControlEvent,
    type EmbedNotificationEvent,
} from "@/embed-types";
import {iso} from "@/lib/iso";
import "@/app/EmulatorsPreview.css";

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
    const [session, setSession] = useState({generation: 0, autoStart: true});
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
                                setSession(current => ({
                                    generation: current.generation + 1,
                                    autoStart: true,
                                }));
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
                            {[1, 2, 3, 4].map(count => (
                                <option key={count}>{count}</option>
                            ))}
                        </Select>
                    </label>
                    <Button
                        onClick={() =>
                            setSession(current => ({
                                generation: current.generation + 1,
                                autoStart: true,
                            }))
                        }>
                        Restart all
                    </Button>
                    <Button
                        onClick={() =>
                            setSession(current => ({
                                generation: current.generation + 1,
                                autoStart: false,
                            }))
                        }>
                        Stop all
                    </Button>
                </div>
            </header>
            <div
                className="EmulatorsPreview-Grid"
                style={{"--columns": columns} as CSSProperties}>
                {preset.cases.map(testCase => (
                    <EmulatorPanel
                        key={`${preset.id}/${session.generation}/${testCase.id}`}
                        testCase={testCase}
                        autoStart={session.autoStart}
                    />
                ))}
            </div>
        </main>
    );
}

type Status =
    | "Starting"
    | "Running"
    | "Paused"
    | "Stopped"
    | "Exited"
    | "Error";

function EmulatorPanel({
    testCase,
    autoStart,
}: {
    testCase: EmulatorPreviewCase;
    autoStart: boolean;
}) {
    const {runDef, label} = testCase;
    const {machine, disks} = runDef;
    const screenSize = machine.fixedScreenSize ?? {width: 640, height: 480};
    const [running, setRunning] = useState(autoStart);
    const [generation, setGeneration] = useState(0);
    const [status, setStatus] = useState<Status>(
        autoStart ? "Starting" : "Stopped"
    );
    const [error, setError] = useState<string>();
    const viewportRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [viewportWidth, setViewportWidth] = useState(0);

    useEffect(() => {
        const observer = new ResizeObserver(([entry]) =>
            setViewportWidth(entry.contentRect.width)
        );
        observer.observe(viewportRef.current!);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const listener = (event: MessageEvent<EmbedNotificationEvent>) => {
            if (
                event.origin !== window.location.origin ||
                event.source !== iframeRef.current?.contentWindow ||
                !event.data
            ) {
                return;
            }
            switch (event.data.type) {
                case "emulator_loaded":
                    setStatus(current =>
                        current === "Starting" ? "Running" : current
                    );
                    break;
                case "emulator_exited":
                    setStatus("Exited");
                    setRunning(false);
                    break;
                case "emulator_error":
                    setStatus("Error");
                    setError(event.data.error);
                    break;
            }
        };
        window.addEventListener("message", listener);
        return () => window.removeEventListener("message", listener);
    }, []);

    const embedUrl = useMemo(() => {
        const url = new URL(runDefToUrl(runDef, true));
        // Keep these explicit, including when opening a panel on its own.
        url.searchParams.set("saved_hd", "false");
        url.searchParams.set("infinite_hd", "false");
        url.searchParams.set("library", "false");
        return url.href;
    }, [runDef]);
    const standaloneUrl = useMemo(
        () =>
            runDefToUrl({
                ...runDef,
                screenSize: "auto",
                screenScale: undefined,
            }),
        [runDef]
    );
    const title = `${machine.name} · ${disks[0]?.displayName}${label ? ` · ${label}` : ""}`;

    const start = () => {
        setGeneration(current => current + 1);
        setStatus("Starting");
        setError(undefined);
        setRunning(true);
    };
    const stop = () => {
        setRunning(false);
        setStatus("Stopped");
        setError(undefined);
    };
    const togglePause = () => {
        const paused = status !== "Paused";
        const event: EmbedControlEvent = {
            type: paused ? "emulator_pause" : "emulator_unpause",
        };
        iframeRef.current?.contentWindow?.postMessage(
            event,
            window.location.origin
        );
        setStatus(paused ? "Paused" : "Running");
    };

    return (
        <section className="EmulatorsPreview-Panel">
            <header className="EmulatorsPreview-PanelHeader">
                <div className="EmulatorsPreview-PanelTitle">
                    <h2>
                        <a
                            href={standaloneUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open separately">
                            {disks[0]?.displayName}
                            {label && ` · ${label}`}
                        </a>
                    </h2>
                    <p>
                        {machine.emulatorType} · {machine.name}
                    </p>
                </div>
                <div className="EmulatorsPreview-PanelToolbar">
                    <span
                        className={`EmulatorsPreview-Status EmulatorsPreview-Status-${status}`}
                        role="status">
                        {status}
                    </span>
                    <Select
                        value=""
                        aria-label={`Commands for ${title}`}
                        style={{width: 20}}
                        onChange={event => {
                            switch (event.target.value) {
                                case "start":
                                    start();
                                    break;
                                case "pause":
                                    togglePause();
                                    break;
                                case "stop":
                                    stop();
                                    break;
                            }
                        }}>
                        <option value="" disabled>
                            …
                        </option>
                        <option value="start">
                            {running ? "Restart" : "Start"}
                        </option>
                        <option
                            value="pause"
                            disabled={
                                status !== "Running" && status !== "Paused"
                            }>
                            {status === "Paused" ? "Resume" : "Pause"}
                        </option>
                        <option value="stop" disabled={!running}>
                            Stop
                        </option>
                    </Select>
                </div>
            </header>
            <div
                className="EmulatorsPreview-Viewport"
                ref={viewportRef}
                style={{
                    aspectRatio: `${screenSize.width} / ${screenSize.height}`,
                }}>
                {running && viewportWidth > 0 ? (
                    <iframe
                        key={generation}
                        ref={iframeRef}
                        title={title}
                        src={embedUrl}
                        width={screenSize.width}
                        height={screenSize.height}
                        allow="cross-origin-isolated"
                        style={{
                            transform: `scale(${viewportWidth / screenSize.width})`,
                        }}
                    />
                ) : (
                    <div className="EmulatorsPreview-Placeholder">{status}</div>
                )}
            </div>
            {error && (
                <p className="EmulatorsPreview-Error" role="alert">
                    {error}
                </p>
            )}
        </section>
    );
}

type EmulatorPreviewCase = {
    id: string;
    label?: string;
    runDef: RunDef;
};

function preview(
    machine: MachineDef,
    disk: SystemDiskDef | undefined,
    options: Partial<Pick<RunDef, "ramSize" | "flags" | "bootFromROM">> & {
        label?: string;
    } = {}
): EmulatorPreviewCase {
    const {label, ...overrides} = options;
    const diskName = disk ? systemDiskName(disk) : "none";
    return {
        id: `${machine.name}/${diskName}/${label ?? ""}`,
        label,
        runDef: {
            machine,
            disks: disk ? [disk] : [],
            ramSize: disk?.preferredRAMSize,
            screenSize: "embed",
            screenScale: 1,
            includeSavedHD: false,
            includeInfiniteHD: false,
            includeLibrary: false,
            libraryDownloadURLs: [],
            diskFiles: [],
            cdromURLs: [],
            cdromPrefetchChunks: [],
            flags: {customDate: disk?.customDate},
            ...overrides,
        },
    };
}

const EMULATOR_PREVIEW_PRESETS = [
    {
        id: "cores",
        label: "Emulator cores",
        cases: [
            preview(MAC_128K_SNOW, SYSTEM_1_0), // Snow
            preview(MAC_PLUS, SYSTEM_6_0_8), // Mini vMac
            preview(QUADRA_650, SYSTEM_7_1), // Basilisk II
            preview(POWER_MACINTOSH_G3_BW, MAC_OS_9_0_4), // SheepShaver
            preview(POWER_MACINTOSH_G3_BEIGE, MAC_OS_8_1), // DingusPPC
            preview(NEXT_STATION, NEXTSTEP_3_3), // Previous
            preview(POWER_MACINTOSH_G4_PEARPC, MAC_OS_X_10_3_9), // PearPC
        ],
    },
    {
        id: "minivmac",
        label: "Mini vMac variants",
        cases: [
            preview(MAC_128K, SYSTEM_1_0),
            preview(MAC_512KE, SYSTEM_3_2),
            preview(MAC_PLUS, SYSTEM_6_0_8),
            preview(MAC_SE, SYSTEM_6_0_8),
            preview(MAC_II, SYSTEM_7_1),
            preview(MAC_IIx, SYSTEM_7_1),
        ],
    },
    {
        id: "snow",
        label: "Snow machines",
        cases: [
            preview(MAC_128K_SNOW, SYSTEM_1_0),
            preview(MAC_512K_SNOW, SYSTEM_1_1),
            preview(MAC_512KE_SNOW, SYSTEM_3_2),
            preview(MAC_PLUS_SNOW, SYSTEM_6_0_8),
            preview(MAC_SE_SNOW, SYSTEM_6_0_8),
            preview(MAC_SE_FDHD_SNOW, SYSTEM_6_0_8),
            preview(MAC_CLASSIC_SNOW, SYSTEM_6_0_8),
            preview(MAC_II_SNOW, SYSTEM_7_1),
            preview(MAC_II_FDHD_SNOW, SYSTEM_7_1),
            preview(MAC_IIx_SNOW, SYSTEM_7_1),
            preview(MAC_IIcx_SNOW, SYSTEM_7_1),
            preview(MAC_SE30_SNOW, SYSTEM_6_0_8),
        ],
    },
    {
        id: "dingusppc",
        label: "DingusPPC machines",
        cases: [
            // NuBus
            preview(POWER_MACINTOSH_6100, SYSTEM_7_1_2),
            // PCI
            preview(POWER_MACINTOSH_7200, MAC_OS_7_6),
            preview(POWER_MACINTOSH_7500, SYSTEM_7_5_2, {
                label: "BlueSCSI",
                flags: {blueSCSI: true},
            }),
            preview(POWER_MACINTOSH_7300, MAC_OS_7_6_1),
            // OldWorld
            preview(POWER_MACINTOSH_G3_BEIGE, MAC_OS_8_1),
            // NeWorld
            preview(POWER_MACINTOSH_G3_BW_DPPC, MAC_OS_9_2_2),
            preview(IMAC_G3, MAC_OS_X_10_1_5),
        ],
    },
    {
        id: "previous",
        label: "NeXT machines",
        cases: [
            preview(NEXT_COMPUTER, NEXTSTEP_1_0),
            preview(NEXT_CUBE, NEXTSTEP_3_3),
            preview(NEXT_STATION, NEXTSTEP_3_3),
            preview(NEXT_STATION_TURBO_COLOR, OPENSTEP_4_2),
        ],
    },
    {
        id: "families",
        label: "OS families",
        cases: [
            preview(MAC_128K_SNOW, SYSTEM_1_0), // Original
            preview(MAC_PLUS_SNOW, SYSTEM_3_0), // HFS + SCSI
            preview(MAC_SE, SYSTEM_6_0_8), // System 6
            preview(MAC_CLASSIC_SNOW, undefined, {
                label: "Boot from ROM",
                bootFromROM: true,
            }), // System 6 in ROM
            preview(MAC_IIcx_SNOW, SYSTEM_7_0_1), // System 7
            preview(POWER_MACINTOSH_9500, MAC_OS_8_5), // PowerPC-only
            preview(MAC_IIcx_SNOW, AUX_3_0_1), // A/UX
            preview(POWER_MACINTOSH_7300, BEOS_R4), // BeOS
            preview(NEXT_STATION, NEXTSTEP_3_3), // NeXTSTEP
            preview(POWER_MACINTOSH_G4_PEARPC, MAC_OS_X_10_2_8), // Mac OS X
        ],
    },
    {
        id: "all",
        label: "All disks",
        cases: Object.values(SYSTEM_DISKS_BY_NAME).map(disk =>
            preview(disk.preferredMachine, disk)
        ),
    },
];
