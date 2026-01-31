import React, {useEffect, useState, useRef, useCallback, useMemo} from "react";
import "@/app/Mac.css";
import {
    type EmulatorEthernetProvider,
    type EmulatorEthernetPeer,
    Emulator,
} from "@/emulator/ui/ui";
import {DEFAULT_EMULATOR_SETTINGS} from "@/emulator/ui/settings";
import {type EmulatorCDROM, isDiskImageFile} from "@/emulator/common/common";
import {useDevicePixelRatio} from "@/lib/useDevicePixelRatio";
import {usePersistentState} from "@/lib/usePersistentState";
import * as varz from "@/lib/varz";
import {
    type ScreenControl,
    type ScreenFrameProps,
    ScreenFrame,
} from "@/controls/ScreenFrame";
import {MacKeyboard, useMacKeyboard} from "@/app/MacKeyboard";
import {Dialog} from "@/controls/Dialog";
import {
    type EmulatorDiskDef,
    INFINITE_HD,
    INFINITE_HD_MFS,
    INFINITE_HD_NEXT,
    INFINITE_HD6,
    INFINITE_HDX,
    SAVED_HD,
    THE_OUTSIDE_WORLD,
} from "@/defs/disks";
import {type MachineDef, DEFAULT_SUPPORTED_SCREEN_SIZES} from "@/defs/machines";
import classNames from "classnames";
import {MacCDROMs} from "@/app/MacCDROMs";
import {getCDROMInfo} from "@/defs/cdroms";
import {canSaveDisks} from "@/lib/canSaveDisks";
import {MacSettings} from "@/app/MacSettings";
import {
    exportDiskSaver,
    importDiskSaver,
    resetDiskSaver,
    saveDiskSaverImage,
} from "@/emulator/ui/disk-saver";
import {
    emulatorNeedsMouseDeltas,
    emulatorNeedsTheOutsideWorldDisk,
    emulatorSupportsCDROMs,
    emulatorSupportsDownloadsFolder,
} from "@/emulator/common/emulators";
import {type RunDef, type ScreenSize} from "@/defs/run-def";
import {viewTransitionNameForDisk} from "@/lib/view-transitions";
import {DrawersContainer} from "@/controls/Drawer";
import {
    handleLibraryURL,
    MacLibrary,
    preloadMacLibraryContents,
} from "@/app/MacLibrary";
import {
    type EmbedNotificationEvent,
    type EmbedControlEvent,
} from "@/embed-types";

export type MacProps = {
    runDef: RunDef;
    cdroms: EmulatorCDROM[];
    initialErrorText?: string;
    onDone: () => void;
};

export default function Mac({
    runDef,
    cdroms,
    initialErrorText,
    onDone,
}: MacProps) {
    const {
        disks,
        includeInfiniteHD,
        includeSavedHD,
        includeLibrary,
        libraryDownloadURLs,
        diskFiles,
        machine,
        ramSize,
        screenSize: screenSizeProp,
        screenScale: screenScaleProp,
        screenUpdateMessages,
        isEmbed,
        ethernetProvider,
        debugFallback,
        debugPaused,
        flags,
        settings: fixedEmulatorSettings,
    } = runDef;
    const screenRef = useRef<HTMLCanvasElement>(null);
    const [emulatorLoaded, setEmulatorLoaded] = useState(false);
    const [scale, setScale] = useState<number | undefined>(screenScaleProp);
    const [fullscreen, setFullscreen] = useState(false);
    const [emulatorLoadingProgress, setEmulatorLoadingProgress] = useState([
        0, 0,
    ]);
    const [emulatorFileLoadingProgress, setEmulatorFileLoadingProgress] =
        useState<{fraction: number; name: string; linger?: boolean}>({
            name: "",
            fraction: 1.0,
        });
    const [emulatorLoadingDiskChunk, setEmulatorLoadingDiskChunk] =
        useState(false);
    const [emulatorErrorText, setEmulatorErrorText] =
        useState(initialErrorText);
    const [ethernetPeers, setEthernetPeers] = useState<
        readonly EmulatorEthernetPeer[]
    >([]);
    // Don't clear the loading state immediately, to make it clearer that I/O
    // is happening and things may be slow.
    const finishLoadingDiskChunkTimeoutRef = useRef<number>(0);
    const emulatorRef = useRef<Emulator>();
    const ethernetProviderRef = useRef<EmulatorEthernetProvider>();

    const onEmulatorSettingsChange = useCallback(() => {
        emulatorRef.current?.refreshSettings();
    }, []);
    // Hacky way to have a conditional hook without violating the rules of hooks
    // (in practice the fixedEmulatorSettings prop never changes, so this is fine).
    const useEmulatorSettingsHook = fixedEmulatorSettings
        ? () => [fixedEmulatorSettings, () => {}] as const
        : usePersistentState;
    const [emulatorSettings, setEmulatorSettings] = useEmulatorSettingsHook(
        DEFAULT_EMULATOR_SETTINGS,
        "emulator-settings",
        onEmulatorSettingsChange
    );
    const emulatorSettingsRef = useRef(emulatorSettings);
    emulatorSettingsRef.current = emulatorSettings;

    const initialScreenSize = useMemo(
        () =>
            computeInitialScreenSize(machine, screenSizeProp, screenScaleProp),
        [machine, screenSizeProp, screenScaleProp]
    );
    const {width: initialScreenWidth, height: initialScreenHeight} =
        initialScreenSize;
    const [screenSize, setScreenSize] = useState(initialScreenSize);
    const {width: screenWidth, height: screenHeight} = screenSize;

    const hasSavedHD = includeSavedHD && canSaveDisks();
    const listenForControlMessages = Boolean(isEmbed);

    const handleMacLibraryProgress = useCallback(
        (name: string, fraction: number) => {
            setEmulatorFileLoadingProgress({
                name,
                fraction,
            });
        },
        []
    );
    const handleMacLibraryRun = useCallback((file: File) => {
        const emulator = emulatorRef.current;
        if (emulator) {
            setEmulatorFileLoadingProgress({
                name: file.name,
                fraction: 1.0,
                linger: true,
            });
            uploadFiles(emulator, [file], undefined, {fromLibrary: true});
            setTimeout(
                () =>
                    setEmulatorFileLoadingProgress({
                        name: file.name,
                        fraction: 1.0,
                    }),
                1000
            );
        }
    }, []);

    const {emulatorType} = machine;
    const canLoadFiles =
        emulatorSupportsDownloadsFolder(emulatorType, flags) ||
        emulatorSupportsCDROMs(emulatorType);

    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;

    useEffect(() => {
        const emulatorDisks: EmulatorDiskDef[] = [...disks];
        const delayedDisks: EmulatorDiskDef[] = [];
        if (includeInfiniteHD) {
            let infiniteHd;
            if (machine.platform === "NeXT") {
                infiniteHd = INFINITE_HD_NEXT;
            } else if (
                disks[0]?.infiniteHdSubset === "mfs" ||
                machine.mfsOnly
            ) {
                infiniteHd = INFINITE_HD_MFS;
            } else if (
                disks[0]?.infiniteHdSubset === "system6" ||
                (disks.length === 0 && emulatorType === "Mini vMac")
            ) {
                infiniteHd = INFINITE_HD6;
            } else if (disks[0]?.infiniteHdSubset === "macosx") {
                infiniteHd = INFINITE_HDX;
            } else {
                infiniteHd = INFINITE_HD;
            }
            if (
                disks[0]?.delayAdditionalDiskMount &&
                emulatorType === "Mini vMac"
            ) {
                delayedDisks.push(infiniteHd);
            } else {
                emulatorDisks.push(infiniteHd);
            }
        }
        if (hasSavedHD && !machine.mfsOnly) {
            emulatorDisks.push(SAVED_HD);
        }
        if (emulatorNeedsTheOutsideWorldDisk(emulatorType, flags)) {
            emulatorDisks.push(THE_OUTSIDE_WORLD);
        }
        const hasSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
        if (!hasSharedArrayBuffer) {
            console.warn(
                "SharedArrayBuffer is not available, fallback more will be used. Performance may be degraded."
            );
        }
        const useSharedMemory = hasSharedArrayBuffer && !debugFallback;
        const sendEmbedNotification = (event: EmbedNotificationEvent) => {
            window.parent.postMessage(event, "*");
        };

        const emulator = new Emulator(
            {
                machine,
                ramSize,
                useSharedMemory,
                screenWidth: initialScreenWidth,
                screenHeight: initialScreenHeight,
                screenCanvas: screenRef.current!,
                disks: emulatorDisks,
                diskFiles: diskFiles.map(df => ({
                    name: df.file.name,
                    url: URL.createObjectURL(df.file),
                    size: df.file.size,
                    isCDROM: df.treatAsCDROM,
                    hasDeviceImageHeader: df.hasDeviceImageHeader,
                })),
                delayedDisks,
                cdroms,
                ethernetProvider,
                flags,
            },
            {
                emulatorDidExit(emulator: Emulator) {
                    onDoneRef.current();
                },
                emulatorDidChangeScreenSize(width, height) {
                    setScreenSize({width, height});
                },
                emulatorDidFinishLoading(emulator: Emulator) {
                    setEmulatorLoaded(true);
                    emulator.refreshSettings();
                    if (emulatorSupportsDownloadsFolder(emulatorType, flags)) {
                        libraryDownloadURLs.forEach(url =>
                            handleLibraryURL(
                                url,
                                handleMacLibraryRun,
                                handleMacLibraryProgress
                            )
                        );
                    }
                    if (listenForControlMessages) {
                        sendEmbedNotification({type: "emulator_loaded"});
                    }
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
                emulatorDidBecomeQuiescent(emulator: Emulator) {
                    // Preload the library once we know it won't compete with
                    // the emulator boot for network resources.
                    preloadMacLibraryContents();
                },
                emulatorEthernetPeersDidChange(emulator, peers) {
                    if (ethernetProvider) {
                        setEthernetPeers(peers);
                    }
                },
                emulatorDidRunOutOfMemory(emulator: Emulator) {
                    varz.increment("emulator_error:out_of_memory");
                    setEmulatorErrorText(
                        "The emulator ran out of memory.\n\nIf you are running it in a mobile app's in-app browser, try switching to the native browser (Safari or Chrome) on your device."
                    );
                },
                emulatorDidHaveError(
                    emulator: Emulator,
                    error: string,
                    errorRaw: string
                ) {
                    if (error.includes("load") && error.includes("/CD-ROM")) {
                        varz.incrementError(
                            "emulator_error:cdrom_chunk_load",
                            errorRaw
                        );
                    } else if (error.includes("saved disk")) {
                        if (error.includes("missing the necessary APIs")) {
                            varz.incrementError(
                                "emulator_error:saved_disk_unsupported",
                                errorRaw
                            );
                        } else {
                            varz.incrementError(
                                "emulator_error:saved_disk",
                                errorRaw
                            );
                        }
                    } else {
                        varz.incrementError(
                            `emulator_error:${emulatorType}:other`,
                            errorRaw
                        );
                    }
                    setEmulatorErrorText(
                        `The emulator encountered an error:\n\n${error}`
                    );
                },
                emulatorSettings(emulator) {
                    return emulatorSettingsRef.current;
                },
                emulatorDidMakeCDROMLoadingProgress(emulator, cdrom, fraction) {
                    setEmulatorFileLoadingProgress({name: "CD-ROM", fraction});
                },
                emulatorDidDrawScreen(emulator, imageData) {
                    if (screenUpdateMessages) {
                        const data = imageData.data;
                        // Make sure the alpha channel is fully opaque.
                        for (let i = 3; i < data.length; i += 4) {
                            data[i] = 255;
                        }
                        sendEmbedNotification({
                            type: "emulator_screen",
                            data,
                            width: imageData.width,
                            height: imageData.height,
                        });
                    }
                },
            }
        );
        emulatorRef.current = emulator;
        ethernetProviderRef.current = ethernetProvider;
        if (!debugPaused) {
            emulator.start();
        }

        const startVarz = {
            "emulator_starts": 1,
            "emulator_embedded": screenSizeProp === "embed" ? 1 : 0,
            "emulator_ethernet": ethernetProvider ? 1 : 0,
            [`emulator_type:${emulatorType}`]: 1,

            "emulator_shared_memory": useSharedMemory ? 1 : 0,
        };
        if (disks.length === 1) {
            const disk = disks[0];
            startVarz[
                `emulator_disk:${disk.displayName}${
                    disk.displaySubtitle ? "-" + disk.displaySubtitle : ""
                }`
            ] = 1;
        }
        varz.incrementMulti(startVarz);

        let messageListener: (e: MessageEvent) => void;
        if (listenForControlMessages) {
            messageListener = e => {
                if (e.source !== window.parent || window.parent === window) {
                    return;
                }
                const event = e.data as EmbedControlEvent;
                switch (event.type) {
                    case "emulator_pause":
                        emulator.pause();
                        break;
                    case "emulator_unpause":
                        emulator.unpause();
                        break;
                    case "emulator_mouse_move": {
                        const {x, y, deltaX, deltaY} = event;
                        emulator.handleExternalInput({
                            type: "mousemove",
                            x,
                            y,
                            deltaX,
                            deltaY,
                        });
                        break;
                    }
                    case "emulator_mouse_down":
                        emulator.handleExternalInput({
                            type: "mousedown",
                            button: event.button,
                        });
                        break;
                    case "emulator_mouse_up":
                        emulator.handleExternalInput({
                            type: "mouseup",
                            button: event.button,
                        });
                        break;
                    case "emulator_key_down":
                        emulator.handleExternalInput({
                            type: "keydown",
                            code: event.code,
                        });
                        break;
                    case "emulator_key_up":
                        emulator.handleExternalInput({
                            type: "keyup",
                            code: event.code,
                        });
                        break;
                    case "emulator_load_disk":
                        getCDROMInfo(event.url)
                            .then(cdrom => emulator.loadCDROM(cdrom))
                            .catch(err =>
                                console.error(
                                    "Could not load CD-ROM",
                                    event.url,
                                    err
                                )
                            );
                        break;
                    default:
                        console.warn("Unknown message from parent:", e.data);
                        break;
                }
            };
            window.addEventListener("message", messageListener);
        }

        return () => {
            emulator.stop();
            emulatorRef.current = undefined;
            ethernetProvider?.close?.();
            if (messageListener) {
                window.removeEventListener("message", messageListener);
            }
        };
    }, [
        disks,
        diskFiles,
        includeInfiniteHD,
        cdroms,
        machine,
        emulatorType,
        ethernetProvider,
        screenSizeProp,
        initialScreenWidth,
        initialScreenHeight,
        debugFallback,
        debugPaused,
        flags,
        hasSavedHD,
        ramSize,
        libraryDownloadURLs,
        handleMacLibraryRun,
        handleMacLibraryProgress,
        screenUpdateMessages,
        listenForControlMessages,
    ]);

    useEffect(() => {
        document.body.classList.toggle("embed", screenSizeProp === "embed");
    }, [screenSizeProp]);

    const handleFullScreenClick = () => {
        // Make the entire page go fullscreen (instead of just the screen
        // canvas) because iOS Safari does not maintain the aspect ratio of the
        // canvas.
        document.body.requestFullscreen();
    };
    const handleFullScreenChange = useCallback(() => {
        const isFullScreen = Boolean(
            document.fullscreenElement ?? document.webkitFullscreenElement
        );
        setFullscreen(isFullScreen);

        if (isFullScreen) {
            navigator.keyboard?.lock?.();
        }

        document.body.classList.toggle("fullscreen", isFullScreen);
        if (isFullScreen && screenSizeProp !== "fullscreen") {
            const heightScale =
                window.screen.availHeight / screenRef.current!.height;
            const widthScale =
                window.screen.availWidth / screenRef.current!.width;
            setScale(Math.min(heightScale, widthScale));
        } else {
            setScale(undefined);
        }
    }, [screenSizeProp]);
    useEffect(() => {
        document.addEventListener("fullscreenchange", handleFullScreenChange);
        document.addEventListener(
            "webkitfullscreenchange",
            handleFullScreenChange
        );
        return () => {
            document.removeEventListener(
                "fullscreenchange",
                handleFullScreenChange
            );
            document.removeEventListener(
                "webkitfullscreenchange",
                handleFullScreenChange
            );
        };
    }, [handleFullScreenChange]);

    const [settingsVisible, setSettingsVisible] = useState(false);
    const handleSettingsClick = () => {
        setSettingsVisible(true);
    };

    const {isKeyboardVisible, setIsKeyboardVisible} = useMacKeyboard();
    const handleKeyboardClick = () => {
        setIsKeyboardVisible(!isKeyboardVisible);
    };
    useEffect(() => {
        return () => setIsKeyboardVisible(false);
    }, [setIsKeyboardVisible]);

    const handleKeyDown = useCallback((code: string) => {
        emulatorRef.current?.handleExternalInput({
            type: "keydown",
            code,
        });
    }, []);

    const handleKeyUp = useCallback((code: string) => {
        emulatorRef.current?.handleExternalInput({
            type: "keyup",
            code,
        });
    }, []);
    const handleStartClick = () => {
        emulatorRef.current?.start();
    };

    let progress;
    if (!emulatorLoaded) {
        const [total, left] = emulatorLoadingProgress;
        if (total === 0 && left === 0 && debugPaused) {
            progress = (
                <div className="Mac-Loading">Waiting for manual start…</div>
            );
        } else {
            progress = (
                <div className="Mac-Loading">
                    Loading data files…
                    <span className="Mac-Loading-Fraction">
                        ({total - left}/{total})
                    </span>
                </div>
            );
        }
    }
    if (
        emulatorFileLoadingProgress &&
        (emulatorFileLoadingProgress.fraction < 1.0 ||
            emulatorFileLoadingProgress.linger)
    ) {
        progress = (
            <div
                className={classNames("Mac-Loading", {
                    "Mac-Loading-Non-Modal": emulatorLoaded,
                })}>
                {emulatorFileLoadingProgress.fraction < 1.0 ? (
                    <>
                        Loading {emulatorFileLoadingProgress.name}…
                        <span className="Mac-Loading-Fraction">
                            {(
                                emulatorFileLoadingProgress.fraction * 100
                            ).toFixed(0)}
                            %
                        </span>
                    </>
                ) : (
                    <>Loaded {emulatorFileLoadingProgress.name}</>
                )}
            </div>
        );
    }

    const [showMacOSXSlowNotification, clearMacOSXSlowNotification] =
        useTemporaryNotification(
            !progress &&
                emulatorLoaded &&
                disks[0]?.infiniteHdSubset === "macosx",
            "mac-os-x-slow-notification-count"
        );
    if (showMacOSXSlowNotification) {
        progress = (
            <div className="Mac-Loading Mac-Loading-Non-Modal Mac-Loading-OneLine">
                <span
                    className="Mac-Loading-Dismiss"
                    onClick={clearMacOSXSlowNotification}>
                    ⓧ
                </span>
                Mac OS X may take a minute or two to start up, please be
                patient.
            </div>
        );
    }

    const [mouseHasMoved, setMouseHasMoved] = useState(false);
    const [showPointerLockNotification, clearPointerLockNotification] =
        useTemporaryNotification(
            !progress &&
                emulatorLoaded &&
                mouseHasMoved &&
                emulatorNeedsMouseDeltas(emulatorType) &&
                !USING_TOUCH_INPUT,
            "pointer-lock-notification-count"
        );
    if (showPointerLockNotification) {
        progress = (
            <div className="Mac-Loading Mac-Loading-Non-Modal Mac-Loading-OneLine">
                <span
                    className="Mac-Loading-Dismiss"
                    onClick={clearPointerLockNotification}>
                    ⓧ
                </span>
                Click the screen to lock the mouse for full control.
            </div>
        );
    }
    const handlePointerMove = useCallback(() => {
        if (!mouseHasMoved) {
            setMouseHasMoved(true);
        }
    }, [mouseHasMoved]);
    const handlePointerDown = useCallback(() => {
        if (showPointerLockNotification) {
            clearPointerLockNotification();
        }
    }, [clearPointerLockNotification, showPointerLockNotification]);

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

    const [hasUploadedResourceForks, setHasUploadedResourceForks] =
        useState(false);
    const handleResourceForkUpload = useCallback(() => {
        setHasUploadedResourceForks(true);
    }, []);
    const [
        showResourceForkUploadNotification,
        clearResourceForkUploadNotification,
    ] = useTemporaryNotification(
        hasUploadedResourceForks,
        "resource-fork-upload-notification-count"
    );
    if (showResourceForkUploadNotification) {
        progress = (
            <div className="Mac-Loading Mac-Loading-Non-Modal Mac-Loading-OneLine">
                <span
                    className="Mac-Loading-Dismiss"
                    onClick={clearResourceForkUploadNotification}>
                    ⓧ
                </span>
                To upload files with resource forks, zip them first (
                <a
                    href="https://blog.persistent.info/2025/09/infinite-mac-resource-forks.html"
                    target="_blank">
                    learn more
                </a>
                ).
            </div>
        );
    }

    function handleDrop(event: React.DragEvent) {
        event.preventDefault();
        setDragCount(0);
        if (!canLoadFiles) {
            setEmulatorErrorText(
                "This emulator does not support loading files."
            );
            return;
        }
        const emulator = emulatorRef.current;
        if (!emulator) {
            return;
        }
        const files = [];

        if (event.dataTransfer.items) {
            for (const item of event.dataTransfer.items) {
                const entry = item.webkitGetAsEntry?.();
                if (entry?.isDirectory) {
                    uploadDirectory(
                        emulator,
                        entry as FileSystemDirectoryEntry,
                        {onResourceForkUpload: handleResourceForkUpload}
                    );
                    return;
                }

                if (item.kind === "file") {
                    files.push(item.getAsFile()!);
                } else if (
                    item.kind === "string" &&
                    item.type === "text/uri-list"
                ) {
                    item.getAsString(async url => {
                        try {
                            const cdrom = await getCDROMInfo(url);
                            varz.increment("emulator_cdrom:drag");
                            emulatorRef.current?.loadCDROM(cdrom);
                        } catch (e) {
                            // TODO: try to use CORS to fetch the file directly
                            // and upload it?
                            console.log("error fetching cdrom", e);
                            return;
                        }
                    });
                }
            }
        } else if (event.dataTransfer.files) {
            for (const file of event.dataTransfer.files) {
                files.push(file);
            }
        }

        uploadFiles(emulator, files, undefined, {
            onResourceForkUpload: handleResourceForkUpload,
        });
    }

    function handleLoadFileClick() {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.onchange = () => {
            // Use the drag overlay to instruct users what will happen when they
            // select a file. We can't show this sooner (as as soon as we send
            // the synthetic click event below) because we may not get a change
            // event if the user cancels the file picker.
            setDragCount(1);
            if (input.files && emulatorRef.current) {
                uploadFiles(
                    emulatorRef.current,
                    Array.from(input.files),
                    undefined,
                    {
                        onResourceForkUpload: handleResourceForkUpload,
                    }
                );
            }
            input.remove();
            // Delay removing the overlay a bit so that users have a chance to
            // read it.
            setTimeout(() => setDragCount(0), 500);
        };
        input.click();
    }

    function loadCDROM(cdrom: EmulatorCDROM) {
        varz.increment("emulator_cdroms", 1);
        emulatorRef.current?.loadCDROM(cdrom);
    }

    // Can't use media queries because they would need to depend on the
    // emulator screen size, but we can't pass that in via CSS variables. We
    // could in theory dynamically generate the media query via JS, but it's not
    // worth the hassle.
    const availableSpace = window.innerWidth - screenWidth;
    let bezelSize: ScreenFrameProps["bezelSize"] = "Large";
    if (availableSpace < SMALL_BEZEL_THRESHOLD) {
        bezelSize = "Small";
    } else if (availableSpace < MEDIUM_BEZEL_THRESHOLD) {
        bezelSize = "Medium";
    }

    const controls: ScreenControl[] = [
        {
            label: "‹ Home",
            handler: onDone,
            alwaysVisible: true,
        },
        ...(canLoadFiles
            ? [{label: "Load File", handler: handleLoadFileClick}]
            : []),
        {label: "Full Screen", handler: handleFullScreenClick},
        {label: "Settings", handler: handleSettingsClick},
        {
            label: "Keyboard",
            handler: handleKeyboardClick,
            selected: isKeyboardVisible,
        },
    ];
    if (USING_TOUCH_INPUT) {
        const alwaysUsingTrackpadMode =
            emulatorNeedsMouseDeltas(emulatorType) ||
            emulatorSettings.useMouseDeltas;
        controls.push({
            label: "Trackpad",
            handler: () => {
                setEmulatorSettings({
                    ...emulatorSettings,
                    trackpadMode: !emulatorSettings.trackpadMode,
                });
            },
            selected: alwaysUsingTrackpadMode || emulatorSettings.trackpadMode,
        });
    }
    if (debugPaused && !emulatorLoaded) {
        controls.splice(1, 0, {
            label: "Start",
            handler: handleStartClick,
            alwaysVisible: true,
        });
    }

    const devicePixelRatio = useDevicePixelRatio();
    let smoothScaling;
    const {screenScaling = "auto"} = emulatorSettings;
    switch (screenScaling) {
        case "auto":
            smoothScaling =
                screenSizeProp === "auto" &&
                (fullscreen ||
                    devicePixelRatio !== Math.floor(devicePixelRatio));
            break;
        case "pixelated":
            smoothScaling = false;
            break;
        case "smooth":
            smoothScaling = true;
            break;
    }
    const screenClassName = classNames("Mac-Screen", {
        "Mac-Screen-Smooth-Scaling": smoothScaling,
    });
    const drawersVisible =
        !fullscreen && screenSizeProp !== "embed" && !isKeyboardVisible;

    return (
        <>
            <ScreenFrame
                className="Mac"
                bezelStyle={machine.bezelStyle}
                viewTransitionName={
                    disks.length
                        ? viewTransitionNameForDisk(disks[0])
                        : undefined
                }
                bezelSize={bezelSize}
                width={screenWidth}
                height={screenHeight}
                scale={scale}
                fullscreen={
                    fullscreen ||
                    // These screen sizes always want fullscreen-like bezels
                    screenSizeProp === "fullscreen" ||
                    screenSizeProp === "window" ||
                    screenSizeProp === "embed"
                }
                led={
                    (!emulatorLoaded && !debugPaused) ||
                    emulatorLoadingDiskChunk
                        ? "Loading"
                        : "On"
                }
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                controls={controls}
                screen={
                    <canvas
                        className={screenClassName}
                        ref={screenRef}
                        width={screenWidth}
                        height={screenHeight}
                        onContextMenu={e => e.preventDefault()}
                        onPointerMove={handlePointerMove}
                        onPointerDown={handlePointerDown}
                    />
                }>
                {progress}
                {canLoadFiles && dragCount > 0 && (
                    <div
                        className={classNames(
                            "Mac-Overlay",
                            "Mac-Drag-Overlay",
                            {
                                "Mac-Drag-Overlay-Downloads":
                                    emulatorSupportsDownloadsFolder(
                                        emulatorType,
                                        flags
                                    ),
                            }
                        )}
                    />
                )}
                {ethernetProviderRef.current && (
                    <MacEthernetStatus
                        provider={ethernetProviderRef.current}
                        peers={ethernetPeers}
                    />
                )}
                {settingsVisible && (
                    <MacSettings
                        emulatorType={emulatorType}
                        emulatorSettings={emulatorSettings}
                        setEmulatorSettings={setEmulatorSettings}
                        hasSavedHD={hasSavedHD}
                        onStorageReset={() => {
                            varz.increment("emulator_disk_saver_reset");
                            emulatorRef.current?.restart(() =>
                                resetDiskSaver(SAVED_HD)
                            );
                        }}
                        onStorageExport={() => {
                            emulatorRef.current?.restart(() =>
                                exportDiskSaver(SAVED_HD)
                            );
                            varz.increment("emulator_disk_saver_export");
                        }}
                        onStorageImport={() => {
                            emulatorRef.current?.restart(() =>
                                importDiskSaver(SAVED_HD)
                            );
                            varz.increment("emulator_disk_saver_import");
                        }}
                        onSaveImage={deviceImage => {
                            emulatorRef.current?.restart(() =>
                                saveDiskSaverImage(SAVED_HD, deviceImage)
                            );
                            varz.increment("emulator_disk_saver_save_image");
                        }}
                        onDone={() => setSettingsVisible(false)}
                    />
                )}
                {emulatorErrorText && (
                    <MacError
                        text={emulatorErrorText}
                        onDone={() => setEmulatorErrorText("")}
                    />
                )}
                {isKeyboardVisible && (
                    <MacKeyboard
                        bezelStyle={machine.bezelStyle}
                        emulatorType={machine.emulatorType}
                        fullSize={window.innerWidth >= 768}
                        onKeyDown={handleKeyDown}
                        onKeyUp={handleKeyUp}
                    />
                )}
            </ScreenFrame>
            {drawersVisible && (
                <DrawersContainer>
                    {emulatorSupportsCDROMs(emulatorType) &&
                        disks[0]?.infiniteHdSubset !== "mfs" && (
                            <MacCDROMs
                                onRun={loadCDROM}
                                platform={machine.platform}
                            />
                        )}
                    {includeLibrary &&
                        emulatorSupportsDownloadsFolder(
                            emulatorType,
                            flags
                        ) && (
                            <MacLibrary
                                onLoadProgress={handleMacLibraryProgress}
                                onRun={handleMacLibraryRun}
                                onRunCDROM={loadCDROM}
                            />
                        )}
                </DrawersContainer>
            )}
        </>
    );
}

/**
 * Handles a full directory upload, including attempting to read resource forks
 * for files that have them.
 */
function uploadDirectory(
    emulator: Emulator,
    directoryEntry: FileSystemDirectoryEntry,
    options?: UploadFileOptions
) {
    let inProgressCount = 1; // we're waiting to read the starting directory
    const files: File[] = [];
    const names: string[] = [];
    const handleFile = (file: File, path: string[]) => {
        files.push(file);
        names.push(path.join("/"));
        checkDone();
    };

    const checkDone = () => {
        inProgressCount--;
        if (inProgressCount === 0) {
            uploadFiles(emulator, files, names, options);
        }
    };

    const readDirectory = (
        directoryEntry: FileSystemDirectoryEntry,
        path: string[]
    ) => {
        const directoryReader = directoryEntry.createReader();
        directoryReader.readEntries(entries => {
            inProgressCount--; // We finished reading the directory
            entries.forEach(entry => {
                inProgressCount++; //
                if (entry.isDirectory) {
                    readDirectory(entry as FileSystemDirectoryEntry, [
                        ...path,
                        entry.name,
                    ]);
                    return;
                }
                const fileEntry = entry as FileSystemFileEntry;
                fileEntry.file(file => handleFile(file, [...path, entry.name]));

                inProgressCount++;
                directoryEntry.getFile(
                    `${entry.name}/..namedfork/rsrc`,
                    {},
                    resourceEntry =>
                        (resourceEntry as FileSystemFileEntry).file(
                            resourceFile =>
                                // Assume that the emulator is using the
                                // Basilisk II/SheepShaver ExtFS convention of a
                                // parallel .rsrc directory for resource forks.
                                handleFile(resourceFile, [
                                    ...path,
                                    ".rsrc",
                                    entry.name,
                                ]),
                            checkDone // Ignore errors, not all files have resource forks
                        ),
                    checkDone // Ignore errors, not all files have resource forks
                );
            });
        });
    };

    readDirectory(directoryEntry, [directoryEntry.name]);
}

type UploadFileOptions = {
    fromLibrary?: boolean;
    onResourceForkUpload?: () => void;
};

function uploadFiles(
    emulator: Emulator,
    files: File[],
    names: string[] = [],
    {fromLibrary, onResourceForkUpload}: UploadFileOptions = {}
) {
    let fileCount = 0;
    let diskImageCount = 0;
    for (const file of files) {
        if (isDiskImageFile(file)) {
            diskImageCount++;
        } else {
            fileCount++;
        }
    }
    const resourceForkCount = names.filter(name =>
        name.includes("/.rsrc/")
    ).length;
    if (resourceForkCount) {
        onResourceForkUpload?.();
    }
    emulator.uploadFiles(files, names);
    varz.incrementMulti({
        "emulator_uploads": files.length,
        "emulator_uploads:files": fileCount,
        "emulator_uploads:disks": diskImageCount,
        "emulator_uploads:resource_forks": resourceForkCount,
        "emulator_uploads:library": fromLibrary ? files.length : 0,
    });
}

const SMALL_BEZEL_THRESHOLD = 80;
const MEDIUM_BEZEL_THRESHOLD = 168;

function computeInitialScreenSize(
    machine: MachineDef,
    screenSizeProp?: ScreenSize,
    screenScaleProp?: number
): {width: number; height: number} {
    if (machine.fixedScreenSize) {
        return machine.fixedScreenSize;
    }
    if (typeof screenSizeProp === "object") {
        return screenSizeProp;
    }
    let {innerWidth: windowWidth, innerHeight: windowHeight} = window;
    let {width: screenWidth, height: screenHeight} = window.screen;
    if (screenScaleProp) {
        windowWidth = Math.floor(windowWidth / screenScaleProp);
        windowHeight = Math.floor(windowHeight / screenScaleProp);
        screenWidth = Math.floor(screenWidth / screenScaleProp);
        screenHeight = Math.floor(screenHeight / screenScaleProp);
    }
    switch (screenSizeProp) {
        case undefined:
        case "auto": {
            const availableWidth = windowWidth - MEDIUM_BEZEL_THRESHOLD;
            const availableHeight = windowHeight - MEDIUM_BEZEL_THRESHOLD;
            const {supportedScreenSizes = DEFAULT_SUPPORTED_SCREEN_SIZES} =
                machine;
            for (const {width, height} of supportedScreenSizes) {
                if (width <= availableWidth && height <= availableHeight) {
                    return {width, height};
                }
            }
            return {width: 640, height: 480};
        }
        case "window":
        case "embed":
            return {width: windowWidth, height: windowHeight};
        case "fullscreen":
            return {width: screenWidth, height: screenHeight};
    }
}

// Assume that mobile devices that can't do hover events also need an explicit
// control for bringing up the on-screen keyboard.
const USING_TOUCH_INPUT =
    "matchMedia" in window && !window.matchMedia("(hover: hover)").matches;

function MacEthernetStatus({
    provider,
    peers,
}: {
    provider: EmulatorEthernetProvider;
    peers: readonly EmulatorEthernetPeer[];
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
            <div className="ScreenFrame-Bezel-Text">{text}</div>
            {details}
        </div>
    );
}

function MacError({text, onDone}: {text: string; onDone: () => void}) {
    return (
        <Dialog title="Emulator Error" onDone={onDone} doneLabel="Bummer">
            <p style={{whiteSpace: "pre-line"}}>{text}</p>
        </Dialog>
    );
}

function useTemporaryNotification(canShow: boolean, key: string) {
    const [count, setCount] = usePersistentState(10, key);
    const [hide, setHide] = useState(false);
    const shouldShow = count > 0 && canShow;

    useEffect(() => {
        if (shouldShow) {
            setCount(v => v - 1);
            setTimeout(() => setHide(true), 10_000);
        }
    }, [setCount, shouldShow]);

    const clearNotification = useCallback(() => setCount(0), [setCount]);
    return [shouldShow && !hide, clearNotification] as const;
}
