import {useEffect, useState, useRef} from "react";
import "./Mac.css";
import basiliskPrefsPath from "./Data/BasiliskIIPrefs.txt";
import quadraRomPath from "./Data/Quadra-650.rom.br";
import macintoshHdManifest from "./Data/Macintosh HD.dsk.json";
import {Emulator} from "./BasiliskII/emulator-ui";

const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

export function Mac() {
    const screenRef = useRef<HTMLCanvasElement>(null);
    const [emulatorLoaded, setEmulatorLoaded] = useState(false);
    const [emulatorLoadingProgress, setEmulatorLoadingProgress] = useState([
        0, 0,
    ]);
    const [emulatorLibraryFileLoading, setEmulatorLibraryFileLoading] =
        useState<string | undefined>(undefined);
    const [
        emulatorLibraryFileLoadingProgress,
        setEmulatorLibraryFileLoadingProgress,
    ] = useState([0, 0]);
    const emulatorRef = useRef<Emulator>();
    useEffect(() => {
        document.addEventListener("fullscreenchange", handleFullScreenChange);
        document.addEventListener(
            "webkitfullscreenchange",
            handleFullScreenChange
        );
        const searchParams = new URLSearchParams(location.search);
        const emulator = new Emulator(
            {
                useTouchEvents: "ontouchstart" in window,
                useSharedMemory:
                    typeof SharedArrayBuffer !== "undefined" &&
                    searchParams.get("use_shared_memory") !== "false",
                enableExtractor: searchParams.get("extractor") === "true",
                screenWidth: SCREEN_WIDTH,
                screenHeight: SCREEN_HEIGHT,
                screenCanvas: screenRef.current!,
                basiliskPrefsPath,
                romPath: quadraRomPath,
                disk: {
                    baseUrl: "/Disk/Macintosh HD.dsk",
                    prefetchChunks: [
                        // Semi-automatically generated -- we will get a warning
                        // via validateSpecPrefetchChunks() if these are
                        // incorrect.
                        0, 3, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34,
                        35, 36, 37, 38, 39, 41, 42, 43, 44, 45, 46, 47, 48, 50,
                        51, 52, 53, 54, 55, 56, 57, 58, 60, 61, 62, 63, 64, 66,
                        67, 68, 69, 70, 71, 73, 74, 75, 76, 77, 78, 79, 128,
                        129,
                    ],
                    ...macintoshHdManifest,
                },
            },
            {
                emulatorDidDidFinishLoading(emulator: Emulator) {
                    setEmulatorLoaded(true);
                },
                emulatorDidMakeLoadingProgress(
                    emulator: Emulator,
                    total: number,
                    left: number
                ) {
                    setEmulatorLoadingProgress([total, left]);
                },
                emulatorDidDidStartLoadingLibraryFile(
                    emulator: Emulator,
                    name: string
                ) {
                    setEmulatorLibraryFileLoading(name);
                    setEmulatorLibraryFileLoadingProgress([0, 0]);
                },
                emulatorDidDidMakeProgressLoadingLibraryFile(
                    emulator: Emulator,
                    name: string,
                    totalBytes: number,
                    bytesReceived: number
                ) {
                    setEmulatorLibraryFileLoadingProgress([
                        totalBytes,
                        bytesReceived,
                    ]);
                },
                emulatorDidDidFinishLoadingLibraryFile(
                    emulator: Emulator,
                    name: string
                ) {
                    setEmulatorLibraryFileLoading(undefined);
                },
            }
        );
        emulatorRef.current = emulator;
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
        document.body.classList.toggle(
            "fullscreen",
            Boolean(
                document.fullscreenElement || document.webkitFullscreenElement
            )
        );
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

    let libraryFileProgress;
    if (emulatorLibraryFileLoading) {
        const [totalBytes, bytesReceived] = emulatorLibraryFileLoadingProgress;
        let fraction;
        const numberFormat = new Intl.NumberFormat();
        function formatKb(bytes: number): string {
            return numberFormat.format(Math.round(bytes / 1024));
        }
        if (totalBytes !== -1) {
            fraction = (
                <span className="Mac-Loading-Library-Fraction">
                    ({formatKb(bytesReceived)}/{formatKb(totalBytes)}KB)
                </span>
            );
        } else {
            fraction = (
                <span className="Mac-Loading-Library-Fraction">
                    ({formatKb(bytesReceived)}KB)
                </span>
            );
        }
        libraryFileProgress = (
            <div className="Mac-Loading-Library">
                Loading {emulatorLibraryFileLoading}…{fraction}
            </div>
        );
    }

    const [hasDrag, setHasDrag] = useState(false);
    function handleDragOver(event: React.DragEvent) {
        event.preventDefault();
    }
    function handleDragEnter(event: React.DragEvent) {
        setHasDrag(true);
    }
    function handleDragLeave(event: React.DragEvent) {
        setHasDrag(false);
    }
    function handleDrop(event: React.DragEvent) {
        event.preventDefault();
        setHasDrag(false);
        if (event.dataTransfer.items) {
            for (const item of event.dataTransfer.items) {
                if (item.kind === "file") {
                    emulatorRef.current?.uploadFile(item.getAsFile()!);
                }
            }
        } else if (event.dataTransfer.files) {
            for (const file of event.dataTransfer.files) {
                emulatorRef.current?.uploadFile(file);
            }
        }
    }

    return (
        <div
            className="Mac"
            style={{
                width: `calc(${SCREEN_WIDTH}px + 2 * var(--screen-underscan))`,
                height: `calc(${SCREEN_HEIGHT}px + 2 * var(--screen-underscan))`,
            }}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}>
            <div className="Mac-Apple-Logo" onClick={handleAppleLogoClick} />
            <div className="Mac-Led" />
            <canvas
                className="Mac-Screen"
                style={{
                    pointerEvents: hasDrag ? "none" : undefined,
                }}
                ref={screenRef}
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                onContextMenu={e => e.preventDefault()}
            />
            {progress}
            {libraryFileProgress}
            {hasDrag && <div className="Mac-Drag-Overlay" />}
        </div>
    );
}
