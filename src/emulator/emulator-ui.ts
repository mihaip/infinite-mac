import {
    type EmulatorDiskFile,
    type EmulatorCDROM,
    type EmulatorChunkedFileSpec,
    type EmulatorFallbackCommand,
    type EmulatorWorkerConfig,
    type EmulatorWorkerVideoBlit,
} from "./emulator-common";
import {
    type EmulatorSpeed,
    EMULATOR_REMOVABLE_DISK_COUNT,
    emulatorCpuId,
    emulatorModelId,
    emulatorUsesPlaceholderDisks,
    emulatorNeedsMouseDeltas,
    type EmulatorDef,
    emulatorSupportsMouseDeltas,
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
    uploadsFromFile,
} from "./emulator-ui-extractor";
import {
    JS_CODE_TO_ADB_KEYCODE,
    JS_CODE_TO_MINI_VMAC_KEYCODE,
    JS_CODE_TO_NEXT_KEYCODE,
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
import {
    type MachineDefRAMSize,
    type MachineDef,
    POWER_MACINTOSH_7500,
    POWER_MACINTOSH_6100,
    POWER_MACINTOSH_G3_BEIGE,
    POWER_MACINTOSH_G3_BW_DPPC,
} from "../machines";
import {type EmulatorDiskDef} from "../disks";
import deviceImageHeaderPath from "../Data/Device Image Header (All Drivers).hda";
import {fetchCDROM} from "./emulator-ui-cdrom";
import {EmulatorTrackpadController} from "./emulator-ui-trackpad";

export type EmulatorConfig = {
    machine: MachineDef;
    ramSize?: MachineDefRAMSize;
    useSharedMemory: boolean;
    screenWidth: number;
    screenHeight: number;
    screenCanvas: HTMLCanvasElement;
    disks: EmulatorDiskDef[];
    diskFiles: EmulatorDiskFile[];
    delayedDisks?: EmulatorDiskDef[];
    cdroms: EmulatorCDROM[];
    ethernetProvider?: EmulatorEthernetProvider;
    customDate?: Date;
    debugAudio?: boolean;
    debugLog?: boolean;
    debugTrackpad?: boolean;
};

export type EmulatorScreenScaling = "auto" | "smooth" | "pixelated";

export type EmulatorSettings = {
    swapControlAndCommand: boolean;
    speed: EmulatorSpeed;
    useMouseDeltas: boolean;
    trackpadMode: boolean;
    screenScaling?: EmulatorScreenScaling;
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
    emulatorDidBecomeQuiescent?(emulator: Emulator): void;
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
    emulatorDidMakeCDROMLoadingProgress?(
        emulator: Emulator,
        cdrom: EmulatorCDROM,
        progress: number
    ): void;
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

    #mouseX = 0;
    #mouseY = 0;
    #trackpadController: EmulatorTrackpadController;
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
        this.#trackpadController = new EmulatorTrackpadController({
            trackpadDidMove: (deltaX, deltaY) => {
                this.#input.handleInput({
                    type: "mousemove",
                    // Also send the absolute position, for emulators that don't
                    // support deltas.
                    x: this.#mouseX,
                    y: this.#mouseY,
                    deltaX,
                    deltaY,
                });
                this.#mouseX += deltaX;
                this.#mouseY += deltaY;
            },
            trackpadButtonDown: button => {
                this.#input.handleInput({type: "mousedown", button});
            },
            trackpadButtonUp: button => {
                this.#input.handleInput({type: "mouseup", button});
            },
        });
    }

    async start() {
        const {screenCanvas: canvas} = this.#config;
        canvas.addEventListener("pointermove", this.#handlePointerMove);
        canvas.addEventListener("pointerdown", this.#handlePointerDown);
        canvas.addEventListener("pointerup", this.#handlePointerUp);
        canvas.addEventListener("touchstart", this.#handleTouchStart);
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

        let extraMachineFiles: {[fileName: string]: string} = {
            ...this.#config.machine.extraFiles,
        };
        for (const disk of [
            ...this.#config.disks,
            ...(this.#config.delayedDisks ?? []),
        ]) {
            extraMachineFiles = {
                ...extraMachineFiles,
                ...disk.extraMachineFiles?.get(this.#config.machine),
            };
        }

        // Fetch all of the dependent files ourselves, to avoid a waterfall
        // if we let Emscripten handle it (it would first load the JS, and
        // then that would load the WASM and data files).
        const [
            wasm,
            rom,
            basePrefs,
            deviceImageHeader,
            ...extraMachineFileContents
        ] = await load(
            [
                emulatorWasmPath,
                this.#config.machine.romPath,
                this.#config.machine.prefsPath,
                deviceImageHeaderPath,
                ...Object.values(extraMachineFiles),
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

        const disks = await loadDisks(this.#config.disks);
        const delayedDisks = this.#config.delayedDisks
            ? await loadDisks(this.#config.delayedDisks)
            : undefined;

        const autoloadFiles: {[name: string]: ArrayBuffer} = {};
        Object.keys(extraMachineFiles).forEach((fileName, i) => {
            autoloadFiles[fileName] = extraMachineFileContents[i];
        });

        let args: string[] = [];
        let configDebugStr;
        const {emulatorType} = this.#config.machine;
        if (emulatorType === "DingusPPC") {
            args = configToDingusPPCArgs(this.#config, {disks, romFileName});
            configDebugStr = args.join(" ");
        } else if (emulatorType === "Previous") {
            const config = configToPreviousConfig(this.#config, {
                baseConfig: basePrefs,
                disks,
                romFileName,
            });
            autoloadFiles["previous.cfg"] = new TextEncoder().encode(
                config
            ).buffer;
            // Previous expects to find all of the disk files on the filesystem,
            // create some dummy files.
            for (const disk of [
                ...disks,
                ...(delayedDisks ?? []),
                ...this.#config.cdroms,
                ...this.#config.diskFiles,
            ]) {
                autoloadFiles[disk.name] = new ArrayBuffer(0);
            }
            configDebugStr = config;
        } else {
            const prefs = configToEmulatorPrefs(this.#config, {
                basePrefs,
                disks,
                romFileName,
            });
            args = ["--config", "prefs"];
            autoloadFiles["prefs"] = new TextEncoder().encode(prefs).buffer;
            configDebugStr = prefs;
        }
        console.groupCollapsed(
            "%cGenerated emulator config",
            "font-weight: normal"
        );
        console.log(configDebugStr);
        console.groupEnd();

        const dateOffset = this.#config.customDate
            ? this.#config.customDate.getTime() - Date.now()
            : 0;

        const config: EmulatorWorkerConfig = {
            ...({
                emulatorType: this.#config.machine.emulatorType,
                emulatorSubtype: this.#config.machine.emulatorSubtype,
            } as EmulatorDef),
            wasm,
            disks,
            delayedDisks,
            diskFiles: this.#config.diskFiles,
            deviceImageHeader,
            cdroms: await this.#handleCDROMs(this.#config.cdroms),
            usePlaceholderDisks: emulatorUsesPlaceholderDisks(emulatorType),
            autoloadFiles: {
                [romFileName]: rom,
                ...autoloadFiles,
            },
            arguments: args,
            video: this.#video.workerConfig(),
            input: this.#input.workerConfig(),
            audio: this.#audio.workerConfig(),
            files: this.#files.workerConfig(),
            ethernet: this.#ethernet.workerConfig(),
            clipboard: this.#clipboard.workerConfig(),
            dateOffset,
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
            wasm,
            rom,
            deviceImageHeader,
            ...Object.values(autoloadFiles),
        ]);
    }

    refreshSettings() {
        const settings = this.#delegate?.emulatorSettings?.(this);
        const speed = settings?.speed;
        if (speed !== undefined) {
            this.#input.handleInput({type: "set-speed", speed});
        }
        const useMouseDeltas = this.#trackpadMode() || settings?.useMouseDeltas;
        if (useMouseDeltas !== undefined) {
            this.#input.handleInput({
                type: "set-use-mouse-deltas",
                useMouseDeltas,
            });
        }
    }

    stop() {
        const {screenCanvas: canvas} = this.#config;
        canvas.removeEventListener("pointermove", this.#handlePointerMove);
        canvas.removeEventListener("pointerdown", this.#handlePointerDown);
        canvas.removeEventListener("pointerup", this.#handlePointerUp);
        canvas.removeEventListener("touchstart", this.#handleTouchStart);
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
        // Wait for handleEmulatorStopped to be invoked, so that disk savers
        // are cleanly closed.
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

    async uploadFiles(files: File[], names: string[] = []) {
        const remainingFiles = [];
        const remainingNames: string[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const uploads = await uploadsFromFile(file);
            if (uploads) {
                this.#files.uploadFiles(uploads);
                continue;
            }
            remainingFiles.push(file);
            remainingNames.push(names[i]);
        }
        if (!remainingFiles.length) {
            return;
        }
        this.#files.uploadFiles(
            remainingFiles.map((file, i) => ({
                name: remainingNames[i] ?? file.name, // Full paths are handled by worker
                url: URL.createObjectURL(file),
                size: file.size,
            }))
        );
    }

    async loadCDROM(cdrom: EmulatorCDROM) {
        const cdroms = await this.#handleCDROMs([cdrom]);
        this.#files.loadCDROM(cdroms[0]);
    }

    async #handleCDROMs(cdroms: EmulatorCDROM[]): Promise<EmulatorCDROM[]> {
        const result = [];
        for (const cdrom of cdroms) {
            if (cdrom.fetchClientSide) {
                result.push(
                    await fetchCDROM(cdrom, loadedFraction => {
                        this.#delegate?.emulatorDidMakeCDROMLoadingProgress?.(
                            this,
                            cdrom,
                            loadedFraction
                        );
                    })
                );
            } else {
                result.push(cdrom);
            }
        }
        return result;
    }

    #useMouseDeltas() {
        const {emulatorType} = this.#config.machine;
        return (
            emulatorNeedsMouseDeltas(emulatorType) ||
            (this.#delegate?.emulatorSettings?.(this).useMouseDeltas === true &&
                emulatorSupportsMouseDeltas(emulatorType))
        );
    }

    #trackpadMode() {
        if (this.#useMouseDeltas() && !HAS_HOVER_EVENTS) {
            return true;
        }
        return (
            this.#delegate?.emulatorSettings?.(this).trackpadMode ??
            this.#config.debugTrackpad ??
            false
        );
    }

    #handlePointerMove = (event: PointerEvent) => {
        if (this.#trackpadMode()) {
            this.#trackpadController.handlePointerMove(event);
        } else {
            this.#mouseX = event.offsetX;
            this.#mouseY = event.offsetY;
            this.#input.handleInput({
                type: "mousemove",
                x: event.offsetX,
                y: event.offsetY,
                deltaX: event.movementX,
                deltaY: event.movementY,
            });
        }
    };

    #handlePointerDown = (event: PointerEvent) => {
        if (this.#trackpadMode()) {
            this.#trackpadController.handlePointerDown(event);
            return;
        }
        this.#mouseX = event.offsetX;
        this.#mouseY = event.offsetY;
        const handleMouseDown = () => {
            this.#input.handleInput({
                type: "mousedown",
                button: event.button,
            });
        };
        if (HAS_HOVER_EVENTS) {
            handleMouseDown();
        } else {
            // If we don't have hover events (e.g. we're on mobile), it means
            // that we haven't gotten movement events to the current location,
            // so we need to first send the coordinates and then (after they've
            // been processed, which will hopefully be within a frame) send the
            // click event.
            this.#input.handleInput({
                type: "mousemove",
                x: event.offsetX,
                y: event.offsetY,
                deltaX: event.movementX,
                deltaY: event.movementY,
            });
            setTimeout(handleMouseDown, 16);
        }
        if (this.#useMouseDeltas() && !this.#requestedPointerLock) {
            this.#config.screenCanvas.requestPointerLock({
                unadjustedMovement: false,
            });
            this.#requestedPointerLock = true;
        }
    };

    #handlePointerLockChange = (event: Event): void => {
        if (!document.pointerLockElement) {
            this.#requestedPointerLock = false;
        }
    };

    #handlePointerUp = (event: PointerEvent) => {
        if (this.#trackpadMode()) {
            this.#trackpadController.handlePointerUp(event);
        } else {
            this.#input.handleInput({type: "mouseup", button: event.button});
        }
    };

    #handleTouchStart = (event: TouchEvent) => {
        // Make sure that text selection is not triggered when doing tap and
        // drag gestures.
        event.preventDefault();
    };

    #handleKeyDown = (event: KeyboardEvent) => {
        const {target, code} = event;
        // Ignore input events in UI, except for the dummy <input> that we use
        // to get keyboard events on mobile.
        if (
            target instanceof HTMLInputElement &&
            !target.classList.contains("Mac-Keyboard-Input")
        ) {
            return;
        }
        event.preventDefault();
        const adbKeyCode = this.#getAdbKeyCode(code);
        if (adbKeyCode !== undefined) {
            this.#downKeyCodes.add(code);

            // If this is a paste operation, send the updated clipboard contents
            // to the emulator so that it can be used when executing the paste.
            // Ideally we would watch for a clipboardchange event, but that's not
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
                modifiers: this.#getAdbKeyModifiers(event),
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
                    modifiers: this.#getAdbKeyModifiers(event),
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
        if (this.#config.machine.emulatorType === "Previous") {
            return JS_CODE_TO_NEXT_KEYCODE[code];
        }
        if (this.#config.machine.emulatorType === "Mini vMac") {
            const keyCode = JS_CODE_TO_MINI_VMAC_KEYCODE[code];
            if (keyCode !== undefined) {
                return keyCode;
            }
        }
        return JS_CODE_TO_ADB_KEYCODE[code];
    }

    #getAdbKeyModifiers(event: KeyboardEvent): number | undefined {
        // Only Previous needs to have modifiers sent separately.
        if (this.#config.machine.emulatorType !== "Previous") {
            return undefined;
        }
        let modifiers = 0;
        if (event.altKey) {
            modifiers |= 0x20; // NEXTKEY_MOD_LALT
        }
        if (event.shiftKey) {
            modifiers |= 0x02; // NEXTKEY_MOD_LSHIFT
        }
        // Previous appears to already do a meta/control swap, so we need to
        // flip the modifier codes that we send it.
        if (this.#delegate?.emulatorSettings?.(this).swapControlAndCommand) {
            if (event.ctrlKey) {
                modifiers |= 0x08; // NEXTKEY_MOD_LCTRL
            }
            if (event.metaKey) {
                modifiers |= 0x01; // NEXTKEY_MOD_META
            }
        } else {
            if (event.ctrlKey) {
                modifiers |= 0x01; // NEXTKEY_MOD_META
            }
            if (event.metaKey) {
                modifiers |= 0x08; // NEXTKEY_MOD_LCTRL
            }
        }
        return modifiers;
    }

    #handleBeforeUnload = (event: Event) => {
        // On macOS hosts it's too easy to accidentally close the tab due to
        // muscle memory for Command-W, so we'll ask for confirmation if the
        // navigation away is due a command+key combination.
        if (
            navigator.platform.startsWith("Mac") &&
            Array.from(this.#downKeyCodes).some(code => code.startsWith("Meta"))
        ) {
            event.preventDefault();

            // We'll never get a keyup event for the command key, so we'll
            // need to synthesize one to avoid the guest ending up with it
            // stuck on.
            for (const code of this.#downKeyCodes) {
                const adbKeyCode = this.#getAdbKeyCode(code);
                if (adbKeyCode !== undefined) {
                    this.#input.handleInput({
                        type: "keyup",
                        keyCode: adbKeyCode,
                    });
                }
            }
            this.#downKeyCodes.clear();
        }
    };

    #handleWorkerMessage = (e: MessageEvent) => {
        if (e.data.type === "emulator_ready") {
            this.#delegate?.emulatorDidFinishLoading?.(this);
        } else if (e.data.type === "emulator_video_open") {
            console.log(
                `Initializing video (${e.data.width}x${e.data.height})`
            );
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
            this.#delegate?.emulatorDidBecomeQuiescent?.(this);
        } else if (e.data.type === "emulator_stopped") {
            this.#handleEmulatorStopped(e.data.isExit);
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

    async #handleEmulatorStopped(isExit?: boolean) {
        this.#worker.removeEventListener("message", this.#handleWorkerMessage);
        this.#worker.terminate();
        this.#workerTerminated = true;
        if (isExit) {
            this.#delegate?.emulatorDidExit?.(this);
        }
    }
}

async function load(
    paths: string[],
    progress: (total: number, left: number) => any
): Promise<ArrayBuffer[]> {
    let left = paths.length;
    progress(paths.length, left);
    const arrayBuffers: ArrayBuffer[] = [];
    await Promise.all(
        paths.map(async (path, i) => {
            const response = await fetch(path);
            arrayBuffers[i] = await response.arrayBuffer();
            progress(paths.length, --left);
        })
    );
    return arrayBuffers;
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
        hasDeviceImageHeader: d.hasDeviceImageHeader,
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
        prefsStr += `disk ${cdrom.mountReadWrite ? "" : "*"}${cdrom.name}\n`;
    }
    for (const diskFile of config.diskFiles) {
        if (diskFile.isCDROM) {
            prefsStr += `cdrom ${diskFile.name}\n`;
        } else {
            prefsStr += `disk ${diskFile.name}\n`;
        }
    }
    if (emulatorUsesPlaceholderDisks(machine.emulatorType)) {
        for (let i = 0; i < EMULATOR_REMOVABLE_DISK_COUNT; i++) {
            prefsStr += `disk */placeholder/${i}\n`;
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

function configToDingusPPCArgs(
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
        args.push("--log-to-stderr", "--log-no-uptime", "--log-verbosity=5");
    }
    const floppies = [];
    const hardDisks = [];
    const cdroms = [];
    for (const spec of disks) {
        if (spec.isFloppy) {
            floppies.push(spec.name);
        } else {
            hardDisks.push(spec.name);
        }
    }
    for (const spec of config.cdroms) {
        cdroms.push(spec.name);
    }
    for (const diskFile of config.diskFiles) {
        if (diskFile.isCDROM) {
            cdroms.push(diskFile.name);
        } else {
            hardDisks.push(diskFile.name);
        }
    }
    if (floppies.length > 0) {
        // TODO: support more than one floppy
        args.push("--fdd_img", floppies[0]);
        // Disks are not actually writable, and by disabling writing we avoid
        // a system beep that causes the emulator to abort.
        args.push("--fdd_wr_prot=1");
    }
    if (hardDisks.length > 0) {
        // TODO: support more than one hard disk on IDE-based machines
        if (config.machine.gestaltID !== POWER_MACINTOSH_G3_BEIGE.gestaltID) {
            args.push("--hdd_img", hardDisks.join(":"));
        } else {
            args.push("--hdd_img", hardDisks[0]);
        }
    }
    if (cdroms.length > 0) {
        // TODO: support more than one CD-ROM
        args.push("--cdr_img", cdroms[0]);
    }
    const ramSize = config.ramSize ?? config.machine.ramSizes[0];
    switch (config.machine.gestaltID) {
        case POWER_MACINTOSH_6100.gestaltID: {
            // The passed in RAM size is the total, convert it to installed SIMMs
            // that are needed on top of the built-in 8 MB.
            const simmSize = Math.floor((parseInt(ramSize) - 8) / 2).toString();
            args.push("--rambank1_size", simmSize);
            args.push("--rambank2_size", simmSize);
            break;
        }
        default:
            args.push("--rambank1_size", ramSize.slice(0, -1));
            break;
    }

    // DingusPPC normally auto-detects the machine based on the ROM, but in some
    // cases the same ROM was used for multiple machines and we need to give it
    // an explicit hint.
    switch (config.machine.gestaltID) {
        case POWER_MACINTOSH_7500.gestaltID:
            args.push("--machine", "pm7500");
            break;
        case POWER_MACINTOSH_G3_BW_DPPC.gestaltID:
            args.push("--machine", "pmg3nw");
            args.push("--pci_J12", "AtiMach64Gx");
            break;
    }

    // Map screen sizes to the a monitor ID
    if (config.machine.supportedScreenSizes) {
        for (const size of config.machine.supportedScreenSizes) {
            if (
                size.width === config.screenWidth &&
                size.height === config.screenHeight &&
                size.monitorId
            ) {
                args.push("--mon_id", size.monitorId);
                break;
            }
        }
    }

    return args;
}

function configToPreviousConfig(
    config: EmulatorConfig,
    {
        baseConfig,
        romFileName,
        disks,
    }: {
        baseConfig: ArrayBuffer;
        romFileName: string;
        disks: EmulatorChunkedFileSpec[];
    }
): string {
    const floppyStrs: string[] = [];
    const diskStrs: string[] = [];
    function addDisk(
        strs: string[],
        name: string,
        isCDROM: boolean,
        isInserted: boolean = true
    ) {
        const i = strs.length;
        strs.push(`
szImageName${i} = ${name}
nDeviceType${i} = ${isCDROM ? 2 : 1}
bDiskInserted${i} = ${isInserted ? "TRUE" : "FALSE"}
bWriteProtected${i} = ${isCDROM ? "TRUE" : "FALSE"}
`);
    }
    for (const disk of disks) {
        addDisk(disk.isFloppy ? floppyStrs : diskStrs, disk.name, false);
    }
    for (const diskFile of config.diskFiles) {
        addDisk(diskStrs, diskFile.name, diskFile.isCDROM);
    }
    for (const spec of config.cdroms) {
        // If all we have is a CD-ROM, assume it's actually a hard drive image
        // (since read-only media can't be booted from).
        const isCDROM = diskStrs.length > 0;
        addDisk(diskStrs, spec.name, isCDROM);
    }

    // Placeholder used to handle CD-ROMs being inserted after boot.
    addDisk(diskStrs, "/", true, false);

    // Possible values come from the BOOT_DEVICE enum in Previous's
    // configuration.h.
    let bootDevice = 1; // BOOT_SCSI
    if (
        config.cdroms.length + config.disks.length + config.diskFiles.length ===
        0
    ) {
        bootDevice = 0; // BOOT_ROM
    } else if (disks.length === 1 && disks[0].isFloppy) {
        bootDevice = 4; // BOOT_FLOPPY
    }

    const {machine} = config;
    const turbo = machine.emulatorSubtype === "NeXTstation Turbo Color";

    // Based on Configuration_SetSystemDefaults for the different machines
    const replacements: {[key: string]: number | string | boolean} = {
        "MACHINE_TYPE": machine.gestaltID,
        "ROM_PATH": romFileName,
        "FLOPPIES": floppyStrs.join("\n"),
        "DISKS": diskStrs.join("\n"),
        "DEBUG_LOG": config.debugLog ?? false,
        "BOOT_DEVICE": bootDevice,
        "TURBO": turbo,
        "COLOR": turbo,
        "CPU_LEVEL": machine.cpu === "68040" ? 4 : 3,
        "CPU_FREQ":
            // Technically the Turbo only had a 33 MHz 68040, but simulate it being
            // upgraded with a Nitro card to get a bit more pep.
            turbo ? 40 : 25,
        "FPU_TYPE": machine.cpu === "68040" ? "68040" : "68882",
        "DSP_TYPE": 2, // DSP_TYPE_EMU
        "DSP_MEMORY_EXPANSION": machine.emulatorSubtype !== "NeXT Computer",
        "SCSI_CHIP": machine.emulatorSubtype !== "NeXT Computer",
        "RTC_CHIP": turbo,
        "NBIC":
            machine.emulatorSubtype === "NeXT Computer" ||
            machine.emulatorSubtype === "NeXTcube",
    };

    const ramSize = config.ramSize ?? config.machine.ramSizes[0];
    // Replicate valid combinations from defmemsize in Previous's dlgAdvanced.c.
    const RAM_BANKS: {[size: MachineDefRAMSize]: number[]} = {
        "128M": [32, 32, 32, 32],
        "64M": turbo ? [32, 32, 0, 0] : [16, 16, 16, 16],
        "32M": turbo ? [8, 8, 8, 8] : [16, 16, 0, 0],
        "16M": turbo ? [8, 8, 0, 0] : [16, 0, 0, 0],
    };
    const ramBankSizes =
        ramSize in RAM_BANKS ? RAM_BANKS[ramSize] : RAM_BANKS["128M"];
    ramBankSizes.forEach(
        (size, i) => (replacements[`RAM_BANK_SIZE${i}`] = size)
    );

    let configStr = new TextDecoder().decode(baseConfig);
    for (const [key, value] of Object.entries(replacements)) {
        const replacement =
            typeof value === "boolean"
                ? value
                    ? "TRUE"
                    : "FALSE"
                : value.toString();
        configStr = configStr.replaceAll(`{${key}}`, replacement);
    }
    return configStr;
}

const HAS_HOVER_EVENTS =
    "matchMedia" in window && window.matchMedia("(hover: hover)").matches;
