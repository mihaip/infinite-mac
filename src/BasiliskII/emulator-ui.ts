import type {
    EmulatorChunkedFileSpec,
    EmulatorFallbackCommand,
    EmulatorWorkerConfig,
    EmulatorWorkerDirectorExtraction,
    EmulatorWorkerVideoBlit,
} from "./emulator-common";
import Worker from "worker-loader!./emulator-worker";
import registerServiceWorker, {
    ServiceWorkerNoSupportError,
} from "service-worker-loader!./emulator-service-worker";
import type {EmulatorAudio} from "./emulator-ui-audio";
import {
    FallbackEmulatorAudio,
    SharedMemoryEmulatorAudio,
} from "./emulator-ui-audio";
import type {EmulatorInput} from "./emulator-ui-input";
import {
    FallbackEmulatorInput,
    SharedMemoryEmulatorInput,
} from "./emulator-ui-input";
import type {EmulatorVideo} from "./emulator-ui-video";
import {
    FallbackEmulatorVideo,
    SharedMemoryEmulatorVideo,
} from "./emulator-ui-video";
import type {EmulatorFiles} from "./emulator-ui-files";
import {
    FallbackEmulatorFiles,
    SharedMemoryEmulatorFiles,
} from "./emulator-ui-files";
import {
    handleDirectoryExtraction,
    uploadsFromDirectoryExtractionFile,
} from "./emulator-ui-extractor";
import BasiliskIIPath from "./BasiliskII.jsz";
import BasiliskIIWasmPath from "./BasiliskII.wasmz";
import {getPersistedData, persistData} from "./emulator-ui-persistence";
import {JS_CODE_TO_ADB_KEYCODE} from "./emulator-key-codes";
import type {
    EmulatorEthernet,
    EthernetPingerPeer,
} from "./emulator-ui-ethernet";
import {handleEthernetWrite} from "./emulator-ui-ethernet";
import {
    FallbackEmulatorEthernet,
    SharedMemoryEmulatorEthernet,
    EthernetPinger,
} from "./emulator-ui-ethernet";
import type {EmulatorClipboard} from "./emulator-ui-clipboard";
import {
    FallbackEmulatorClipboard,
    SharedMemoryEmulatorClipboard,
} from "./emulator-ui-clipboard";

export type EmulatorConfig = {
    useSharedMemory: boolean;
    screenWidth: number;
    screenHeight: number;
    screenCanvas: HTMLCanvasElement;
    basiliskPrefsPath: string;
    romPath: string;
    disks: EmulatorChunkedFileSpec[];
    ethernetProvider?: EmulatorEthernetProvider;
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
        peers: ReadonlyArray<EmulatorEthernetPeer>
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
    #startedAudio: boolean = false;
    #files: EmulatorFiles;
    #ethernet: EmulatorEthernet;
    #clipboard: EmulatorClipboard;

    #serviceWorker?: ServiceWorker;
    #serviceWorkerReady?: Promise<boolean>;

    #gotFirstBlit = false;

    #diskImages: {[name: string]: ArrayBuffer} = {};

    #ethernetPinger: EthernetPinger;

    constructor(config: EmulatorConfig, delegate?: EmulatorDelegate) {
        console.time("Emulator first blit");
        console.time("Emulator first idlewait");

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
            alpha: false,
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
            ? new SharedMemoryEmulatorAudio()
            : new FallbackEmulatorAudio();
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

        await this.#startWorker();
    }

    async #startWorker() {
        if (this.#workerTerminated) {
            this.#worker = new Worker();
        }
        this.#worker.addEventListener("message", this.#handleWorkerMessage);

        // Fetch all of the dependent files ourselves, to avoid a waterfall
        // if we let Emscripten handle it (it would first load the JS, and
        // then that would load the WASM and data files).
        const [[jsBlobUrl, wasmBlobUrl], [rom, basePrefs]] = await load(
            [BasiliskIIPath, BasiliskIIWasmPath],
            [this.#config.romPath, this.#config.basiliskPrefsPath],
            (total, left) => {
                this.#delegate?.emulatorDidMakeLoadingProgress?.(
                    this,
                    total,
                    left
                );
            }
        );

        const extraction = await getPersistedData();

        let prefsStr = new TextDecoder().decode(basePrefs);
        prefsStr += `screen win/${this.#config.screenWidth}/${
            this.#config.screenHeight
        }`;
        for (const spec of this.#config.disks) {
            prefsStr = `disk ${spec.name}\n` + prefsStr;
        }
        for (const diskImage of Object.keys(this.#diskImages)) {
            prefsStr += `cdrom /${diskImage}\n`;
        }
        if (this.#config.ethernetProvider) {
            prefsStr += "appletalk true\n";
        }
        // The fallback path does not support high-frequency calls to reading
        // the input (we end up making so many service worker network requests
        // that overall emulation latency suffers).
        prefsStr += `jsfrequentreadinput ${this.#config.useSharedMemory}\n`;
        const prefs = new TextEncoder().encode(prefsStr).buffer;

        const config: EmulatorWorkerConfig = {
            jsUrl: jsBlobUrl,
            wasmUrl: wasmBlobUrl,
            disks: this.#config.disks,
            autoloadFiles: {
                "Quadra-650.rom": rom,
                "prefs": prefs,
                ...this.#diskImages,
            },
            persistedData: extraction,
            arguments: ["--config", "prefs"],

            video: this.#video.workerConfig(),
            input: this.#input.workerConfig(),
            audio: this.#audio.workerConfig(),
            files: this.#files.workerConfig(),
            ethernet: this.#ethernet.workerConfig(),
            clipboard: this.#clipboard.workerConfig(),
        };

        const serviceWorkerAvailable = await this.#serviceWorkerReady;
        if (serviceWorkerAvailable) {
            for (const spec of config.disks) {
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
            prefs,
            ...Object.values(this.#diskImages),
        ]);
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

        this.#input.handleInput({type: "stop"});
        this.#ethernetPinger.stop();
    }

    restart(): Promise<void> {
        this.#input.handleInput({type: "stop"});
        // Wait for handleEmulatorStopped to be invoked, so that data is
        // persisted.
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if (this.#workerTerminated) {
                    clearInterval(interval);
                    this.#startWorker();
                    // Make sure we clear the "stopped" bit set above
                    this.#input.handleInput({type: "start"});
                    resolve();
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

    uploadDiskImage(file: File): Promise<void> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                this.#diskImages[file.name] = reader.result as ArrayBuffer;
                resolve();
            };
            reader.onerror = () => {
                reject(reader.error);
            };
            reader.readAsArrayBuffer(file);
        });
    }

    #handleMouseMove = (event: MouseEvent) => {
        this.#input.handleInput({
            type: "mousemove",
            dx: event.offsetX,
            dy: event.offsetY,
        });
    };

    #handleMouseDown = (event: MouseEvent) => {
        if (!this.#startedAudio) {
            this.#audio.start();
            this.#startedAudio = true;
        }
        this.#input.handleInput({type: "mousedown"});
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
        if (!this.#startedAudio) {
            this.#audio.start();
            this.#startedAudio = true;
        }
        // Though we want to treat this as a mouse down, we haven't gotten the
        // move to the current location yet, so we need to send the coordinates
        // as well.
        this.#input.handleInput({
            type: "touchstart",
            ...this.#getTouchLocation(event),
        });
    };

    #getTouchLocation(event: TouchEvent): {dx: number; dy: number} {
        const touch = event.touches[0];
        const targetBounds = (
            touch.target as HTMLElement
        ).getBoundingClientRect();
        return {
            dx: touch.clientX - targetBounds.left,
            dy: touch.clientY - targetBounds.top,
        };
    }

    #handleTouchEnd = (event: TouchEvent) => {
        this.#input.handleInput({type: "mouseup"});
    };

    #handleKeyDown = (event: KeyboardEvent) => {
        event.preventDefault();
        const {code} = event;
        if (code in JS_CODE_TO_ADB_KEYCODE) {
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
                keyCode: JS_CODE_TO_ADB_KEYCODE[code],
            });
        } else {
            console.warn(`Unhandled key: ${code}`);
        }
    };

    #handleKeyUp = (event: KeyboardEvent) => {
        const {code} = event;
        if (code in JS_CODE_TO_ADB_KEYCODE) {
            this.#input.handleInput({
                type: "keyup",
                keyCode: JS_CODE_TO_ADB_KEYCODE[code],
            });
        }
    };

    #handleBeforeUnload = () => {
        // Mostly necessary for the fallback mode, otherwise the page can hang
        // during reload because the worker is not yielding.
        this.stop();
    };

    #handleWorkerMessage = (e: MessageEvent) => {
        if (e.data.type === "emulator_ready") {
            this.#delegate?.emulatorDidFinishLoading?.(this);
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
        } else if (e.data.type === "emulator_first_idlewait") {
            console.timeEnd("Emulator first idlewait");
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
        } else {
            console.warn("Unexpected postMessage event", e);
        }
    };

    #handleServiceWorkerMessage = (e: MessageEvent) => {
        const {data} = e;
        switch (data.type) {
            case "disk_chunk_fetch_start":
                this.#delegate?.emulatorDidStartToLoadDiskChunk?.(this);
                break;
            case "disk_chunk_fetch_end":
                this.#delegate?.emulatorDidFinishLoadingDiskChunk?.(this);
                break;
            default:
                console.warn("Unexpected message from service worker", data);
                break;
        }
    };

    #handleVisibilityChange = () => {
        this.#drawScreen();
    };

    #drawScreen() {
        if (document.hidden) {
            return;
        }
        this.#video.putImageData(this.#screenImageData);
        this.#screenCanvasContext.putImageData(this.#screenImageData, 0, 0);
    }

    #initServiceWorker() {
        this.#serviceWorkerReady = new Promise((resolve, reject) => {
            registerServiceWorker()
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
                    if (err instanceof ServiceWorkerNoSupportError) {
                        console.error("Service workers are not supported");
                    } else {
                        console.error("Other service worker error", err);
                    }
                    resolve(false);
                });
        });
        navigator.serviceWorker?.addEventListener(
            "message",
            this.#handleServiceWorkerMessage
        );
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
