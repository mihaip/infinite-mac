import type {
    EmulatorFallbackCommand,
    EmulatorFallbackInputCommand,
    EmulatorFallbackUploadFileCommand,
    EmulatorFileUpload,
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
import type {EmulatorWorkerFiles} from "./emulator-worker-files";
import {
    FallbackEmulatorWorkerFiles,
    SharedMemoryEmulatorWorkerFiles,
} from "./emulator-worker-files";

declare const Module: EmscriptenModule;
declare const workerCommands: EmulatorFallbackCommand[];

self.onmessage = function (event) {
    const {data} = event;
    const {type} = data;
    if (type === "start") {
        startEmulator(data.config);
    }
};

class EmulatorWorkerApi {
    InputBufferAddresses = InputBufferAddresses;

    #video: EmulatorWorkerVideo;
    #input: EmulatorWorkerInput;
    #audio: EmulatorWorkerAudio;
    #files: EmulatorWorkerFiles;

    #lastBlitFrameId = 0;
    #lastBlitFrameHash = 0;
    #nextExpectedBlitTime = 0;
    #lastIdleWaitFrameId = 0;

    constructor(config: EmulatorWorkerConfig) {
        const {
            video: videoConfig,
            input: inputConfig,
            audio: audioConfig,
            files: filesConfig,
        } = config;
        const blitSender = (
            data: EmulatorWorkerVideoBlit,
            transfer: Transferable[] = []
        ) => postMessage({type: "emulator_blit", data}, transfer);
        const audioSender = (data: Uint8Array) =>
            postMessage({type: "emulator_audio", data}, [data.buffer]);

        let fallbackEndpoint: EmulatorFallbackEndpoint | undefined;
        function getFallbackEndpoint(): EmulatorFallbackEndpoint {
            if (!fallbackEndpoint) {
                fallbackEndpoint = new EmulatorFallbackEndpoint();
            }
            return fallbackEndpoint;
        }

        this.#video =
            videoConfig.type === "shared-memory"
                ? new SharedMemoryEmulatorWorkerVideo(videoConfig, blitSender)
                : new FallbackEmulatorWorkerVideo(videoConfig, blitSender);
        this.#input =
            inputConfig.type === "shared-memory"
                ? new SharedMemoryEmulatorWorkerInput(inputConfig)
                : new FallbackEmulatorWorkerInput(
                      inputConfig,
                      getFallbackEndpoint()
                  );
        this.#audio =
            audioConfig.type === "shared-memory"
                ? new SharedMemoryEmulatorWorkerAudio(audioConfig)
                : new FallbackEmulatorWorkerAudio(audioConfig, audioSender);
        this.#files =
            filesConfig.type === "shared-memory"
                ? new SharedMemoryEmulatorWorkerFiles(filesConfig)
                : new FallbackEmulatorWorkerFiles(
                      filesConfig,
                      getFallbackEndpoint()
                  );
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

        // TODO: better place to poll for this? On the other hand, only doing it
        // when the machine is idle seems reasonable.
        this.#handleFileUploads();
    }

    #handleFileUploads() {
        const fileUploads = this.#files.fileUploads();
        for (const upload of fileUploads) {
            // We can't use FS.createLazyFile on blob URLs because Emcripten's
            // implementation tries to do a HEAD request on them, which is not
            // supported. Eagerly create those files instead (this should be
            // cheap because there's no network round-trip for it).
            if (upload.url.startsWith("blob:")) {
                const xhr = new XMLHttpRequest();
                xhr.responseType = "arraybuffer";
                xhr.open("GET", upload.url, false);
                xhr.send();
                const data = new Uint8Array(xhr.response as ArrayBuffer);

                const stream = FS.open(
                    "/Shared/Downloads/" + upload.name,
                    "w+"
                );
                FS.write(stream, data, 0, data.length, 0);
                FS.close(stream);
            } else {
                FS.createLazyFile(
                    "/Shared/Downloads/",
                    upload.name,
                    upload.url,
                    true,
                    true
                );
            }
        }
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
        return this.#consumeCommands(
            (c): c is EmulatorFallbackInputCommand => c.type === "input",
            c => c.event
        );
    }

    consumeFileUploads(): EmulatorFileUpload[] {
        return this.#consumeCommands(
            (c): c is EmulatorFallbackUploadFileCommand =>
                c.type === "upload_file",
            c => c.upload
        );
    }

    #consumeCommands<T extends EmulatorFallbackCommand, V>(
        filter: (command: EmulatorFallbackCommand) => command is T,
        extractor: (command: T) => V
    ): V[] {
        this.#fetchCommands();
        const remainingCommands: EmulatorFallbackCommand[] = [];
        const result: V[] = [];
        for (const command of this.#commandQueue) {
            if (filter(command)) {
                result.push(extractor(command as T));
            } else {
                remainingCommands.push(command);
            }
        }
        this.#commandQueue = remainingCommands;
        return result;
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
                FS.mkdir("/Shared");
                FS.mkdir("/Shared/Downloads");

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
