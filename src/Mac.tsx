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
                      0, 1134, 1135, 1138, 1141, 1142, 1143, 1144, 1145, 1146,
                      1147, 1148, 1150, 1151, 1152, 1153, 1154, 1156, 1157,
                      1158, 1159, 1160, 1161, 1162, 1163, 1164, 1165, 1166,
                      1167, 1168, 1170, 1171, 1172, 1173, 1175, 1176, 1177,
                      1178, 1179, 1181, 1182, 1183, 1184, 1185, 1187, 1188,
                      1189, 1190, 1191, 1192, 1193, 1194, 1195, 1202, 1203,
                      1204, 1205, 1206, 1207, 1208, 1209, 1210, 1217, 1219,
                      1220, 1221, 1222, 1223, 1224, 1225, 1226, 1227, 1228,
                      1229, 1230, 1231, 1233, 1234, 1235, 1236, 1237, 1238,
                      1239, 1240, 1241, 1242, 1243, 1244, 1245, 1246, 1250,
                      1251,
                  ],
                  ...macos81HdManifest,
              }
            : {
                  baseUrl: "/Disk",
                  prefetchChunks: [
                      0, 1, 1126, 1127, 1128, 1129, 1130, 1131, 1132, 1133,
                      1134, 1135, 1136, 1137, 1138, 1139, 1140, 1141, 1142,
                      1143, 1144, 1145, 1146, 1147, 1148, 1149, 1150, 1151,
                      1152, 1155, 1156, 1157, 1158, 1159, 1160, 1161, 1162,
                      1166, 1167, 1168, 1169, 1170, 1171, 1172, 1173, 1174,
                      1175, 1176, 1177, 1180, 1181, 1182, 1183, 1184, 1185,
                      1186, 1187,
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
                style={{
                    pointerEvents: hasDrag ? "none" : undefined,
                }}
                ref={screenRef}
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                onContextMenu={e => e.preventDefault()}
            />
            {progress}
            {hasDrag && <div className="Mac-Drag-Overlay" />}
        </div>
    );
}
