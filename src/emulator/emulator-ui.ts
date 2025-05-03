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
import {type MachineDefRAMSize, type MachineDef} from "../machines";
import {type EmulatorDiskDef} from "../disks";
import deviceImageHeaderPath from "../Data/Device Image Header (All Drivers).hda";
import {fetchCDROM} from "./emulator-ui-cdrom";
import {EmulatorTrackpadController} from "./emulator-ui-trackpad";
import {
    configToDingusPPCArgs,
    configToPreviousConfig,
    configToMacemuPrefs,
    configToPearPCConfig,
} from "./emulator-ui-config";
import {stringToArrayBuffer} from "../strings";

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
    emulatorDidDrawScreen?(emulator: Emulator, data: ImageData): void;
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

        const autoloadFiles: {[name: string]: ArrayBufferLike} = {};
        Object.keys(extraMachineFiles).forEach((fileName, i) => {
            autoloadFiles[fileName] = extraMachineFileContents[i];
        });

        let args: string[] = [];
        let configDebugStr;
        const {emulatorType, emulatorSubtype} = this.#config.machine;
        switch (emulatorType) {
            case "DingusPPC":
                args = configToDingusPPCArgs(this.#config, {
                    disks,
                    romFileName,
                });
                configDebugStr = args.join(" ");
                break;
            case "Previous": {
                const config = configToPreviousConfig(this.#config, {
                    baseConfig: basePrefs,
                    disks,
                    romFileName,
                });
                autoloadFiles["previous.cfg"] = stringToArrayBuffer(config);
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
                break;
            }
            case "BasiliskII":
            case "SheepShaver":
            case "Mini vMac": {
                const prefs = configToMacemuPrefs(this.#config, {
                    basePrefs,
                    disks,
                    romFileName,
                });
                args = ["--config", "prefs"];
                autoloadFiles["prefs"] = stringToArrayBuffer(prefs);
                configDebugStr = prefs;
                break;
            }
            case "PearPC": {
                const config = configToPearPCConfig(this.#config, {
                    baseConfig: basePrefs,
                    disks,
                });
                autoloadFiles["PearPC.cfg"] = stringToArrayBuffer(config);
                args = ["PearPC.cfg"];
                configDebugStr = config;
                break;
            }
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
                emulatorType,
                emulatorSubtype,
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
        if (this.#useMouseDeltas() && !document.pointerLockElement) {
            this.#config.screenCanvas.requestPointerLock({
                unadjustedMovement: false,
            });
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
            if (code === "KeyV" && (event.metaKey || event.ctrlKey)) {
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
        this.#delegate?.emulatorDidDrawScreen?.(this, this.#screenImageData);
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

const HAS_HOVER_EVENTS =
    "matchMedia" in window && window.matchMedia("(hover: hover)").matches;
