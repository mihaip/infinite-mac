import React, {useEffect, useState, useRef} from "react";
import "./Mac.css";
import basiliskPrefsPath from "./Data/BasiliskIIPrefs.txt";
import quadraRomPath from "./Data/Quadra-650.rom";
import system753HdManifest from "./Data/System 7.5.3 HD.dsk.json";
import macos81HdManifest from "./Data/Mac OS 8.1 HD.dsk.json";
import {Emulator} from "./BasiliskII/emulator-ui";
import {isDiskImageFile} from "./BasiliskII/emulator-common";

const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

export function Mac() {
    const screenRef = useRef<HTMLCanvasElement>(null);
    const [emulatorLoaded, setEmulatorLoaded] = useState(false);
    const [scale, setScale] = useState<number | undefined>(undefined);
    const [emulatorLoadingProgress, setEmulatorLoadingProgress] = useState([
        0, 0,
    ]);
    const [emulatorLoadingDiskChunk, setEmulatorLoadingDiskChunk] =
        useState(false);
    const [uploadingDiskImage, setUploadingDiskImage] = useState(false);
    const [hasPendingDiskImage, setHasPendingDiskImage] = useState(false);
    // Don't clear the loading state immediately, to make it clearer that I/O
    // is happening and things may be slow.
    const finishLoadingDiskChunkTimeoutRef = useRef<number>(0);
    const emulatorRef = useRef<Emulator>();
    useEffect(() => {
        document.addEventListener("fullscreenchange", handleFullScreenChange);
        document.addEventListener(
            "webkitfullscreenchange",
            handleFullScreenChange
        );
        const searchParams = new URLSearchParams(location.search);
        const useMacos8 =
            searchParams.has("macos8") || location.host === "macos8.app";
        // prefetchChunks are semi-automatically generated -- we will get a
        // warning via validateSpecPrefetchChunks() if these are incorrect.
        const disk = useMacos8
            ? {
                  baseUrl: "/Disk",
                  prefetchChunks: [
                      0, 3021, 3022, 3025, 3026, 3028, 3029, 3030, 3031, 3032,
                      3033, 3034, 3035, 3038, 3039, 3040, 3041, 3042, 3044,
                      3045, 3046, 3047, 3048, 3049, 3050, 3051, 3052, 3053,
                      3054, 3055, 3056, 3057, 3058, 3060, 3061, 3062, 3063,
                      3064, 3065, 3066, 3067, 3068, 3069, 3070, 3071, 3072,
                      3073, 3074, 3076, 3078, 3079, 3080, 3081, 3082, 3083,
                      3084, 3092, 3093, 3094, 3095, 3096, 3097, 3098, 3099,
                      3100, 3101, 3110, 3111, 3113, 3114, 3115, 3116, 3117,
                      3118, 3119, 3120, 3121, 3122, 3123, 3124, 3125, 3126,
                      3128, 3129, 3130, 3131, 3132, 3133, 3134, 3135, 3136,
                      3137, 3138, 3139, 3141, 3145, 3148, 3149,
                  ],
                  ...macos81HdManifest,
              }
            : {
                  baseUrl: "/Disk",
                  prefetchChunks: [
                      0, 1, 3014, 3015, 3016, 3017, 3018, 3019, 3020, 3021,
                      3022, 3023, 3024, 3025, 3026, 3027, 3028, 3029, 3030,
                      3031, 3033, 3034, 3035, 3036, 3037, 3038, 3039, 3040,
                      3041, 3045, 3046, 3047, 3048, 3049, 3050, 3052, 3053,
                      3054, 3059, 3060, 3061, 3062, 3063, 3065, 3066, 3067,
                      3068, 3069, 3070, 3071, 3074, 3075, 3076, 3077, 3078,
                      3079, 3080, 3083, 3084,
                  ],
                  ...system753HdManifest,
              };
        const emulator = new Emulator(
            {
                useSharedMemory:
                    typeof SharedArrayBuffer !== "undefined" &&
                    searchParams.get("use_shared_memory") !== "false",
                screenWidth: SCREEN_WIDTH,
                screenHeight: SCREEN_HEIGHT,
                screenCanvas: screenRef.current!,
                basiliskPrefsPath,
                romPath: quadraRomPath,
                disk,
            },
            {
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
        const isFullScreen = Boolean(
            document.fullscreenElement || document.webkitFullscreenElement
        );

        if (isFullScreen) {
            navigator.keyboard?.lock?.();
        }

        document.body.classList.toggle("fullscreen", isFullScreen);
        if (isFullScreen) {
            const heightScale = window.screen.availHeight / SCREEN_HEIGHT;
            const widthScale = window.screen.availWidth / SCREEN_WIDTH;
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

    return (
        <div
            className="Mac"
            style={{
                width: `calc(${SCREEN_WIDTH}px + 2 * var(--screen-underscan))`,
                height: `calc(${SCREEN_HEIGHT}px + 2 * var(--screen-underscan))`,
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
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
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
        </div>
    );
}
