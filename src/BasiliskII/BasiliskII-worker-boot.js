let lastBlitFrameId = 0;
let lastBlitFrameHash = 0;
let nextExpectedBlitTime = 0;
let lastIdleWaitFrameId = 0;
var INSTRUMENT_MALLOC = false;
var memAllocSet = new Set();
var memAllocSetPersistent = new Set();
function memAllocAdd(addr) {
    if (memAllocSet.has(addr)) {
        console.error(`unfreed memory alloc'd at ${addr}`);
    }
    memAllocSet.add(addr);
    console.warn("malloc", addr);
    memAllocSetPersistent.add(addr);
}
function memAllocRemove(addr) {
    if (!memAllocSet.has(addr)) {
        console.error(
            `unalloc'd memory free'd at ${addr} (everallocd=${memAllocSetPersistent.has(
                addr
            )})`
        );
    }
    console.warn("free", addr);
    memAllocSet.delete(addr);
}

var pathGetFilenameRegex = /\/([^\/]+)$/;

function pathGetFilename(path) {
    var matches = path.match(pathGetFilenameRegex);
    if (matches && matches.length) {
        return matches[1];
    } else {
        return path;
    }
}

function addAutoloader(module) {
    var loadDatafiles = function () {
        module.autoloadFiles.forEach(function (filepath) {
            module.FS_createPreloadedFile(
                "/",
                pathGetFilename(filepath),
                filepath,
                true,
                true
            );
        });
    };

    if (module.autoloadFiles) {
        module.preRun = module.preRun || [];
        module.preRun.unshift(loadDatafiles);
    }

    return module;
}

function addCustomAsyncInit(module) {
    if (module.asyncInit) {
        module.preRun = module.preRun || [];
        module.preRun.push(function waitForCustomAsyncInit() {
            module.addRunDependency("__moduleAsyncInit");

            module.asyncInit(module, function asyncInitCallback() {
                module.removeRunDependency("__moduleAsyncInit");
            });
        });
    }
}

var InputBufferAddresses = {
    globalLockAddr: 0,
    mouseMoveFlagAddr: 1,
    mouseMoveXDeltaAddr: 2,
    mouseMoveYDeltaAddr: 3,
    mouseButtonStateAddr: 4,
    keyEventFlagAddr: 5,
    keyCodeAddr: 6,
    keyStateAddr: 7,
};

const InputBufferAddressTypes = Object.entries(InputBufferAddresses).reduce(
    (acc, [k, v]) => {
        acc[v] = k;
        return acc;
    },
    {}
);

const inputBufferLastVals = {};

var LockStates = {
    READY_FOR_UI_THREAD: 0,
    UI_THREAD_LOCK: 1,
    READY_FOR_EMUL_THREAD: 2,
    EMUL_THREAD_LOCK: 3,
};

var Module = null;

self.onmessage = function (msg) {
    console.log("init worker");
    startEmulator(
        Object.assign({}, msg.data, {singleThreadedEmscripten: true})
    );
};

function startEmulator(parentConfig) {
    var screenBufferView = new Uint8Array(
        parentConfig.screenBuffer,
        0,
        parentConfig.screenBufferSize
    );

    var videoModeBufferView = new Int32Array(
        parentConfig.videoModeBuffer,
        0,
        parentConfig.videoModeBufferSize
    );

    var inputBufferView = new Int32Array(
        parentConfig.inputBuffer,
        0,
        parentConfig.inputBufferSize
    );

    var nextAudioChunkIndex = 0;
    var audioDataBufferView = new Uint8Array(
        parentConfig.audioDataBuffer,
        0,
        parentConfig.audioDataBufferSize
    );

    function tryToAcquireCyclicalLock(bufferView, lockIndex) {
        var res = Atomics.compareExchange(
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

    function releaseCyclicalLock(bufferView, lockIndex) {
        Atomics.store(bufferView, lockIndex, LockStates.READY_FOR_UI_THREAD); // unlock
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

    var AudioConfig = null;

    var AudioBufferQueue = [];

    if (!parentConfig.autoloadFiles) {
        throw new Error("autoloadFiles missing in config");
    }

    Module = {
        autoloadFiles: parentConfig.autoloadFiles,

        arguments: parentConfig.arguments || ["--config", "prefs"],
        canvas: null,

        onRuntimeInitialized: function () {
            if (INSTRUMENT_MALLOC) {
                // instrument malloc and free
                const oldMalloc = Module._malloc;
                const oldFree = Module._free;
                console.error("instrumenting malloc and free");

                Module._malloc = function _wrapmalloc($0) {
                    var $0 = $0 | 0;
                    var $1 = oldMalloc($0);
                    memAllocAdd($1);
                    return $1 | 0;
                };
                Module._free = function _wrapfree($0) {
                    memAllocRemove($0);
                    var $1 = oldFree($0);
                    return $1 | 0;
                };
            }

            self.Module = Module;
        },

        summarizeBuffer: function (bufPtr, width, height, depth) {
            var length = width * height * (depth === 32 ? 4 : 1); // 32bpp or 8bpp

            let zeroChannelCount = 0;
            let nonZeroChannelCount = 0;
            let zeroAlphaCount = 0;
            let nonZeroAlphaCount = 0;

            for (var i = 0; i < length; i++) {
                if (depth === 32) {
                    if (i % 4 < 3) {
                        if (Module.HEAPU8[bufPtr + i] > 0) {
                            nonZeroChannelCount++;
                        } else {
                            zeroChannelCount++;
                        }
                    } else {
                        if (Module.HEAPU8[bufPtr + i] > 0) {
                            nonZeroAlphaCount++;
                        } else {
                            zeroAlphaCount++;
                        }
                    }
                }
            }
            console.log(
                "buffer at",
                bufPtr,
                {
                    zeroChannelCount,
                    nonZeroChannelCount,
                    pixelColorChannels: width * height * (depth === 32 ? 3 : 1),
                    zeroAlphaCount,
                    nonZeroAlphaCount,
                },
                Module.HEAPU8.slice(bufPtr, bufPtr + 128)
            );
        },

        blit: function blit(bufPtr, width, height, depth, usingPalette, hash) {
            lastBlitFrameId++;
            videoModeBufferView[0] = width;
            videoModeBufferView[1] = height;
            videoModeBufferView[2] = depth;
            videoModeBufferView[3] = usingPalette;
            var length = width * height * (depth === 32 ? 4 : 1); // 32bpp or 8bpp
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
            sampleRate,
            sampleSize,
            channels,
            framesPerBuffer
        ) {
            AudioConfig = {
                sampleRate: sampleRate,
                sampleSize: sampleSize,
                channels: channels,
                framesPerBuffer: framesPerBuffer,
            };
            console.log(AudioConfig);
        },

        enqueueAudio: function enqueueAudio(bufPtr, nbytes, type) {
            var newAudio = Module.HEAPU8.slice(bufPtr, bufPtr + nbytes);
            // console.assert(
            //   nbytes == parentConfig.audioBlockBufferSize,
            //   `emulator wrote ${nbytes}, expected ${parentConfig.audioBlockBufferSize}`
            // );

            var writingChunkIndex = nextAudioChunkIndex;
            var writingChunkAddr =
                writingChunkIndex * parentConfig.audioBlockChunkSize;

            if (
                audioDataBufferView[writingChunkAddr] ===
                LockStates.UI_THREAD_LOCK
            ) {
                // console.warn('worker tried to write audio data to UI-thread-locked chunk',writingChunkIndex);
                return 0;
            }

            var nextNextChunkIndex = writingChunkIndex + 1;
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
        },

        debugPointer: function debugPointer(ptr) {
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

        getInputValue: function getInputValue(addr) {
            return inputBufferView[addr];
        },

        totalDependencies: 0,
        monitorRunDependencies: function (left) {
            this.totalDependencies = Math.max(this.totalDependencies, left);

            if (left == 0) {
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
    addAutoloader(Module);
    addCustomAsyncInit(Module);

    if (parentConfig.singleThreadedEmscripten) {
        importScripts((parentConfig.baseURL || "") + "BasiliskII.js");
    }
}
