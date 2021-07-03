import {InputBufferAddresses, LockStates} from "./emulator-common";
import BasiliskIIPath from "./BasiliskII.jsz";
import BasiliskIIWasmPath from "./BasiliskII.wasmz";

let lastBlitFrameId = 0;
let lastBlitFrameHash = 0;
let nextExpectedBlitTime = 0;
let lastIdleWaitFrameId = 0;

type CustomModule = any; // TODO: better type safety

let Module: (EmscriptenModule & CustomModule) | null = null;

self.onmessage = function (msg) {
    startEmulator(msg.data);
};

// TODO: types
function startEmulator(parentConfig: any) {
    const screenBufferView = new Uint8Array(
        parentConfig.screenBuffer,
        0,
        parentConfig.screenBufferSize
    );

    const videoModeBufferView = new Int32Array(
        parentConfig.videoModeBuffer,
        0,
        parentConfig.videoModeBufferSize
    );

    const inputBufferView = new Int32Array(
        parentConfig.inputBuffer,
        0,
        parentConfig.inputBufferSize
    );

    /*
    TODO: audio
    let nextAudioChunkIndex = 0;
    const audioDataBufferView = new Uint8Array(
        parentConfig.audioDataBuffer,
        0,
        parentConfig.audioDataBufferSize
    );
        */
    function tryToAcquireCyclicalLock(
        bufferView: Int32Array,
        lockIndex: number
    ) {
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

    function releaseCyclicalLock(bufferView: Int32Array, lockIndex: number) {
        Atomics.store(bufferView, lockIndex, LockStates.READY_FOR_UI_THREAD);
    }

    function acquireInputLock() {
        return tryToAcquireCyclicalLock(
            inputBufferView,
            InputBufferAddresses.globalLockAddr
        );
    }

    function releaseInputLock() {
        // reset
        inputBufferView[InputBufferAddresses.mouseMoveFlagAddr] = 0;
        inputBufferView[InputBufferAddresses.mouseMoveXDeltaAddr] = 0;
        inputBufferView[InputBufferAddresses.mouseMoveYDeltaAddr] = 0;
        inputBufferView[InputBufferAddresses.mouseButtonStateAddr] = 0;
        inputBufferView[InputBufferAddresses.keyEventFlagAddr] = 0;
        inputBufferView[InputBufferAddresses.keyCodeAddr] = 0;
        inputBufferView[InputBufferAddresses.keyStateAddr] = 0;

        releaseCyclicalLock(
            inputBufferView,
            InputBufferAddresses.globalLockAddr
        );
    }

    /*
    TODO: audio
    let AudioConfig = null;

    const AudioBufferQueue = [];
    */
    if (!parentConfig.autoloadFiles) {
        throw new Error("autoloadFiles missing in config");
    }

    (self as any).Module = Module = {
        arguments: parentConfig.arguments || ["--config", "prefs"],
        canvas: null,

        locateFile: function (path: string, scriptDirectory: string) {
            if (path === "BasiliskII.wasm") {
                return BasiliskIIWasmPath;
            }
            console.log("locateFile", {path, scriptDirectory});
            return scriptDirectory + path;
        },

        onRuntimeInitialized: function () {
            // TODO: type safety
            (self as any).Module = Module;
        },

        blit: function blit(
            bufPtr: number,
            width: number,
            height: number,
            depth: number,
            usingPalette: number,
            hash: number
        ) {
            lastBlitFrameId++;
            videoModeBufferView[0] = width;
            videoModeBufferView[1] = height;
            videoModeBufferView[2] = depth;
            videoModeBufferView[3] = usingPalette;
            const length = width * height * (depth === 32 ? 4 : 1); // 32bpp or 8bpp
            if (hash !== lastBlitFrameHash) {
                lastBlitFrameHash = hash;
                screenBufferView.set(
                    Module.HEAPU8.subarray(bufPtr, bufPtr + length)
                );
                postMessage({type: "emulator_blit"});
            }
            nextExpectedBlitTime = performance.now() + 16;
        },

        openAudio: function openAudio(
            sampleRate: number,
            sampleSize: number,
            channels: number,
            framesPerBuffer: number
        ) {
            /* TODO: audio
            AudioConfig = {
                sampleRate: sampleRate,
                sampleSize: sampleSize,
                channels: channels,
                framesPerBuffer: framesPerBuffer,
            };
            console.log(AudioConfig);
            */
        },

        enqueueAudio: function enqueueAudio(
            bufPtr: number,
            nbytes: number,
            type: number
        ): number {
            /* TODO: audio
            const newAudio = Module.HEAPU8.slice(bufPtr, bufPtr + nbytes);
            // console.assert(
            //   nbytes == parentConfig.audioBlockBufferSize,
            //   `emulator wrote ${nbytes}, expected ${parentConfig.audioBlockBufferSize}`
            // );

            const writingChunkIndex = nextAudioChunkIndex;
            const writingChunkAddr =
                writingChunkIndex * parentConfig.audioBlockChunkSize;

            if (
                audioDataBufferView[writingChunkAddr] ===
                LockStates.UI_THREAD_LOCK
            ) {
                // console.warn('worker tried to write audio data to UI-thread-locked chunk',writingChunkIndex);
                return 0;
            }

            let nextNextChunkIndex = writingChunkIndex + 1;
            if (
                nextNextChunkIndex * parentConfig.audioBlockChunkSize >
                audioDataBufferView.length - 1
            ) {
                nextNextChunkIndex = 0;
            }
            // console.assert(nextNextChunkIndex != writingChunkIndex, `writingChunkIndex=${nextNextChunkIndex} == nextChunkIndex=${nextNextChunkIndex}`)

            audioDataBufferView[writingChunkAddr + 1] = nextNextChunkIndex;
            audioDataBufferView.set(newAudio, writingChunkAddr + 2);
            audioDataBufferView[writingChunkAddr] = LockStates.UI_THREAD_LOCK;

            nextAudioChunkIndex = nextNextChunkIndex;
            return nbytes;
            */
            return 0;
        },

        debugPointer: function debugPointer(ptr: any) {
            console.log("debugPointer", ptr);
        },

        idleWait: function () {
            // Don't do more than one call per frame, otherwise we end up skipping
            // frames.
            // TOOD: understand why IdleWait is called multiple times in a row
            // before VideoRefresh is called again.
            if (lastIdleWaitFrameId === lastBlitFrameId) {
                return;
            }
            lastIdleWaitFrameId = lastBlitFrameId;
            Atomics.wait(
                inputBufferView,
                InputBufferAddresses.globalLockAddr,
                LockStates.READY_FOR_UI_THREAD,
                // Time out such that we don't miss any frames (giving 2 milliseconds
                // for blit and any CPU emulation to run).
                nextExpectedBlitTime - performance.now() - 2
            );
        },

        acquireInputLock: acquireInputLock,

        InputBufferAddresses: InputBufferAddresses,

        getInputValue: function getInputValue(addr: number) {
            return inputBufferView[addr];
        },

        totalDependencies: 0,
        monitorRunDependencies: function (left: number) {
            this.totalDependencies = Math.max(this.totalDependencies, left);

            if (left === 0) {
                postMessage({type: "emulator_ready"});
            } else {
                postMessage({
                    type: "emulator_loading",
                    completion:
                        (this.totalDependencies - left) /
                        this.totalDependencies,
                });
            }
        },

        print: console.log.bind(console),

        printErr: console.warn.bind(console),

        releaseInputLock: releaseInputLock,
    };

    // inject extra behaviours
    const {autoloadFiles} = parentConfig;
    if (autoloadFiles) {
        Module!.preRun = Module!.preRun || [];
        Module!.preRun.unshift(function () {
            for (const [name, path] of Object.entries(autoloadFiles)) {
                FS.createPreloadedFile("/", name, path as string, true, true);
            }
        });
    }

    importScripts(BasiliskIIPath);
}
