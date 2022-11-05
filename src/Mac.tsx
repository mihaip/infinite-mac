import React, {useEffect, useState, useRef, useMemo} from "react";
import "./Mac.css";
import basiliskPrefsPath from "./Data/BasiliskIIPrefs.txt";
import sheepShaverPrefsPath from "./Data/SheepShaverPrefs.txt";
import quadraRomPath from "./Data/Quadra-650.rom";
import newWorldRomPath from "./Data/New-World.rom";
import oldWorldRomPath from "./Data/Old-World.rom";
import system753HdManifest from "./Data/System 7.5.3 HD.dsk.json";
import system753PpcHdManifest from "./Data/System 7.5.3 (PPC) HD.dsk.json";
import kanjiTalk753HdManifest from "./Data/KanjiTalk 7.5.3 HD.dsk.json";
import macos81HdManifest from "./Data/Mac OS 8.1 HD.dsk.json";
import macos904HdManifest from "./Data/Mac OS 9.0.4 HD.dsk.json";
import infiniteHdManifest from "./Data/Infinite HD.dsk.json";
import type {
    EmulatorEthernetProvider,
    EmulatorEthernetPeer,
    EmulatorSettings,
} from "./emulator/emulator-ui";
import {Emulator} from "./emulator/emulator-ui";
import type {EmulatorChunkedFileSpec} from "./emulator/emulator-common";
import {isDiskImageFile} from "./emulator/emulator-common";
import {BroadcastChannelEthernetProvider} from "./BroadcastChannelEthernetProvider";
import {CloudflareWorkerEthernetProvider} from "./CloudflareWorkerEthernetProvider";
import {usePersistentState} from "./usePersistentState";

export function Mac() {
    const screenRef = useRef<HTMLCanvasElement>(null);
    const [screenSize, setScreenSize] = useState(INITIAL_RESOLUTION);
    const {width: screenWidth, height: screenHeight} = screenSize;
    const [emulatorLoaded, setEmulatorLoaded] = useState(false);
    const [scale, setScale] = useState<number | undefined>(undefined);
    const [emulatorLoadingProgress, setEmulatorLoadingProgress] = useState([
        0, 0,
    ]);
    const [emulatorLoadingDiskChunk, setEmulatorLoadingDiskChunk] =
        useState(false);
    const [uploadingDiskImage, setUploadingDiskImage] = useState(false);
    const [hasPendingDiskImage, setHasPendingDiskImage] = useState(false);
    const [ethernetPeers, setEthernetPeers] = useState<
        ReadonlyArray<EmulatorEthernetPeer>
    >([]);
    // Don't clear the loading state immediately, to make it clearer that I/O
    // is happening and things may be slow.
    const finishLoadingDiskChunkTimeoutRef = useRef<number>(0);
    const emulatorRef = useRef<Emulator>();
    const ethernetProviderRef = useRef<EmulatorEthernetProvider>();

    const [emulatorSettings, setEmulatorSettings] = usePersistentState(
        DEFAULT_EMULATOR_SETTINGS,
        "emulator-settings"
    );
    const emulatorSettingsRef = useRef(emulatorSettings);
    emulatorSettingsRef.current = emulatorSettings;

    const [disk, ethernetProvider, useSharedMemory] = useMemo(() => {
        const searchParams = new URLSearchParams(location.search);
        let domain = searchParams.get("domain") ?? location.host;
        // Use subdomain as the Ethernet Zone in production.
        let ethernetProvider: EmulatorEthernetProvider | undefined;
        if (domain.endsWith(".app")) {
            const pieces = domain.split(".");
            if (pieces.length === 3) {
                ethernetProvider = new CloudflareWorkerEthernetProvider(
                    pieces[0]
                );
                domain = `${pieces[1]}.app`;
            }
        }
        if (!ethernetProvider && searchParams.get("ethernet")) {
            const zoneName = searchParams.get("ethernet_zone");
            ethernetProvider = zoneName
                ? new CloudflareWorkerEthernetProvider(zoneName)
                : new BroadcastChannelEthernetProvider();
        }

        const disk = DISKS_BY_DOMAIN[domain] ?? DISKS_BY_DOMAIN["system7.app"];
        const useSharedMemory =
            typeof SharedArrayBuffer !== "undefined" &&
            searchParams.get("use_shared_memory") !== "false";
        return [disk, ethernetProvider, useSharedMemory];
    }, []);

    useEffect(() => {
        document.addEventListener("fullscreenchange", handleFullScreenChange);
        document.addEventListener(
            "webkitfullscreenchange",
            handleFullScreenChange
        );
        const libraryDisk = {
            baseUrl: "/Disk",
            prefetchChunks: [0],
            ...infiniteHdManifest,
        };
        const emulator = new Emulator(
            {
                emulator: disk.ppc ? "SheepShaver" : "BasiliskII",
                useSharedMemory,
                screenWidth: INITIAL_RESOLUTION.width,
                screenHeight: INITIAL_RESOLUTION.height,
                screenCanvas: screenRef.current!,
                prefsPath: disk.ppc ? sheepShaverPrefsPath : basiliskPrefsPath,
                romPath: disk.ppc
                    ? disk.oldWorld
                        ? oldWorldRomPath
                        : newWorldRomPath
                    : quadraRomPath,
                disks: [disk, libraryDisk],
                ethernetProvider,
            },
            {
                emulatorDidChangeScreenSize(width, height) {
                    setScreenSize({width, height});
                },
                emulatorDidFinishLoading(emulator: Emulator) {
                    setEmulatorLoaded(true);
                },
                emulatorDidMakeLoadingProgress(
                    emulator: Emulator,
                    total: number,
                    left: number
                ) {
                    setEmulatorLoadingProgress([total, left]);
                },
                emulatorDidStartToLoadDiskChunk(emulator: Emulator) {
                    setEmulatorLoadingDiskChunk(true);
                    clearTimeout(finishLoadingDiskChunkTimeoutRef.current);
                },
                emulatorDidFinishLoadingDiskChunk(emulator: Emulator) {
                    window.clearTimeout(
                        finishLoadingDiskChunkTimeoutRef.current
                    );
                    finishLoadingDiskChunkTimeoutRef.current =
                        window.setTimeout(() => {
                            setEmulatorLoadingDiskChunk(false);
                        }, 200);
                },
                emulatorEthernetPeersDidChange(emulator, peers) {
                    if (ethernetProvider) {
                        setEthernetPeers(peers);
                    }
                },
                emulatorSettings(emulator) {
                    return emulatorSettingsRef.current;
                },
            }
        );
        emulatorRef.current = emulator;
        ethernetProviderRef.current = ethernetProvider;
        emulator.start();
        return () => {
            document.removeEventListener(
                "fullscreenchange",
                handleFullScreenChange
            );
            document.removeEventListener(
                "webkitfullscreenchange",
                handleFullScreenChange
            );
            emulator.stop();
            emulatorRef.current = undefined;
            ethernetProvider?.close?.();
        };
    }, [disk, ethernetProvider, useSharedMemory]);

    const handleFullScreenClick = () => {
        // Make the entire page go fullscreen (instead of just the screen
        // canvas) because iOS Safari does not maintain the aspect ratio of the
        // canvas.
        document.body.requestFullscreen?.() ||
            document.body.webkitRequestFullscreen?.();
    };
    const handleFullScreenChange = () => {
        const isFullScreen = Boolean(
            document.fullscreenElement || document.webkitFullscreenElement
        );

        if (isFullScreen) {
            navigator.keyboard?.lock?.();
        }

        document.body.classList.toggle("fullscreen", isFullScreen);
        if (isFullScreen) {
            const heightScale =
                window.screen.availHeight / screenRef.current!.height;
            const widthScale =
                window.screen.availWidth / screenRef.current!.width;
            setScale(Math.min(heightScale, widthScale));
        } else {
            setScale(undefined);
        }
    };

    const [settingsVisible, setSettingsVisible] = useState(false);
    const handleSettingsClick = () => {
        setSettingsVisible(true);
    };

    let progress;
    if (!emulatorLoaded) {
        const [total, left] = emulatorLoadingProgress;
        progress = (
            <div className="Mac-Loading">
                Loading data files…
                <span className="Mac-Loading-Fraction">
                    ({total - left}/{total})
                </span>
            </div>
        );
    }

    function handleDragStart(event: React.DragEvent) {
        // Don't allow the screen to be dragged off when using a touchpad on
        // the iPad.
        event.preventDefault();
    }
    // Use count instead of just a boolean because we'll get dragenter and
    // dragleave events for child elements of the Mac container too.
    const [dragCount, setDragCount] = useState(0);
    function handleDragOver(event: React.DragEvent) {
        event.preventDefault();
    }
    function handleDragEnter(event: React.DragEvent) {
        setDragCount(value => value + 1);
    }
    function handleDragLeave(event: React.DragEvent) {
        setDragCount(value => value - 1);
    }

    async function handleDrop(event: React.DragEvent) {
        event.preventDefault();
        setDragCount(0);
        const emulator = emulatorRef.current;
        if (!emulator) {
            return;
        }
        const files = [];

        if (event.dataTransfer.items) {
            for (const item of event.dataTransfer.items) {
                if (item.kind === "file") {
                    files.push(item.getAsFile()!);
                }
            }
        } else if (event.dataTransfer.files) {
            for (const file of event.dataTransfer.files) {
                files.push(file);
            }
        }

        const diskImages = [];
        for (const file of files) {
            if (isDiskImageFile(file.name)) {
                diskImages.push(file);
            } else {
                emulator.uploadFile(file);
            }
        }
        if (diskImages.length) {
            setUploadingDiskImage(true);
            await Promise.all(
                diskImages.map(file => emulator.uploadDiskImage(file))
            );
            setUploadingDiskImage(false);
            setHasPendingDiskImage(true);
        }
    }

    // Can't use media queries because they would need to depend on the
    // emulator screen size, but we can't pass that in via CSS variables. We
    // could in theory dynamically generate the media query via JS, but it's not
    // worth the hassle.
    const bezelClasses = [`Mac-Bezel-${disk.bezelStyle}`];
    const availableSpace = window.innerWidth - screenWidth;
    if (availableSpace < SMALL_BEZEL_THRESHOLD) {
        bezelClasses.push("Mac-Small-Bezel");
    } else if (availableSpace < MEDIUM_BEZEL_THRESHOLD) {
        bezelClasses.push("Mac-Medium-Bezel");
    }

    return (
        <div
            className={`Mac ${bezelClasses.join(" ")}`}
            style={{
                width: `calc(${screenWidth}px + 2 * var(--screen-underscan))`,
                height: `calc(${screenHeight}px + 2 * var(--screen-underscan))`,
                transform: scale === undefined ? undefined : `scale(${scale})`,
            }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}>
            <div className="Mac-Controls-Container">
                <div className="Mac-Apple-Logo" />
                <div
                    className="Mac-Control Mac-Screen-Bezel-Text"
                    onClick={handleFullScreenClick}
                    data-text="Full-screen">
                    Full-screen
                </div>
                <div
                    className="Mac-Control Mac-Screen-Bezel-Text"
                    onClick={handleSettingsClick}
                    data-text="Settings">
                    Settings
                </div>
            </div>
            <div
                className={
                    "Mac-Led" +
                    (!emulatorLoaded || emulatorLoadingDiskChunk
                        ? " Mac-Led-Loading"
                        : "")
                }
            />
            <canvas
                className="Mac-Screen"
                ref={screenRef}
                width={screenWidth}
                height={screenHeight}
                onContextMenu={e => e.preventDefault()}
            />
            {progress}
            {dragCount > 0 && <div className="Mac-Overlay Mac-Drag-Overlay" />}
            {uploadingDiskImage && (
                <div className="Mac-Overlay Mac-Uploading-Disk-Image-Overlay" />
            )}
            {hasPendingDiskImage && (
                <div className="Mac-Pending-Disk-Image">
                    The Mac needs to be restarted to pick up the new disk image.
                    <button
                        onClick={() => {
                            setHasPendingDiskImage(false);
                            emulatorRef.current?.restart();
                        }}>
                        Restart
                    </button>
                </div>
            )}
            {ethernetProviderRef.current && (
                <MacEthernetStatus
                    provider={ethernetProviderRef.current}
                    peers={ethernetPeers}
                />
            )}
            {settingsVisible && (
                <MacSettings
                    emulatorSettings={emulatorSettings}
                    setEmulatorSettings={setEmulatorSettings}
                    onDone={() => setSettingsVisible(false)}
                />
            )}
        </div>
    );
}

const SMALL_BEZEL_THRESHOLD = 80;
const MEDIUM_BEZEL_THRESHOLD = 168;

const INITIAL_RESOLUTION = (() => {
    const availableWidth = window.innerWidth - SMALL_BEZEL_THRESHOLD;
    const availableHeight = window.innerHeight - SMALL_BEZEL_THRESHOLD;
    for (const [width, height] of [
        [1600, 1200],
        [1280, 1024],
        [1152, 870],
        [1024, 768],
        [800, 600],
        [640, 480],
    ]) {
        if (width <= availableWidth && height <= availableHeight) {
            return {width, height};
        }
    }
    return {width: 640, height: 480};
})();

const DEFAULT_EMULATOR_SETTINGS: EmulatorSettings = {
    swapControlAndCommand: false,
};

function MacEthernetStatus({
    provider,
    peers,
}: {
    provider: EmulatorEthernetProvider;
    peers: ReadonlyArray<EmulatorEthernetPeer>;
}) {
    let text = `Ethernet: ${provider.description()}`;
    const activePeerCount = peers.filter(
        peer => Date.now() - peer.lastPingTimeMs < 60000
    ).length;
    if (activePeerCount) {
        text += ` (${activePeerCount} peer${activePeerCount === 1 ? "" : "s"})`;
    }
    const [expanded, setExpanded] = useState(
        Boolean(new URLSearchParams(location.search).get("ethernet_status"))
    );
    let details;
    if (expanded) {
        let peerDetails;
        if (peers.length) {
            peerDetails = (
                <div className="Mac-Ethernet-Status-Peers">
                    <b>Peers:</b>
                    <ul>
                        {peers.map(peer => {
                            const ageMs = Date.now() - peer.lastPingTimeMs;
                            let ageStr;
                            if (ageMs > 30000) {
                                ageStr = ` ${(ageMs / 1000).toFixed(0)}s ago`;
                            }
                            return (
                                <li key={peer.macAddress}>
                                    {peer.macAddress} (RTT:{" "}
                                    {peer.rttMs.toFixed(0)}
                                    ms{ageStr})
                                </li>
                            );
                        })}
                    </ul>
                </div>
            );
        }
        details = (
            <div className="Mac-Ethernet-Status-Details">
                <b>MAC Address:</b> {provider.macAddress()}
                {peerDetails}
            </div>
        );
    }

    return (
        <div
            className="Mac-Ethernet-Status"
            onClick={() => setExpanded(!expanded)}>
            <div className="Mac-Screen-Bezel-Text" data-text={text}>
                {text}
            </div>
            {details}
        </div>
    );
}

function MacSettings({
    emulatorSettings,
    setEmulatorSettings,
    onDone,
}: {
    emulatorSettings: EmulatorSettings;
    setEmulatorSettings: (settings: EmulatorSettings) => void;
    onDone: () => void;
}) {
    return (
        <div className="Mac-Settings">
            <h1>Settings</h1>

            <label>
                <input
                    type="checkbox"
                    checked={emulatorSettings.swapControlAndCommand}
                    onChange={() =>
                        setEmulatorSettings({
                            ...emulatorSettings,
                            swapControlAndCommand:
                                !emulatorSettings.swapControlAndCommand,
                        })
                    }
                />
                Swap Control and Command Keys
                <div className="Mac-Settings-Description">
                    Makes it easier to use shortcuts like Command-W, Command-Q
                    or Command-Shift-3 (which are otherwise handled by the host
                    browser or OS).
                </div>
            </label>

            <footer>
                <button
                    onClick={e => {
                        e.preventDefault();
                        onDone();
                    }}>
                    Done
                </button>
            </footer>
        </div>
    );
}

// prefetchChunks are semi-automatically generated -- we will get a
// warning via validateSpecPrefetchChunks() if these are incorrect.
const DISKS_BY_DOMAIN: {
    [domain: string]: EmulatorChunkedFileSpec & {
        ppc?: boolean;
        oldWorld?: boolean;
        bezelStyle: "Beige" | "Platinum" | "Pinstripes";
    };
} = {
    "system7.app": {
        baseUrl: "/Disk",
        prefetchChunks: [
            0, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
            26, 27, 28, 29, 30, 32, 33, 34, 35, 36, 39, 40, 42, 45, 46, 47, 48,
            49, 50, 51, 59, 60, 61, 64, 65, 66, 67, 68, 69, 71, 72, 74, 75, 76,
            77, 79, 80, 81, 82, 83, 84, 85, 102, 105, 106, 107, 108, 109, 110,
            111, 112, 159, 399,
        ],
        bezelStyle: "Beige",
        ...system753HdManifest,
    },
    "system7-ppc.app": {
        baseUrl: "/Disk",
        prefetchChunks: [
            0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 29, 30,
            31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 55,
            56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 71, 72, 73, 74, 75,
            76, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94,
            95, 96, 97, 98, 99, 101, 104, 105, 106, 109, 110, 111, 113, 114,
            118, 120, 121, 122, 123, 126, 127, 128, 129, 130, 132, 133, 135,
            136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148,
            149, 399,
        ],
        ppc: true,
        oldWorld: true,
        bezelStyle: "Platinum",
        ...system753PpcHdManifest,
    },
    "kanjitalk7.app": {
        baseUrl: "/Disk",
        prefetchChunks: [
            0, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 27,
            28, 29, 30, 31, 32, 33, 34, 35, 43, 44, 45, 46, 47, 49, 50, 51, 52,
            54, 62, 63, 64, 65, 66, 67, 69, 70, 71, 72, 73, 76, 77, 78, 79, 80,
            81, 82, 83, 84, 85, 89, 90, 94, 114, 116, 142, 147, 159, 161, 168,
            169, 170, 171, 172, 174, 175, 176, 177, 179, 180, 181, 182, 183,
            185, 186, 187, 189, 190, 191, 192, 193, 194, 195, 196, 197, 399,
        ],
        bezelStyle: "Beige",
        ...kanjiTalk753HdManifest,
    },
    "macos8.app": {
        baseUrl: "/Disk",
        prefetchChunks: [
            0, 22, 23, 24, 27, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 42, 43,
            44, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61,
            63, 64, 65, 66, 67, 68, 69, 71, 72, 73, 74, 75, 76, 79, 80, 81, 82,
            83, 84, 86, 87, 88, 89, 90, 98, 99, 100, 101, 102, 103, 104, 105,
            106, 107, 108, 109, 110, 117, 118, 119, 120, 121, 122, 123, 124,
            125, 126, 127, 128, 129, 130, 131, 132, 133, 138, 139, 142, 143,
            144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 156, 157,
            158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 169, 170, 173,
            175,
        ],
        bezelStyle: "Platinum",
        ...macos81HdManifest,
    },
    "macos9.app": {
        baseUrl: "/Disk",
        prefetchChunks: [
            0, 17, 21, 22, 25, 43, 44, 45, 46, 48, 49, 51, 52, 53, 55, 56, 57,
            58, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 72, 73, 75, 76, 79, 80,
            81, 82, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 98, 99, 100,
            102, 103, 104, 105, 106, 107, 109, 111, 112, 113, 115, 117, 118,
            119, 121, 122, 123, 124, 126, 127, 136, 137, 138, 139, 143, 144,
            145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157,
            158, 159, 160, 161, 162, 163, 164, 172, 173, 174, 175, 176, 177,
            178, 179, 180, 182, 186, 187, 188, 190, 191, 192, 193, 194, 195,
            196, 197, 212, 213, 216, 217, 218, 219, 221, 243, 244, 245, 246,
            247, 248, 249, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259,
            260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272,
            273, 274, 275, 276, 277, 283, 284, 285, 286, 287, 289, 291, 292,
            293, 294, 295, 296, 297, 298, 299, 300, 307, 308, 309, 310, 311,
            312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 326, 330,
            331, 332, 333, 334, 336, 337, 338, 339, 340, 341, 342, 343, 344,
            345, 346, 347, 348, 350, 351, 352, 356, 357, 358, 359, 360, 362,
            363, 364, 365, 366, 367, 368, 369, 370,
        ],
        ppc: true,
        bezelStyle: "Pinstripes",
        ...macos904HdManifest,
    },
};
