import {
    EmulatorWorkerConfig,
    InputBufferAddresses,
    LockStates,
} from "./emulator-common";
import BasiliskIIPath from "./BasiliskII.jsz";
import BasiliskIIWasmPath from "./BasiliskII.wasmz";

declare const Module: EmscriptenModule;

self.onmessage = function (msg) {
    startEmulator(msg.data);
};

function releaseCyclicalLock(bufferView: Int32Array, lockIndex: number) {
    Atomics.store(bufferView, lockIndex, LockStates.READY_FOR_UI_THREAD);
}

function tryToAcquireCyclicalLock(
    bufferView: Int32Array,
    lockIndex: number
): number {
    const res = Atomics.compareExchange(
        bufferView,
        lockIndex,
        LockStates.READY_FOR_EMUL_THREAD,
        LockStates.EMUL_THREAD_LOCK
    );
    if (res === LockStates.READY_FOR_EMUL_THREAD) {
        return 1;
    }
    return 0;
}

class EmulatorWorkerApi {
    InputBufferAddresses = InputBufferAddresses;

    #screenBufferView: Uint8Array;
    #videoModeBufferView: Int32Array;
    #inputBufferView: Int32Array;

    #audioDataBufferView: Uint8Array;
    #nextAudioChunkIndex = 0;
    #audioBlockChunkSize: number;

    #lastBlitFrameId = 0;
    #lastBlitFrameHash = 0;
    #nextExpectedBlitTime = 0;
    #lastIdleWaitFrameId = 0;

    constructor(config: EmulatorWorkerConfig) {
        this.#screenBufferView = new Uint8Array(
            config.screenBuffer,
            0,
            config.screenBufferSize
        );

        this.#videoModeBufferView = new Int32Array(
            config.videoModeBuffer,
            0,
            config.videoModeBufferSize
        );

        this.#inputBufferView = new Int32Array(
            config.inputBuffer,
            0,
            config.inputBufferSize
        );

        const {audio: audioConfig} = config;
        this.#audioDataBufferView = new Uint8Array(
            audioConfig.audioDataBuffer,
            0,
            audioConfig.audioDataBufferSize
        );
        this.#audioBlockChunkSize = audioConfig.audioBlockChunkSize;
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
        this.#videoModeBufferView[0] = width;
        this.#videoModeBufferView[1] = height;
        this.#videoModeBufferView[2] = depth;
        this.#videoModeBufferView[3] = usingPalette;
        const length = width * height * (depth === 32 ? 4 : 1); // 32bpp or 8bpp
        if (hash !== this.#lastBlitFrameHash) {
            this.#lastBlitFrameHash = hash;
            this.#screenBufferView.set(
                Module.HEAPU8.subarray(bufPtr, bufPtr + length)
            );
            postMessage({type: "emulator_blit"});
        }
        this.#nextExpectedBlitTime = performance.now() + 16;
    }

    openAudio(
        sampleRate: number,
        sampleSize: number,
        channels: number,
        framesPerBuffer: number
    ) {
        // TODO: actually send this to the UI thread instead of harcoding.
        console.log("audio config", {
            sampleRate,
            sampleSize,
            channels,
            framesPerBuffer,
        });
    }

    enqueueAudio(bufPtr: number, nbytes: number, type: number): number {
        const newAudio = Module.HEAPU8.slice(bufPtr, bufPtr + nbytes);
        // console.assert(
        //   nbytes == parentConfig.audioBlockBufferSize,
        //   `emulator wrote ${nbytes}, expected ${parentConfig.audioBlockBufferSize}`
        // );

        const writingChunkIndex = this.#nextAudioChunkIndex;
        const writingChunkAddr = writingChunkIndex * this.#audioBlockChunkSize;

        if (
            this.#audioDataBufferView[writingChunkAddr] ===
            LockStates.UI_THREAD_LOCK
        ) {
            // console.warn('worker tried to write audio data to UI-thread-locked chunk',writingChunkIndex);
            return 0;
        }

        let nextNextChunkIndex = writingChunkIndex + 1;
        if (
            nextNextChunkIndex * this.#audioBlockChunkSize >
            this.#audioDataBufferView.length - 1
        ) {
            nextNextChunkIndex = 0;
        }
        // console.assert(nextNextChunkIndex != writingChunkIndex, `writingChunkIndex=${nextNextChunkIndex} == nextChunkIndex=${nextNextChunkIndex}`)

        this.#audioDataBufferView[writingChunkAddr + 1] = nextNextChunkIndex;
        this.#audioDataBufferView.set(newAudio, writingChunkAddr + 2);
        this.#audioDataBufferView[writingChunkAddr] = LockStates.UI_THREAD_LOCK;

        this.#nextAudioChunkIndex = nextNextChunkIndex;
        return nbytes;
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
        Atomics.wait(
            this.#inputBufferView,
            InputBufferAddresses.globalLockAddr,
            LockStates.READY_FOR_UI_THREAD,
            // Time out such that we don't miss any frames (giving 2 milliseconds
            // for blit and any CPU emulation to run).
            this.#nextExpectedBlitTime - performance.now() - 2
        );
    }

    acquireInputLock() {
        return tryToAcquireCyclicalLock(
            this.#inputBufferView,
            InputBufferAddresses.globalLockAddr
        );
    }

    releaseInputLock() {
        // reset
        this.#inputBufferView[InputBufferAddresses.mouseMoveFlagAddr] = 0;
        this.#inputBufferView[InputBufferAddresses.mouseMoveXDeltaAddr] = 0;
        this.#inputBufferView[InputBufferAddresses.mouseMoveYDeltaAddr] = 0;
        this.#inputBufferView[InputBufferAddresses.mouseButtonStateAddr] = 0;
        this.#inputBufferView[InputBufferAddresses.keyEventFlagAddr] = 0;
        this.#inputBufferView[InputBufferAddresses.keyCodeAddr] = 0;
        this.#inputBufferView[InputBufferAddresses.keyStateAddr] = 0;

        releaseCyclicalLock(
            this.#inputBufferView,
            InputBufferAddresses.globalLockAddr
        );
    }

    getInputValue(addr: number) {
        return this.#inputBufferView[addr];
    }
}

function startEmulator(config: EmulatorWorkerConfig) {
    const workerApi = new EmulatorWorkerApi(config);

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
            },
        ],

        onRuntimeInitialized() {
            (globalThis as any).workerApi = workerApi;
        },

        monitorRunDependencies(left: number) {
            totalDependencies = Math.max(totalDependencies, left);

            if (left === 0) {
                postMessage({type: "emulator_ready"});
            } else {
                postMessage({
                    type: "emulator_loading",
                    completion: (totalDependencies - left) / totalDependencies,
                });
            }
        },

        print: console.log.bind(console),

        printErr: console.warn.bind(console),
    };
    (self as any).Module = moduleOverrides;

    importScripts(BasiliskIIPath);
}
