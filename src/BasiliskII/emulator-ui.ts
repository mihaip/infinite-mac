import type {
    EmulatorFallbackCommand,
    EmulatorWorkerConfig,
    EmulatorWorkerVideoBlit,
} from "./emulator-common";
import Worker from "worker-loader!./emulator-worker";
import registerServiceWorker, {
    ServiceWorkerNoSupportError,
} from "service-worker-loader!./emulator-fallback-service-worker";
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
import {handleDirectoryExtraction} from "./emulator-ui-extractor";
import {loadLibrary} from "./emulator-ui-library";

export type EmulatorConfig = {
    useTouchEvents: boolean;
    useSharedMemory: boolean;
    screenWidth: number;
    screenHeight: number;
    screenCanvas: HTMLCanvasElement;
    basiliskPrefsPath: string;
    romPath: string;
    diskPath: string;
};

export interface EmulatorDelegate {
    emulatorDidMakeLoadingProgress?(
        emulator: Emulator,
        total: number,
        left: number
    ): void;
    emulatorDidDidFinishLoading?(emulator: Emulator): void;
}

export type EmulatorFallbackCommandSender = (
    command: EmulatorFallbackCommand
) => Promise<void>;

export class Emulator {
    #config: EmulatorConfig;
    #delegate?: EmulatorDelegate;
    #worker: Worker;

    #screenCanvasContext: CanvasRenderingContext2D;
    #screenImageData: ImageData;

    #video: EmulatorVideo;
    #input: EmulatorInput;
    #audio: EmulatorAudio;
    #startedAudio: boolean = false;
    #files: EmulatorFiles;

    #fallbackServiceWorker?: ServiceWorker;
    #fallbackServiceWorkerReady?: Promise<boolean>;

    constructor(config: EmulatorConfig, delegate?: EmulatorDelegate) {
        this.#config = config;
        this.#delegate = delegate;
        this.#worker = new Worker();
        const {
            useSharedMemory,
            screenCanvas: canvas,
            screenWidth,
            screenHeight,
        } = this.#config;

        let fallbackCommandSender: EmulatorFallbackCommandSender;
        if (!useSharedMemory) {
            this.#initFallbackServiceWorker();
            fallbackCommandSender = async (
                command: EmulatorFallbackCommand
            ) => {
                await this.#fallbackServiceWorkerReady!;
                this.#fallbackServiceWorker!.postMessage({
                    type: "worker-command",
                    command,
                });
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
            ? new SharedMemoryEmulatorAudio()
            : new FallbackEmulatorAudio();
        this.#files = useSharedMemory
            ? new SharedMemoryEmulatorFiles()
            : new FallbackEmulatorFiles(fallbackCommandSender!);
    }

    async start() {
        const {
            useTouchEvents,
            useSharedMemory,
            screenCanvas: canvas,
        } = this.#config;
        if (useTouchEvents) {
            canvas.addEventListener("touchmove", this.#handleTouchMove);
            canvas.addEventListener("touchstart", this.#handleTouchStart);
            canvas.addEventListener("touchend", this.#handleTouchEnd);
        } else {
            canvas.addEventListener("mousemove", this.#handleMouseMove);
            canvas.addEventListener("mousedown", this.#handleMouseDown);
            canvas.addEventListener("mouseup", this.#handleMouseUp);
        }
        window.addEventListener("keydown", this.#handleKeyDown);
        window.addEventListener("keyup", this.#handleKeyUp);
        window.addEventListener("beforeunload", this.#handleBeforeUnload);

        document.addEventListener(
            "visibilitychange",
            this.#handleVisibilityChange
        );

        this.#worker.addEventListener("message", this.#handleWorkerMessage);

        const config: EmulatorWorkerConfig = {
            autoloadFiles: {
                "MacOS753": this.#config.diskPath,
                "Quadra-650.rom": this.#config.romPath,
                "prefs": this.#config.basiliskPrefsPath,
            },
            arguments: ["--config", "prefs"],

            video: this.#video.workerConfig(),
            input: this.#input.workerConfig(),
            audio: this.#audio.workerConfig(),
            files: this.#files.workerConfig(),
            library: await loadLibrary(),
        };

        if (!useSharedMemory) {
            await this.#fallbackServiceWorkerReady;
        }
        this.#worker.postMessage({type: "start", config});
    }

    stop() {
        const {useTouchEvents, screenCanvas: canvas} = this.#config;
        if (useTouchEvents) {
            canvas.removeEventListener("touchmove", this.#handleTouchMove);
            canvas.removeEventListener("touchstart", this.#handleTouchStart);
            canvas.removeEventListener("touchend", this.#handleTouchEnd);
        } else {
            canvas.removeEventListener("mousemove", this.#handleMouseMove);
            canvas.removeEventListener("mousedown", this.#handleMouseDown);
            canvas.removeEventListener("mouseup", this.#handleMouseUp);
        }
        window.removeEventListener("keydown", this.#handleKeyDown);
        window.removeEventListener("keyup", this.#handleKeyUp);
        window.removeEventListener("beforeunload", this.#handleBeforeUnload);

        document.removeEventListener(
            "visibilitychange",
            this.#handleVisibilityChange
        );

        this.#worker.removeEventListener("message", this.#handleWorkerMessage);

        this.#worker.terminate();
    }

    uploadFile(file: File) {
        this.#files.uploadFile({
            name: file.name,
            url: URL.createObjectURL(file),
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
        this.#input.handleInput({type: "keydown", keyCode: event.keyCode});
    };

    #handleKeyUp = (event: KeyboardEvent) => {
        this.#input.handleInput({type: "keyup", keyCode: event.keyCode});
    };

    #handleBeforeUnload = () => {
        // Mostly necessary for the fallback mode, otherwise the page can hang
        // during reload because the worker is not yielding.
        this.stop();
    };

    #handleWorkerMessage = (e: MessageEvent) => {
        if (e.data.type === "emulator_ready") {
            this.#delegate?.emulatorDidDidFinishLoading?.(this);
        } else if (e.data.type === "emulator_loading") {
            this.#delegate?.emulatorDidMakeLoadingProgress?.(
                this,
                e.data.total,
                e.data.left
            );
        } else if (e.data.type === "emulator_blit") {
            const blitData: EmulatorWorkerVideoBlit = e.data.data;
            this.#video.blit(blitData);
            this.#drawScreen();
        } else if (e.data.type === "emulator_audio") {
            if (this.#audio instanceof FallbackEmulatorAudio) {
                this.#audio.handleData(e.data.data);
            }
        } else if (e.data.type === "emulator_extract_directory") {
            handleDirectoryExtraction(e.data.extraction);
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
        this.#video.putImageData(this.#screenImageData);
        this.#screenCanvasContext.putImageData(this.#screenImageData, 0, 0);
    }

    #initFallbackServiceWorker() {
        this.#fallbackServiceWorkerReady = new Promise((resolve, reject) => {
            registerServiceWorker()
                .then(registration => {
                    const handleStateChange = (event: Event) => {
                        const {state} = this.#fallbackServiceWorker!;
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
                        this.#fallbackServiceWorker = registration.installing;
                        registration.installing.addEventListener(
                            "statechange",
                            handleStateChange
                        );
                    } else if (registration.waiting) {
                        console.log("Service worker installed, waiting");
                        this.#fallbackServiceWorker = registration.waiting;
                        registration.waiting.addEventListener(
                            "statechange",
                            handleStateChange
                        );
                    } else if (registration.active) {
                        this.#fallbackServiceWorker = registration.active;
                        registration.active.addEventListener(
                            "statechange",
                            handleStateChange
                        );
                        console.log("Service worker active");
                        resolve(true);
                    }
                })
                .catch(err => {
                    if (err instanceof ServiceWorkerNoSupportError) {
                        console.error("Service workers are not supported");
                    }
                    reject(err);
                });
        });
    }
}
