import {
    type EmulatorCDROM,
    type EmulatorChunkedFileSpec,
    type EmulatorFallbackCommand,
    type EmulatorWorkerConfig,
    type EmulatorWorkerDirectorExtraction,
    type EmulatorWorkerVideoBlit,
} from "./emulator-common";
import {
    type EmulatorSpeed,
    EMULATOR_CD_DRIVE_COUNT,
    emulatorCpuId,
    emulatorModelId,
    emulatorUsesCDROMDrive,
    emulatorUsesPrefs,
    emulatorUsesArgs,
    emulatorNeedsPointerLock,
} from "./emulator-common-emulators";
import {getEmulatorWasmPath} from "./emulator-ui-emulators";
import Worker from "./emulator-worker?worker";
import serviceWorkerPath from "./emulator-service-worker?worker&url";
import {
    type EmulatorAudio,
    FallbackEmulatorAudio,
    SharedMemoryEmulatorAudio,
} from "./emulator-ui-audio";
import {
    type EmulatorInput,
    FallbackEmulatorInput,
    SharedMemoryEmulatorInput,
} from "./emulator-ui-input";
import {
    type EmulatorVideo,
    FallbackEmulatorVideo,
    SharedMemoryEmulatorVideo,
} from "./emulator-ui-video";
import {
    type EmulatorFiles,
    FallbackEmulatorFiles,
    SharedMemoryEmulatorFiles,
} from "./emulator-ui-files";
import {
    handleDirectoryExtraction,
    uploadsFromDirectoryExtractionFile,
} from "./emulator-ui-extractor";
import {getPersistedData, persistData} from "./emulator-ui-persistence";
import {
    JS_CODE_TO_ADB_KEYCODE,
    JS_CODE_TO_MINI_VMAC_KEYCODE,
} from "./emulator-key-codes";
import {
    type EmulatorEthernet,
    type EthernetPingerPeer,
    handleEthernetWrite,
    FallbackEmulatorEthernet,
    SharedMemoryEmulatorEthernet,
    EthernetPinger,
} from "./emulator-ui-ethernet";
import {
    type EmulatorClipboard,
    FallbackEmulatorClipboard,
    SharedMemoryEmulatorClipboard,
} from "./emulator-ui-clipboard";
import {type MachineDefRAMSize, type MachineDef} from "../machines";
import {type EmulatorDiskDef} from "../disks";
import deviceImageHeaderPath from "../Data/Device Image Header.hda";

export type EmulatorConfig = {
    machine: MachineDef;
    ramSize?: MachineDefRAMSize;
    useSharedMemory: boolean;
    screenWidth: number;
    screenHeight: number;
    screenCanvas: HTMLCanvasElement;
    disks: EmulatorDiskDef[];
    delayedDisks?: EmulatorDiskDef[];
    cdroms: EmulatorCDROM[];
    ethernetProvider?: EmulatorEthernetProvider;
    debugAudio?: boolean;
    debugLog?: boolean;
};

export type EmulatorSettings = {
    swapControlAndCommand: boolean;
    speed: EmulatorSpeed;
};

export interface EmulatorEthernetProvider {
    init(macAddress: string): void;
    close?(): void;
    send(destination: string, packet: Uint8Array): void;
    setDelegate(delegate: EmulatorEthernetProviderDelegate): void;
    description(): string;
    macAddress(): string | undefined;
}

export interface EmulatorEthernetProviderDelegate {
    receive(packet: Uint8Array): void;
}

export type EmulatorEthernetPeer = EthernetPingerPeer;

export interface EmulatorDelegate {
    emulatorDidExit?(emulator: Emulator): void;
    emulatorDidChangeScreenSize?(width: number, height: number): void;
    emulatorDidMakeLoadingProgress?(
        emulator: Emulator,
        total: number,
        left: number
    ): void;
    emulatorDidFinishLoading?(emulator: Emulator): void;
    emulatorDidStartToLoadDiskChunk?(emulator: Emulator): void;
    emulatorDidFinishLoadingDiskChunk?(emulator: Emulator): void;
    emulatorEthernetPeersDidChange?(
        emulator: Emulator,
        peers: readonly EmulatorEthernetPeer[]
    ): void;
    emulatorDidRunOutOfMemory?(emulator: Emulator): void;
    emulatorDidHaveError?(
        emulator: Emulator,
        error: string,
        errorRaw: string
    ): void;
    emulatorSettings?(emulator: Emulator): EmulatorSettings;
    emulatorDidRestoreFiles?(emulator: Emulator, count: number): void;
}

export type EmulatorFallbackCommandSender = (
    command: EmulatorFallbackCommand
) => Promise<void>;

export class Emulator {
    #config: EmulatorConfig;
    #delegate?: EmulatorDelegate;
    #worker: Worker;
    #workerTerminated: boolean = false;

    #screenCanvasContext: CanvasRenderingContext2D;
    #screenImageData: ImageData;

    #video: EmulatorVideo;
    #input: EmulatorInput;
    #audio: EmulatorAudio;
    #files: EmulatorFiles;
    #ethernet: EmulatorEthernet;
    #clipboard: EmulatorClipboard;

    #serviceWorker?: ServiceWorker;
    #serviceWorkerReady?: Promise<boolean>;

    #gotFirstBlit = false;

    #ethernetPinger: EthernetPinger;

    // Keep track of which keys are down so we can synthesize key up events in
    // some edge cases.
    #downKeyCodes = new Set<string>();

    #requestedPointerLock = false;

    constructor(config: EmulatorConfig, delegate?: EmulatorDelegate) {
        console.time("Emulator first blit");
        console.time("Emulator quiescent");

        this.#config = config;
        this.#delegate = delegate;
        this.#worker = new Worker();
        const {
            useSharedMemory,
            screenCanvas: canvas,
            screenWidth,
            screenHeight,
        } = this.#config;

        this.#initServiceWorker();

        let fallbackCommandSender: EmulatorFallbackCommandSender;
        if (!useSharedMemory) {
            fallbackCommandSender = async (
                command: EmulatorFallbackCommand
            ) => {
                const serviceWorkerAvailable = await this.#serviceWorkerReady;
                if (serviceWorkerAvailable) {
                    this.#serviceWorker!.postMessage({
                        type: "worker-command",
                        command,
                    });
                } else {
                    console.error(
                        "Service worker is not available, cannot send command",
                        command
                    );
                }
            };
        }

        this.#screenCanvasContext = canvas.getContext("2d", {
            desynchronized: true,
        })!;
        this.#screenImageData = this.#screenCanvasContext.createImageData(
            screenWidth,
            screenHeight
        );

        this.#video = useSharedMemory
            ? new SharedMemoryEmulatorVideo(config)
            : new FallbackEmulatorVideo(config);
        this.#input = useSharedMemory
            ? new SharedMemoryEmulatorInput()
            : new FallbackEmulatorInput(fallbackCommandSender!);
        this.#audio = useSharedMemory
            ? new SharedMemoryEmulatorAudio(this.#input)
            : new FallbackEmulatorAudio(this.#input);
        this.#files = useSharedMemory
            ? new SharedMemoryEmulatorFiles()
            : new FallbackEmulatorFiles(fallbackCommandSender!);
        this.#ethernet = useSharedMemory
            ? new SharedMemoryEmulatorEthernet()
            : new FallbackEmulatorEthernet(fallbackCommandSender!);
        config.ethernetProvider?.setDelegate({
            receive: (packet: Uint8Array) => {
                if (this.#ethernetPinger.handlePongPacket(packet)) {
                    return;
                }
                this.#ethernet.receive(packet);
                // Simulate an input event to both make sure we end the idlewait
                // Atomics.wait and because we can then trigger the Ethernet
                // interrupt sooner on the Basilisk II side.
                this.#input.handleInput({type: "ethernet-interrupt"});
            },
        });
        this.#ethernetPinger = new EthernetPinger({
            ethernetPingerDidUpdatePeers: pinger => {
                this.#delegate?.emulatorEthernetPeersDidChange?.(
                    this,
                    pinger.peers()
                );
            },
        });
        this.#clipboard = useSharedMemory
            ? new SharedMemoryEmulatorClipboard()
            : new FallbackEmulatorClipboard(fallbackCommandSender!);
    }

    async start() {
        const {screenCanvas: canvas} = this.#config;
        canvas.addEventListener("touchmove", this.#handleTouchMove);
        canvas.addEventListener("touchstart", this.#handleTouchStart);
        canvas.addEventListener("touchend", this.#handleTouchEnd);
        canvas.addEventListener("mousemove", this.#handleMouseMove);
        canvas.addEventListener("mousedown", this.#handleMouseDown);
        canvas.addEventListener("mouseup", this.#handleMouseUp);
        window.addEventListener("keydown", this.#handleKeyDown);
        window.addEventListener("keyup", this.#handleKeyUp);
        window.addEventListener("beforeunload", this.#handleBeforeUnload);

        document.addEventListener(
            "visibilitychange",
            this.#handleVisibilityChange
        );
        document.addEventListener(
            "pointerlockchange",
            this.#handlePointerLockChange
        );

        await this.#startWorker();
    }

    async #startWorker() {
        if (this.#workerTerminated) {
            this.#worker = new Worker();
        }
        this.#worker.addEventListener("message", this.#handleWorkerMessage);

        const emulatorWasmPath = getEmulatorWasmPath(this.#config.machine);

        // Fetch all of the dependent files ourselves, to avoid a waterfall
        // if we let Emscripten handle it (it would first load the JS, and
        // then that would load the WASM and data files).
        const [[wasmBlobUrl], [rom, basePrefs, deviceImageHeader]] = await load(
            [emulatorWasmPath],
            [
                this.#config.machine.romPath,
                this.#config.machine.prefsPath,
                deviceImageHeaderPath,
            ],
            (total, left) => {
                this.#delegate?.emulatorDidMakeLoadingProgress?.(
                    this,
                    total,
                    left
                );
            }
        );

        const romPathPieces = this.#config.machine.romPath.split("/");
        const romFileName = romPathPieces[romPathPieces.length - 1];

        const extraction = await getPersistedData();

        const disks = await loadDisks(this.#config.disks);
        const delayedDisks = this.#config.delayedDisks
            ? await loadDisks(this.#config.delayedDisks)
            : undefined;

        let prefs = "";
        let prefsBuffer;
        let args: string[] = [];
        const {emulatorType, emulatorSubtype} = this.#config.machine;
        if (emulatorUsesPrefs(emulatorType)) {
            prefs = configToEmulatorPrefs(this.#config, {
                basePrefs,
                disks,
                romFileName,
            });
            prefsBuffer = new TextEncoder().encode(prefs).buffer;
            console.groupCollapsed(
                "%cGenerated emulator prefs",
                "font-weight: normal"
            );
            console.log(prefs);
            console.groupEnd();
        } else if (emulatorUsesArgs(emulatorType)) {
            args = configToEmulatorArgs(this.#config, {disks, romFileName});
            console.groupCollapsed(
                "%cGenerated emulator args",
                "font-weight: normal"
            );
            console.log(JSON.stringify(args, undefined, 2));
            console.groupEnd();
        } else {
            throw new Error(`Unknown emulator type: ${emulatorType}`);
        }

        const config: EmulatorWorkerConfig = {
            emulatorType,
            emulatorSubtype,
            wasmUrl: wasmBlobUrl,
            disks,
            delayedDisks,
            deviceImageHeader,
            cdroms: this.#config.cdroms,
            useCDROM: emulatorUsesCDROMDrive(emulatorType),
            autoloadFiles: {
                [romFileName]: rom,
                ...(prefsBuffer ? {"prefs": prefsBuffer} : {}),
            },
            persistedData: extraction,
            arguments: prefs ? ["--config", "prefs"] : args,
            video: this.#video.workerConfig(),
            input: this.#input.workerConfig(),
            audio: this.#audio.workerConfig(),
            files: this.#files.workerConfig(),
            ethernet: this.#ethernet.workerConfig(),
            clipboard: this.#clipboard.workerConfig(),
        };

        const serviceWorkerAvailable = await this.#serviceWorkerReady;
        if (serviceWorkerAvailable) {
            for (const spec of config.disks.concat(config.delayedDisks ?? [])) {
                this.#serviceWorker!.postMessage({
                    type: "init-disk-cache",
                    spec,
                });
            }
        } else {
            console.warn(
                "Could not initialize service worker, things will be slower"
            );
        }
        this.#worker.postMessage({type: "start", config}, [
            rom,
            deviceImageHeader,
            ...(prefsBuffer ? [prefsBuffer] : []),
        ]);
    }

    refreshSettings() {
        const speed = this.#delegate?.emulatorSettings?.(this)?.speed;
        if (speed !== undefined) {
            this.#input.handleInput({type: "set-speed", speed});
        }
    }

    stop() {
        const {screenCanvas: canvas} = this.#config;
        canvas.removeEventListener("touchmove", this.#handleTouchMove);
        canvas.removeEventListener("touchstart", this.#handleTouchStart);
        canvas.removeEventListener("touchend", this.#handleTouchEnd);
        canvas.removeEventListener("mousemove", this.#handleMouseMove);
        canvas.removeEventListener("mousedown", this.#handleMouseDown);
        canvas.removeEventListener("mouseup", this.#handleMouseUp);
        window.removeEventListener("keydown", this.#handleKeyDown);
        window.removeEventListener("keyup", this.#handleKeyUp);
        window.removeEventListener("beforeunload", this.#handleBeforeUnload);

        document.removeEventListener(
            "visibilitychange",
            this.#handleVisibilityChange
        );
        document.addEventListener(
            "pointerlockchange",
            this.#handlePointerLockChange
        );

        this.#input.handleInput({type: "stop"});
        this.#ethernetPinger.stop();
        this.#audio.stop();
    }

    restart(whileStopped?: () => Promise<void>): Promise<void> {
        this.#audio.stop();
        this.#input.handleInput({type: "stop"});
        // Wait for handleEmulatorStopped to be invoked, so that data is
        // persisted.
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if (this.#workerTerminated) {
                    this.#clearScreen();
                    clearInterval(interval);
                    const start = () => {
                        this.#startWorker();
                        // Make sure we clear the "stopped" bit set above
                        this.#input.handleInput({type: "start"});
                        resolve();
                    };
                    if (whileStopped) {
                        whileStopped().then(start);
                    } else {
                        start();
                    }
                }
            }, 100);
        });
    }

    async uploadFile(file: File) {
        const uploads = await uploadsFromDirectoryExtractionFile(file);
        if (uploads) {
            this.#files.uploadFiles(uploads);
            return;
        }
        this.#files.uploadFile({
            name: file.name,
            url: URL.createObjectURL(file),
            size: file.size,
        });
    }

    loadCDROM(cdrom: EmulatorCDROM) {
        this.#files.loadCDROM(cdrom);
    }

    #handleMouseMove = (event: MouseEvent) => {
        this.#input.handleInput({
            type: "mousemove",
            x: event.offsetX,
            y: event.offsetY,
            deltaX: event.movementX,
            deltaY: event.movementY,
        });
    };

    #handleMouseDown = (event: MouseEvent) => {
        this.#input.handleInput({type: "mousedown"});
        if (
            emulatorNeedsPointerLock(this.#config.machine.emulatorType) &&
            !this.#requestedPointerLock
        ) {
            this.#config.screenCanvas.requestPointerLock({
                unadjustedMovement: true,
            });
            this.#requestedPointerLock = true;
        }
    };

    #handlePointerLockChange = (event: Event): void => {
        if (!document.pointerLockElement) {
            this.#requestedPointerLock = false;
        }
    };

    #handleMouseUp = (event: MouseEvent) => {
        this.#input.handleInput({type: "mouseup"});
    };

    #handleTouchMove = (event: TouchEvent) => {
        this.#input.handleInput({
            type: "mousemove",
            ...this.#getTouchLocation(event),
        });
    };

    #handleTouchStart = (event: TouchEvent) => {
        // Avoid mouse events also being dispatched for the touch.
        event.preventDefault();
        // Though we want to treat this as a mouse down, we haven't gotten the
        // move to the current location yet, so we need to send the coordinates
        // as well.
        this.#input.handleInput({
            type: "touchstart",
            ...this.#getTouchLocation(event),
        });
    };

    #getTouchLocation(event: TouchEvent): {
        x: number;
        y: number;
        deltaX: number;
        deltaY: number;
    } {
        const touch = event.touches[0];
        const target = touch.target as HTMLElement;
        const targetBounds = target.getBoundingClientRect();
        // The touch coordinates and the target bounds are affected by the scale
        // transform that we do when in full-screen mode, so we need to undo
        // it.
        const scaleFactor = targetBounds.width / target.offsetWidth;
        return {
            x: (touch.clientX - targetBounds.left) / scaleFactor,
            y: (touch.clientY - targetBounds.top) / scaleFactor,
            // Touch events do not support movementX/Y, do not generate deltas
            // for them for now.
            deltaX: 0,
            deltaY: 0,
        };
    }

    #handleTouchEnd = (event: TouchEvent) => {
        this.#input.handleInput({type: "mouseup"});
    };

    #handleKeyDown = (event: KeyboardEvent) => {
        if (event.target instanceof HTMLInputElement) {
            return;
        }
        event.preventDefault();
        const {code} = event;
        const adbKeyCode = this.#getAdbKeyCode(code);
        if (adbKeyCode !== undefined) {
            this.#downKeyCodes.add(code);

            // If this is a paste operation, send the updated clipboard contents
            // to the emulator so that it can be used when executing the paste.
            // Ideally we would watch for a clipboardchage event, but that's not
            // supported broadly (see https://crbug.com/933608).
            if (code === "KeyV" && event.metaKey) {
                navigator.clipboard.readText().then(
                    text => this.#clipboard.setClipboardText(text),
                    error => console.error("Could not read clipboard", error)
                );
            }
            this.#input.handleInput({
                type: "keydown",
                keyCode: adbKeyCode,
            });
        } else {
            console.warn(`Unhandled key: ${code}`);
        }
    };

    #handleKeyUp = (event: KeyboardEvent) => {
        const {code} = event;

        const handleKeyUp = (code: string) => {
            this.#downKeyCodes.delete(code);
            const adbKeyCode = this.#getAdbKeyCode(code);
            if (adbKeyCode !== undefined) {
                this.#input.handleInput({
                    type: "keyup",
                    keyCode: adbKeyCode,
                });
            }
        };
        handleKeyUp(code);

        // Work around a macOS quirk where keyup events are not sent for
        // non-modifier keys when using command+key combinations. See
        // https://github.com/mihaip/infinite-mac/issues/89 for more details.
        if (code.startsWith("Meta") && navigator.platform.startsWith("Mac")) {
            for (const otherKeyCode of this.#downKeyCodes) {
                if (
                    !otherKeyCode.startsWith("Meta") &&
                    !otherKeyCode.startsWith("Control") &&
                    !otherKeyCode.startsWith("Alt") &&
                    !otherKeyCode.startsWith("Shift")
                ) {
                    handleKeyUp(otherKeyCode);
                }
            }
        }
    };

    #getAdbKeyCode(code: string): number | undefined {
        if (this.#delegate?.emulatorSettings?.(this).swapControlAndCommand) {
            if (code.startsWith("Control")) {
                code = "Meta" + code.slice("Control".length);
            } else if (code.startsWith("Meta")) {
                code = "Control" + code.slice("Meta".length);
            }
        }
        if (this.#config.machine.emulatorType === "Mini vMac") {
            const keyCode = JS_CODE_TO_MINI_VMAC_KEYCODE[code];
            if (keyCode !== undefined) {
                return keyCode;
            }
        }
        return JS_CODE_TO_ADB_KEYCODE[code];
    }

    #handleBeforeUnload = () => {
        // Mostly necessary for the fallback mode, otherwise the page can hang
        // during reload because the worker is not yielding.
        this.stop();
    };

    #handleWorkerMessage = (e: MessageEvent) => {
        if (e.data.type === "emulator_ready") {
            this.#delegate?.emulatorDidFinishLoading?.(this);
        } else if (e.data.type === "emulator_exit") {
            this.#delegate?.emulatorDidExit?.(this);
        } else if (e.data.type === "emulator_video_open") {
            const {width, height} = e.data;
            this.#screenImageData = this.#screenCanvasContext.createImageData(
                width,
                height
            );
            this.#delegate?.emulatorDidChangeScreenSize?.(width, height);
        } else if (e.data.type === "emulator_audio_open") {
            const {sampleRate, sampleSize, channels} = e.data;
            this.#audio.init(
                sampleRate,
                sampleSize,
                channels,
                this.#config.debugAudio ?? false
            );
        } else if (e.data.type === "emulator_blit") {
            if (!this.#gotFirstBlit) {
                this.#gotFirstBlit = true;
                console.timeEnd("Emulator first blit");
            }
            const blitData: EmulatorWorkerVideoBlit = e.data.data;
            this.#video.blit(blitData);
            this.#drawScreen();
        } else if (e.data.type === "emulator_audio") {
            if (this.#audio instanceof FallbackEmulatorAudio) {
                this.#audio.handleData(e.data.data);
            }
        } else if (e.data.type === "emulator_extract_directory") {
            handleDirectoryExtraction(e.data.extraction);
        } else if (e.data.type === "emulator_quiescent") {
            console.timeEnd("Emulator quiescent");
        } else if (e.data.type === "emulator_stopped") {
            this.#handleEmulatorStopped(e.data.extraction);
        } else if (e.data.type === "emulator_ethernet_init") {
            const {ethernetProvider} = this.#config;
            if (ethernetProvider) {
                ethernetProvider.init(e.data.macAddress);
                this.#ethernetPinger.start(e.data.macAddress, ethernetProvider);
            }
        } else if (e.data.type === "emulator_ethernet_write") {
            const {destination, packet} = e.data;
            const localResponse = handleEthernetWrite(destination, packet);
            if (localResponse) {
                this.#ethernet.receive(localResponse);
            } else {
                this.#config.ethernetProvider?.send(destination, packet);
            }
        } else if (e.data.type === "emulator_set_clipboard_text") {
            const {text} = e.data;
            navigator.clipboard.writeText(text).then(
                () => {
                    // Success
                },
                error => {
                    console.error("Could not set clipboard text:", error);
                }
            );
        } else if (e.data.type === "emulator_did_run_out_memory") {
            this.#delegate?.emulatorDidRunOutOfMemory?.(this);
        } else if (e.data.type === "emulator_did_have_error") {
            this.#delegate?.emulatorDidHaveError?.(
                this,
                e.data.error,
                e.data.errorRaw ?? e.data.error
            );
        } else if (e.data.type === "emulator_will_load_chunk") {
            this.#delegate?.emulatorDidStartToLoadDiskChunk?.(this);
        } else if (e.data.type === "emulator_did_load_chunk") {
            this.#delegate?.emulatorDidFinishLoadingDiskChunk?.(this);
        } else if (e.data.type === "emulator_did_restore_files") {
            this.#delegate?.emulatorDidRestoreFiles?.(this, e.data.count);
        } else {
            console.warn("Unexpected postMessage event", e);
        }
    };

    #handleVisibilityChange = () => {
        this.#drawScreen();
    };

    #drawScreen() {
        if (document.hidden) {
            return;
        }
        const imageData = this.#video.imageData();
        if (!imageData) {
            return;
        }
        this.#screenImageData.data.set(imageData);
        const dirtyRect = this.#video.consumeBlitRect();
        if (dirtyRect) {
            this.#screenCanvasContext.putImageData(
                this.#screenImageData,
                0,
                0,
                dirtyRect.left,
                dirtyRect.top,
                dirtyRect.right - dirtyRect.left,
                dirtyRect.bottom - dirtyRect.top
            );
        } else {
            this.#screenCanvasContext.putImageData(this.#screenImageData, 0, 0);
        }
    }

    #clearScreen() {
        this.#screenCanvasContext.clearRect(
            0,
            0,
            this.#config.screenCanvas.width,
            this.#config.screenCanvas.height
        );
    }

    #initServiceWorker() {
        if (!("serviceWorker" in navigator)) {
            console.warn("Service workers not available");
            return;
        }
        // We need to use modules for service workers in dev mode (because
        // Vite will generate a file with import statements), but we don't
        // need it in prod (where Vite will bundle all dependencies, and
        // old Safari does not support module workers).
        const workerType = import.meta.env.DEV ? "module" : "classic";
        this.#serviceWorkerReady = new Promise((resolve, reject) => {
            navigator.serviceWorker
                .register(serviceWorkerPath, {scope: "/", type: workerType})
                .then(registration => {
                    const init = (serviceWorker: ServiceWorker) => {
                        this.#serviceWorker = serviceWorker;
                        serviceWorker.addEventListener(
                            "statechange",
                            handleStateChange
                        );
                    };
                    const handleStateChange = (event: Event) => {
                        const {state} = this.#serviceWorker!;
                        console.log(
                            `Service worker stage changed to "${state}"`
                        );
                        if (state === "activated") {
                            resolve(true);
                        }
                    };
                    console.log("Service worker registered");
                    if (registration.installing) {
                        console.log("Service worker installing");
                        init(registration.installing);
                    } else if (registration.waiting) {
                        console.log("Service worker installed, waiting");
                        init(registration.waiting);
                    } else if (registration.active) {
                        console.log("Service worker active");
                        init(registration.active);
                        resolve(true);
                    }
                })
                .catch(err => {
                    console.error("Service worker error", err);
                    resolve(false);
                });
        });
    }

    async #handleEmulatorStopped(extraction: EmulatorWorkerDirectorExtraction) {
        await persistData(extraction);
        this.#worker.removeEventListener("message", this.#handleWorkerMessage);
        this.#worker.terminate();
        this.#workerTerminated = true;
    }
}

async function load(
    blobUrlPaths: string[],
    arrayBufferPaths: string[],
    progress: (total: number, left: number) => any
): Promise<[string[], ArrayBuffer[]]> {
    const paths = blobUrlPaths.concat(arrayBufferPaths);
    let left = paths.length;
    progress(paths.length, left);

    const blobUrls: string[] = [];
    const arrayBuffers: ArrayBuffer[] = [];

    await Promise.all(
        paths.map(async path => {
            const response = await fetch(path);
            const blobUrlIndex = blobUrlPaths.indexOf(path);
            if (blobUrlIndex !== -1) {
                const blobUrl = URL.createObjectURL(await response.blob());
                blobUrls[blobUrlIndex] = blobUrl;
            } else {
                const arrayBufferIndex = arrayBufferPaths.indexOf(path);
                arrayBuffers[arrayBufferIndex] = await response.arrayBuffer();
            }
            progress(paths.length, --left);
        })
    );

    return [blobUrls, arrayBuffers];
}

async function loadDisks(
    disks: EmulatorDiskDef[]
): Promise<EmulatorChunkedFileSpec[]> {
    const diskSpecs = await Promise.all(
        disks.map(d => d.generatedSpec().then(i => i.default))
    );
    return disks.map((d, i) => ({
        ...diskSpecs[i],
        baseUrl: "/Disk",
        prefetchChunks: d.prefetchChunks,
        persistent: d.persistent,
        isFloppy: d.isFloppy,
    }));
}

function configToEmulatorPrefs(
    config: EmulatorConfig,
    {
        basePrefs,
        romFileName,
        disks,
    }: {
        basePrefs: ArrayBuffer;
        romFileName: string;
        disks: EmulatorChunkedFileSpec[];
    }
): string {
    const {machine} = config;
    let prefsStr = new TextDecoder().decode(basePrefs);
    prefsStr += `rom ${romFileName}\n`;
    const cpuId = emulatorCpuId(machine.emulatorType, machine.cpu);
    if (cpuId !== undefined) {
        prefsStr += `cpu ${cpuId}\n`;
    }
    const modelId = emulatorModelId(machine.emulatorType, machine.gestaltID);
    if (modelId !== undefined) {
        prefsStr += `modelid ${modelId}\n`;
    }
    const ramSizeString = config.ramSize ?? machine.ramSizes[0];
    let ramSize = parseInt(ramSizeString);
    if (ramSizeString.endsWith("M")) {
        ramSize *= 1024 * 1024;
    } else if (ramSizeString.endsWith("K")) {
        ramSize *= 1024;
    }
    prefsStr += `ramsize ${ramSize}\n`;
    prefsStr += `screen win/${config.screenWidth}/${config.screenHeight}\n`;
    for (const spec of disks) {
        prefsStr += `disk ${spec.name}\n`;
    }
    for (const cdrom of config.cdroms) {
        prefsStr += `disk ${cdrom.name}\n`;
    }
    const useCDROM = emulatorUsesCDROMDrive(machine.emulatorType);
    if (useCDROM) {
        for (let i = 0; i < EMULATOR_CD_DRIVE_COUNT; i++) {
            prefsStr += `cdrom /cdrom/${i}\n`;
        }
    }
    if (config.ethernetProvider) {
        prefsStr += "appletalk true\n";
    }
    // The fallback path does not support high-frequency calls to reading
    // the input (we end up making so many service worker network requests
    // that overall emulation latency suffers).
    prefsStr += `jsfrequentreadinput ${config.useSharedMemory}\n`;
    return prefsStr;
}

function configToEmulatorArgs(
    config: EmulatorConfig,
    {
        romFileName,
        disks,
    }: {
        romFileName: string;
        disks: EmulatorChunkedFileSpec[];
    }
): string[] {
    const args = ["--realtime", "--bootrom", romFileName];
    if (config.debugLog) {
        args.push("--log-to-stderr", "--log-to-stderr-verbose");
    }
    let addedHardDisk = false;
    let addedFloppy = false;
    for (const spec of disks) {
        // TODO: support more than one disk in DingusPPC
        if (spec.isFloppy) {
            if (addedFloppy) {
                continue;
            }
            addedFloppy = true;
        } else {
            if (addedHardDisk) {
                continue;
            }
            addedHardDisk = true;
        }
        args.push(spec.isFloppy ? "--fdd_img" : "--hdd_img", spec.name);
    }
    for (const spec of config.cdroms) {
        args.push("--cdr_img", spec.name);
    }
    return args;
}
