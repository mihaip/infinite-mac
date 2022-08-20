import React, {useEffect, useState, useRef} from "react";
import "./Mac.css";
import basiliskPrefsPath from "./Data/BasiliskIIPrefs.txt";
import quadraRomPath from "./Data/Quadra-650.rom";
import system753HdManifest from "./Data/System 7.5.3 HD.dsk.json";
import kanjiTalk753HdManifest from "./Data/KanjiTalk 7.5.3 HD.dsk.json";
import macos81HdManifest from "./Data/Mac OS 8.1 HD.dsk.json";
import infiniteHdManifest from "./Data/Infinite HD.dsk.json";
import type {
    EmulatorEthernetProvider,
    EmulatorEthernetPeer,
} from "./BasiliskII/emulator-ui";
import {Emulator} from "./BasiliskII/emulator-ui";
import type {EmulatorChunkedFileSpec} from "./BasiliskII/emulator-common";
import {isDiskImageFile} from "./BasiliskII/emulator-common";
import {BroadcastChannelEthernetProvider} from "./BroadcastChannelEthernetProvider";
import {CloudflareWorkerEthernetProvider} from "./CloudflareWorkerEthernetProvider";

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
    useEffect(() => {
        document.addEventListener("fullscreenchange", handleFullScreenChange);
        document.addEventListener(
            "webkitfullscreenchange",
            handleFullScreenChange
        );
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
        // prefetchChunks are semi-automatically generated -- we will get a
        // warning via validateSpecPrefetchChunks() if these are incorrect.
        const disk = DISKS_BY_DOMAIN[domain] ?? DISKS_BY_DOMAIN["system7.app"];
        const libraryDisk = {
            baseUrl: "/Disk",
            prefetchChunks: [0],
            ...infiniteHdManifest,
        };
        if (!ethernetProvider && searchParams.get("ethernet")) {
            const zoneName = searchParams.get("ethernet_zone");
            ethernetProvider = zoneName
                ? new CloudflareWorkerEthernetProvider(zoneName)
                : new BroadcastChannelEthernetProvider();
        }
        const emulator = new Emulator(
            {
                useSharedMemory:
                    typeof SharedArrayBuffer !== "undefined" &&
                    searchParams.get("use_shared_memory") !== "false",
                screenWidth: INITIAL_RESOLUTION.width,
                screenHeight: INITIAL_RESOLUTION.height,
                screenCanvas: screenRef.current!,
                basiliskPrefsPath,
                romPath: quadraRomPath,
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
    }, []);

    const handleAppleLogoClick = () => {
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
    let bezelClass = "";
    const availableSpace = window.innerWidth - screenWidth;
    if (availableSpace < SMALL_BEZEL_THRESHOLD) {
        bezelClass = "Mac-Small-Bezel";
    } else if (availableSpace < MEDIUM_BEZEL_THRESHOLD) {
        bezelClass = "Mac-Medium-Bezel";
    }

    return (
        <div
            className={`Mac ${bezelClass}`}
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
            <div className="Mac-Apple-Logo" onClick={handleAppleLogoClick} />
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
            <div className="Mac-Ethernet-Status-Text" data-text={text}>
                {text}
            </div>
            {details}
        </div>
    );
}

const DISKS_BY_DOMAIN: {[domain: string]: EmulatorChunkedFileSpec} = {
    "system7.app": {
        baseUrl: "/Disk",
        prefetchChunks: [
            0, 3, 6, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
            24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35, 38, 39, 41, 44, 45, 46,
            47, 48, 49, 50, 51, 52, 54, 55, 56, 57, 58, 59, 61, 62, 65, 66, 68,
            69, 70, 71, 72, 73, 74, 75, 92, 93, 95, 96, 97, 98, 99, 100, 101,
            165, 166,
        ],
        ...system753HdManifest,
    },
    "kanjitalk7.app": {
        baseUrl: "/Disk",
        prefetchChunks: [
            0, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22,
            26, 27, 28, 29, 30, 31, 32, 33, 34, 42, 44, 45, 46, 48, 49, 50, 51,
            53, 61, 62, 63, 64, 65, 66, 68, 69, 70, 71, 72, 75, 76, 77, 78, 79,
            80, 81, 82, 83, 84, 89, 90, 94, 114, 116, 142, 146, 147, 158, 159,
            161, 167, 169, 170, 171, 172, 174, 175, 176, 177, 179, 180, 181,
            182, 183, 184, 185, 186, 187, 189, 190, 191, 192, 193, 194, 195,
            203,
        ],
        ...kanjiTalk753HdManifest,
    },
    "macos8.app": {
        baseUrl: "/Disk",
        prefetchChunks: [
            0, 3, 6, 12, 13, 14, 17, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32,
            33, 34, 35, 36, 37, 38, 39, 40, 41, 43, 44, 45, 46, 48, 49, 50, 51,
            52, 53, 54, 56, 57, 58, 59, 60, 62, 63, 64, 65, 66, 67, 69, 70, 71,
            72, 73, 74, 75, 77, 78, 79, 80, 81, 82, 84, 85, 86, 87, 88, 89, 90,
            91, 92, 99, 100, 101, 103, 104, 106, 107, 108, 109, 110, 111, 112,
            113, 114, 115, 120, 121, 124, 125, 126, 127, 128, 129, 130, 131,
            132, 133, 134, 135, 136, 138, 139, 140, 141, 142, 143, 144, 145,
            146, 147, 148, 149, 150, 151, 152, 172, 173,
        ],
        ...macos81HdManifest,
    },
};
