import type {
    EmulatorFallbackCommand,
    EmulatorInputEvent,
    EmulatorWorkerConfig,
    EmulatorWorkerVideoBlit,
} from "./emulator-common";
import {InputBufferAddresses} from "./emulator-common";
import BasiliskIIPath from "./BasiliskII.jsz";
import BasiliskIIWasmPath from "./BasiliskII.wasmz";
import type {EmulatorWorkerAudio} from "./emulator-worker-audio";
import {
    FallbackEmulatorWorkerAudio,
    SharedMemoryEmulatorWorkerAudio,
} from "./emulator-worker-audio";
import type {EmulatorWorkerInput} from "./emulator-worker-input";
import {
    FallbackEmulatorWorkerInput,
    SharedMemoryEmulatorWorkerInput,
} from "./emulator-worker-input";
import type {EmulatorWorkerVideo} from "./emulator-worker-video";
import {
    FallbackEmulatorWorkerVideo,
    SharedMemoryEmulatorWorkerVideo,
} from "./emulator-worker-video";

declare const Module: EmscriptenModule;
declare const workerCommands: EmulatorFallbackCommand[];

self.onmessage = function (msg) {
    startEmulator(msg.data);
};

class EmulatorWorkerApi {
    InputBufferAddresses = InputBufferAddresses;

    #video: EmulatorWorkerVideo;
    #input: EmulatorWorkerInput;
    #audio: EmulatorWorkerAudio;

    #lastBlitFrameId = 0;
    #lastBlitFrameHash = 0;
    #nextExpectedBlitTime = 0;
    #lastIdleWaitFrameId = 0;

    constructor(config: EmulatorWorkerConfig) {
        const {
            video: videoConfig,
            input: inputConfig,
            audio: audioConfig,
        } = config;
        const blitSender = (
            data: EmulatorWorkerVideoBlit,
            transfer: Transferable[] = []
        ) => postMessage({type: "emulator_blit", data}, transfer);
        const audioSender = (data: Uint8Array) =>
            postMessage({type: "emulator_audio", data}, [data.buffer]);

        this.#video =
            videoConfig.type === "shared-memory"
                ? new SharedMemoryEmulatorWorkerVideo(videoConfig, blitSender)
                : new FallbackEmulatorWorkerVideo(videoConfig, blitSender);
        this.#input =
            inputConfig.type === "shared-memory"
                ? new SharedMemoryEmulatorWorkerInput(inputConfig)
                : new FallbackEmulatorWorkerInput(
                      inputConfig,
                      new EmulatorFallbackEndpoint()
                  );
        this.#audio =
            audioConfig.type === "shared-memory"
                ? new SharedMemoryEmulatorWorkerAudio(audioConfig)
                : new FallbackEmulatorWorkerAudio(audioConfig, audioSender);
    }

    blit(
        bufPtr: number,
        width: number,
        height: number,
        depth: number,
        usingPalette: number,
        hash: number
    ) {
        this.#lastBlitFrameId++;
        if (hash !== this.#lastBlitFrameHash) {
            this.#lastBlitFrameHash = hash;
            const length = width * height * (depth === 32 ? 4 : 1); // 32bpp or 8bpp
            const data = Module.HEAPU8.subarray(bufPtr, bufPtr + length);
            this.#video.blit(data, width, height, depth, usingPalette);
        }
        this.#nextExpectedBlitTime = performance.now() + 16;
    }

    openAudio(
        sampleRate: number,
        sampleSize: number,
        channels: number,
        framesPerBuffer: number
    ) {
        this.#audio.openAudio(
            sampleRate,
            sampleSize,
            channels,
            framesPerBuffer
        );
    }

    enqueueAudio(bufPtr: number, nbytes: number, type: number): number {
        const newAudio = Module.HEAPU8.slice(bufPtr, bufPtr + nbytes);
        return this.#audio.enqueueAudio(newAudio);
    }

    debugPointer(ptr: any) {
        console.log("debugPointer", ptr);
    }

    idleWait() {
        // Don't do more than one call per frame, otherwise we end up skipping
        // frames.
        // TOOD: understand why IdleWait is called multiple times in a row
        // before VideoRefresh is called again.
        if (this.#lastIdleWaitFrameId === this.#lastBlitFrameId) {
            return;
        }
        this.#lastIdleWaitFrameId = this.#lastBlitFrameId;
        this.#input.idleWait(
            this.#nextExpectedBlitTime - performance.now() - 2
        );
    }

    acquireInputLock(): number {
        return this.#input.acquireInputLock();
    }

    releaseInputLock() {
        this.#input.releaseInputLock();
    }

    getInputValue(addr: number): number {
        return this.#input.getInputValue(addr);
    }
}

export class EmulatorFallbackEndpoint {
    #commandQueue: EmulatorFallbackCommand[] = [];

    idleWait(timeout: number) {
        importScripts(
            `./worker-idlewait.js?timeout=${timeout}&t=${Date.now()}`
        );
    }

    consumeInputEvents(): EmulatorInputEvent[] {
        this.#fetchCommands();
        const remainingCommands: EmulatorFallbackCommand[] = [];
        const inputEvents: EmulatorInputEvent[] = [];
        for (const command of this.#commandQueue) {
            if (command.type === "input") {
                inputEvents.push(command.event);
            } else {
                remainingCommands.push(command);
            }
        }
        this.#commandQueue = remainingCommands;
        return inputEvents;
    }

    #fetchCommands() {
        importScripts(`./worker-commands.js?t=${Date.now()}`);
        if (typeof workerCommands !== "undefined") {
            const commands = workerCommands;
            this.#commandQueue = this.#commandQueue.concat(commands);
        } else {
            console.warn("Could not load worker commands");
        }
    }
}

function startEmulator(config: EmulatorWorkerConfig) {
    const workerApi = new EmulatorWorkerApi(config);

    let addedPreloadedFiles = false;
    let totalDependencies = 0;
    const moduleOverrides: Partial<EmscriptenModule> = {
        arguments: config.arguments,
        locateFile(path: string, scriptDirectory: string) {
            if (path === "BasiliskII.wasm") {
                return BasiliskIIWasmPath;
            }
            return scriptDirectory + path;
        },

        preRun: [
            function () {
                for (const [name, path] of Object.entries(
                    config.autoloadFiles
                )) {
                    FS.createPreloadedFile(
                        "/",
                        name,
                        path as string,
                        true,
                        true
                    );
                }
                addedPreloadedFiles = true;
            },
        ],

        onRuntimeInitialized() {
            (globalThis as any).workerApi = workerApi;
        },

        monitorRunDependencies(left: number) {
            if (!addedPreloadedFiles) {
                return;
            }
            totalDependencies = Math.max(totalDependencies, left);

            if (left === 0) {
                postMessage({type: "emulator_ready"});
            } else {
                postMessage({
                    type: "emulator_loading",
                    total: totalDependencies,
                    left,
                });
            }
        },

        print: console.log.bind(console),

        printErr: console.warn.bind(console),
    };
    (self as any).Module = moduleOverrides;

    importScripts(BasiliskIIPath);
}
