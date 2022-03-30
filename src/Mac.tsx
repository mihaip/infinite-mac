import {useEffect, useState, useRef} from "react";
import "./Mac.css";
import basiliskPrefsPath from "./Data/BasiliskIIPrefs.txt";
import quadraRomPath from "./Data/Quadra-650.rom";
import system753HdManifest from "./Data/System 7.5.3 HD.dsk.json";
import macos81HdManifest from "./Data/Mac OS 8.1 HD.dsk.json";
import {Emulator} from "./BasiliskII/emulator-ui";

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
                      0, 2817, 2818, 2819, 2821, 2822, 2825, 2826, 2827, 2828,
                      2829, 2830, 2831, 2834, 2835, 2836, 2837, 2838, 2840,
                      2841, 2842, 2843, 2844, 2845, 2846, 2847, 2848, 2850,
                      2851, 2852, 2853, 2854, 2856, 2857, 2858, 2859, 2860,
                      2861, 2862, 2863, 2864, 2866, 2867, 2868, 2869, 2870,
                      2872, 2874, 2875, 2876, 2877, 2878, 2879, 2880, 2888,
                      2889, 2890, 2891, 2892, 2894, 2895, 2905, 2906, 2908,
                      2909, 2910, 2912, 2913, 2914, 2915, 2916, 2917, 2918,
                      2919, 2920, 2921, 2923, 2924, 2925, 2926, 2927, 2928,
                      2929, 2930, 2931, 2932, 2933, 2934, 2935, 2936, 2940,
                      2944,
                  ],
                  ...macos81HdManifest,
              }
            : {
                  baseUrl: "/Disk",
                  prefetchChunks: [
                      0, 1, 2810, 2811, 2812, 2813, 2814, 2815, 2816, 2817,
                      2818, 2819, 2820, 2821, 2822, 2823, 2824, 2825, 2826,
                      2827, 2829, 2830, 2831, 2832, 2833, 2834, 2835, 2836,
                      2837, 2840, 2841, 2842, 2843, 2844, 2845, 2847, 2848,
                      2849, 2854, 2855, 2856, 2857, 2858, 2859, 2861, 2862,
                      2863, 2864, 2865, 2866, 2868, 2869, 2870, 2871, 2872,
                      2873, 2874, 2875, 2878, 2879, 4095,
                  ],
                  ...system753HdManifest,
              };
        const emulator = new Emulator(
            {
                useTouchEvents: "ontouchstart" in window,
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
            const heightScale = window.screen.height / SCREEN_HEIGHT;
            const widthScale = window.screen.width / SCREEN_WIDTH;
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
    function handleDrop(event: React.DragEvent) {
        event.preventDefault();
        setDragCount(0);
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
                transform: scale === undefined ? undefined : `scale(${scale})`,
            }}
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
            {dragCount > 0 && <div className="Mac-Drag-Overlay" />}
        </div>
    );
}
