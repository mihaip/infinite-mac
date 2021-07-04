import {
    EmulatorInputEvent,
    InputBufferAddresses,
    LockStates,
} from "./emulator-common";
import Worker from "worker-loader!./emulator-worker";

/*
 TODO: audio support
const audio = {
    channels: 1,
    bytesPerSample: 2,
    samples: 4096,
    // freq: 11025,
    freq: 22050,
    // freq: 44100,
    format: 0x8010,
    paused: false,
    timer: null,
    silence: 0,
    maxBuffersInSharedMemory: 5,
    nextPlayTime: 0,
};

const audioTotalSamples = audio.samples * audio.channels;
audio.bytesPerSample =
    audio.format == 0x0008 // AUDIO_U8
     || audio.format == 0x8008 // AUDIO_S8
        ? 1
        : 2;
audio.bufferSize = audioTotalSamples * audio.bytesPerSample;
audio.bufferDurationSecs =
    audio.bufferSize / audio.bytesPerSample / audio.channels / audio.freq; // Duration of a single queued buffer in seconds.
audio.bufferingDelay = 50 / 1000; // Audio samples are played with a constant delay of this many seconds to account for browser and jitter.

// To account for jittering in frametimes, always have multiple audio buffers queued up for the audio output device.
// This helps that we won't starve that easily if a frame takes long to complete.
audio.numSimultaneouslyQueuedBuffers = 5;
audio.nextChunkIndex = 0;

const AUDIO_CONFIG_BUFFER_SIZE = 10;
const audioConfigBuffer = new SharedArrayBuffer(AUDIO_CONFIG_BUFFER_SIZE);
const audioConfigBufferView = new Uint8Array(audioConfigBuffer);

const audioBlockChunkSize = audio.bufferSize + 2;
const AUDIO_DATA_BUFFER_SIZE =
    audioBlockChunkSize * audio.maxBuffersInSharedMemory;
const audioDataBuffer = new SharedArrayBuffer(AUDIO_DATA_BUFFER_SIZE);
const audioDataBufferView = new Uint8Array(audioDataBuffer);

const audioContext = new AudioContext();

const gainNode = audioContext.createGain();

gainNode.gain.value = 1;
gainNode.connect(audioContext.destination);

function addEventListenerOnce(element, eventType, cb) {
    element.addEventListener(eventType, function () {
        element.removeEventListener(eventType, cb);
        cb.apply(this, arguments);
    });
}

addEventListenerOnce(canvas, "click", function () {
    audioContext.resume();
});

const warningLastTime = {};
const warningCount = {};
function throttledWarning(message, type = "") {
    warningCount[type] = (warningCount[type] || 0) + 1;
    if (Date.now() - (warningLastTime[type] || 0) > 5000) {
        console.warn(message, `${warningCount[type] || 0} times`);
        warningLastTime[type] = Date.now();
        warningCount[type] = 0;
    }
}

function openAudio() {
    audio.pushAudio = function pushAudio(
        blockBuffer, // u8 typed array
        sizeBytes // probably (frames per block=4096) * (bytes per sample=2) * (n channels=1)
    ) {
        if (audio.paused) return;

        const sizeSamples = sizeBytes / audio.bytesPerSample; // How many samples fit in the callback buffer?
        const sizeSamplesPerChannel = sizeSamples / audio.channels; // How many samples per a single channel fit in the cb buffer?
        if (sizeSamplesPerChannel != audio.samples) {
            throw "Received mismatching audio buffer size!";
        }
        // Allocate new sound buffer to be played.
        const source = audioContext.createBufferSource();
        const soundBuffer = audioContext.createBuffer(
            audio.channels,
            sizeSamplesPerChannel,
            audio.freq
        );
        // source.connect(audioContext.destination);
        source.connect(gainNode);

        audio.fillWebAudioBufferFromChunk(
            blockBuffer,
            sizeSamplesPerChannel,
            soundBuffer
        );
        // Workaround https://bugzilla.mozilla.org/show_bug.cgi?id=883675 by setting the buffer only after filling. The order is important here!
        source.buffer = soundBuffer;

        // Schedule the generated sample buffer to be played out at the correct time right after the previously scheduled
        // sample buffer has finished.
        const curtime = audioContext.currentTime;

        // assertion
        if (curtime > audio.nextPlayTime && audio.nextPlayTime != 0) {
            // console.log('warning: Audio callback had starved sending audio by ' + (curtime - audio.nextPlayTime) + ' seconds.');
        }

        // Don't ever start buffer playbacks earlier from current time than a given constant 'audio.bufferingDelay', since a browser
        // may not be able to mix that audio clip in immediately, and there may be subsequent jitter that might cause the stream to starve.
        const playtime = Math.max(
            curtime + audio.bufferingDelay,
            audio.nextPlayTime
        );
        source.start(playtime);
        // console.log(`queuing audio for ${playtime}`)

        audio.nextPlayTime = playtime + audio.bufferDurationSecs;
    };

    audio.getBlockBuffer = function getBlockBuffer() {
        // audio chunk layout
        // 0: lock state
        // 1: pointer to next chunk
        // 2->buffersize+2: audio buffer
        const curChunkIndex = audio.nextChunkIndex;
        const curChunkAddr = curChunkIndex * audioBlockChunkSize;

        if (audioDataBufferView[curChunkAddr] !== LockStates.UI_THREAD_LOCK) {
            if (audio.gotFirstBlock) {
                // throttledWarning('UI thread tried to read audio data from worker-locked chunk');
            }
            return null;
        }
        audio.gotFirstBlock = true;

        const blockBuffer = audioDataBufferView.slice(
            curChunkAddr + 2,
            curChunkAddr + 2 + audio.bufferSize
        );
        audio.nextChunkIndex = audioDataBufferView[curChunkAddr + 1];
        // console.assert(audio.nextChunkIndex != curChunkIndex, `curChunkIndex=${curChunkIndex} == nextChunkIndex=${audio.nextChunkIndex}`)
        audioDataBufferView[curChunkAddr] = LockStates.EMUL_THREAD_LOCK;
        // debugger
        // console.log(`got buffer=${curChunkIndex}, next=${audio.nextChunkIndex}`)
        return blockBuffer;
    };

    audio.fillWebAudioBufferFromChunk = function fillWebAudioBufferFromChunk(
        blockBuffer, // u8 typed array
        blockSize, // probably 4096
        dstAudioBuffer
    ) {
        for (let c = 0; c < audio.channels; ++c) {
            const channelData = dstAudioBuffer.getChannelData(c);
            if (channelData.length != blockSize) {
                throw (
                    "Web Audio output buffer length mismatch! Destination size: " +
                    channelData.length +
                    " samples vs expected " +
                    blockSize +
                    " samples!"
                );
            }
            const blockBufferI16 = new Int16Array(blockBuffer.buffer);

            for (let j = 0; j < blockSize; ++j) {
                channelData[j] = blockBufferI16[j] / 0x8000; // convert i16 to f32 in range -1 to +1
            }
        }
    };

    // Pulls and queues new audio data if appropriate. This function gets "over-called" in both requestAnimationFrames and
    // setTimeouts to ensure that we get the finest granularity possible and as many chances from the browser to fill
    // new audio data. This is because setTimeouts alone have very poor granularity for audio streaming purposes, but also
    // the application might not be using emscripten_set_main_loop to drive the main loop, so we cannot rely on that alone.
    audio.queueNewAudioData = function queueNewAudioData() {
        let i = 0;
        for (; i < audio.numSimultaneouslyQueuedBuffers; ++i) {
            // Only queue new data if we don't have enough audio data already in queue. Otherwise skip this time slot
            // and wait to queue more in the next time the callback is run.
            const secsUntilNextPlayStart =
                audio.nextPlayTime - audioContext.currentTime;
            if (
                secsUntilNextPlayStart >=
                audio.bufferingDelay +
                    audio.bufferDurationSecs *
                        audio.numSimultaneouslyQueuedBuffers
            )
                return;

            const blockBuffer = audio.getBlockBuffer();
            if (!blockBuffer) {
                return;
            }

            // And queue it to be played after the currently playing audio stream.
            audio.pushAudio(blockBuffer, audio.bufferSize);
        }
        // console.log(`queued ${i} buffers of audio`);
    };

    // Create a callback function that will be routinely called to ask more audio data from the user application.
    audio.caller = function audioCaller() {
        --audio.numAudioTimersPending;

        audio.queueNewAudioData();

        // Queue this callback function to be called again later to pull more audio data.
        const secsUntilNextPlayStart =
            audio.nextPlayTime - audioContext.currentTime;

        // Queue the next audio frame push to be performed half-way when the previously queued buffer has finished playing.
        const preemptBufferFeedSecs = audio.bufferDurationSecs / 2.0;

        if (
            audio.numAudioTimersPending < audio.numSimultaneouslyQueuedBuffers
        ) {
            ++audio.numAudioTimersPending;
            audio.timer = setTimeout(
                audio.caller,
                Math.max(
                    0.0,
                    1000.0 * (secsUntilNextPlayStart - preemptBufferFeedSecs)
                )
            );

            // If we are risking starving, immediately queue an extra buffer.
            if (
                audio.numAudioTimersPending <
                audio.numSimultaneouslyQueuedBuffers
            ) {
                ++audio.numAudioTimersPending;
                setTimeout(audio.caller, 1.0);
            }
        }
    };

    audio.numAudioTimersPending = 1;
    audio.timer = setTimeout(audio.caller, 1);
}
*/

function acquireLock(bufferView: Int32Array, lockIndex: number) {
    const res = Atomics.compareExchange(
        bufferView,
        lockIndex,
        LockStates.READY_FOR_UI_THREAD,
        LockStates.UI_THREAD_LOCK
    );
    if (res === LockStates.READY_FOR_UI_THREAD) {
        return true;
    }
    return false;
}

function releaseLock(bufferView: Int32Array, lockIndex: number) {
    Atomics.store(bufferView, lockIndex, LockStates.READY_FOR_EMUL_THREAD);
    Atomics.notify(bufferView, lockIndex);
}

const INPUT_BUFFER_SIZE = 100;

const VIDEO_MODE_BUFFER_SIZE = 10;

export type EmulatorConfig = {
    screenWidth: number;
    screenHeight: number;
    screenCanvas: HTMLCanvasElement;
    basiliskPrefsPath: string;
    romPath: string;
    disk1Path: string;
    disk2Path: string;
};

export class Emulator {
    #config: EmulatorConfig;
    #worker: Worker;

    #inputQueue: EmulatorInputEvent[];
    #inputBuffer = new SharedArrayBuffer(INPUT_BUFFER_SIZE * 4);
    #inputBufferView = new Int32Array(this.#inputBuffer);

    #screenCanvasContext: CanvasRenderingContext2D;
    #screenImageData: ImageData;
    #screenBuffer: SharedArrayBuffer;
    #screenBufferView: Uint8Array;
    #videoModeBuffer = new SharedArrayBuffer(VIDEO_MODE_BUFFER_SIZE * 4);
    #videoModeBufferView = new Int32Array(this.#videoModeBuffer);

    constructor(config: EmulatorConfig) {
        this.#config = config;
        this.#worker = new Worker();
        this.#inputQueue = [];

        const {screenCanvas: canvas, screenWidth, screenHeight} = this.#config;

        this.#screenCanvasContext = canvas.getContext("2d", {
            desynchronized: true,
        })!;
        this.#screenImageData = this.#screenCanvasContext.createImageData(
            screenWidth,
            screenHeight
        );

        const screenBufferSize = config.screenWidth * config.screenHeight * 4; // 32bpp
        this.#screenBuffer = new SharedArrayBuffer(screenBufferSize);
        this.#screenBufferView = new Uint8Array(this.#screenBuffer);
    }

    start() {
        const {screenCanvas: canvas} = this.#config;
        canvas.addEventListener("mousemove", this.#handleMouseMove);
        canvas.addEventListener("mousedown", this.#handleMouseDown);
        canvas.addEventListener("mouseup", this.#handleMouseUp);
        window.addEventListener("keydown", this.#handleKeyDown);
        window.addEventListener("keyup", this.#handleKeyUp);

        document.addEventListener(
            "visibilitychange",
            this.#handleVisibilityChange
        );

        this.#worker.addEventListener("message", this.#handleWorkerMessage);

        this.#worker.postMessage({
            autoloadFiles: {
                "MacOS753": this.#config.disk1Path,
                "Games.img": this.#config.disk2Path,
                "Quadra-650.rom": this.#config.romPath,
                "prefs": this.#config.basiliskPrefsPath,
            },
            arguments: ["--config", "prefs"],

            inputBuffer: this.#inputBuffer,
            inputBufferSize: INPUT_BUFFER_SIZE,
            screenBuffer: this.#screenBuffer,
            screenBufferSize: this.#screenBuffer.byteLength,
            videoModeBuffer: this.#videoModeBuffer,
            videoModeBufferSize: VIDEO_MODE_BUFFER_SIZE,
            // TODO: audio
            // audioDataBuffer: audioDataBuffer,
            // audioDataBufferSize: AUDIO_DATA_BUFFER_SIZE,
            // audioBlockBufferSize: audio.bufferSize,
            // audioBlockChunkSize: audioBlockChunkSize,
            SCREEN_WIDTH: this.#config.screenWidth,
            SCREEN_HEIGHT: this.#config.screenHeight,
        });
    }

    stop() {
        const {screenCanvas: canvas} = this.#config;
        canvas.removeEventListener("mousemove", this.#handleMouseMove);
        canvas.removeEventListener("mousedown", this.#handleMouseDown);
        canvas.removeEventListener("mouseup", this.#handleMouseUp);
        window.removeEventListener("keydown", this.#handleKeyDown);
        window.removeEventListener("keyup", this.#handleKeyUp);

        document.removeEventListener(
            "visibilitychange",
            this.#handleVisibilityChange
        );

        this.#worker.removeEventListener("message", this.#handleWorkerMessage);

        this.#worker.postMessage({
            // TODO
        });
    }

    #handleMouseMove = (event: MouseEvent) => {
        this.#handleInput({
            type: "mousemove",
            dx: event.offsetX,
            dy: event.offsetY,
        });
    };

    #handleMouseDown = (event: MouseEvent) => {
        this.#handleInput({type: "mousedown"});
    };

    #handleMouseUp = (event: MouseEvent) => {
        this.#handleInput({type: "mouseup"});
    };

    #handleKeyDown = (event: KeyboardEvent) => {
        this.#handleInput({type: "keydown", keyCode: event.keyCode});
    };

    #handleKeyUp = (event: KeyboardEvent) => {
        this.#handleInput({type: "keyup", keyCode: event.keyCode});
    };

    #handleInput(inputEvent: EmulatorInputEvent) {
        this.#inputQueue.push(inputEvent);
        this.#tryToSendInput();
    }

    #tryToSendInput() {
        if (!this.#inputQueue.length) {
            return;
        }
        if (!this.#acquireInputLock()) {
            this.#tryToSendInputLater();
            return;
        }
        let hasMouseMove = false;
        let mouseMoveX = 0;
        let mouseMoveY = 0;
        let mouseButtonState = -1;
        let hasKeyEvent = false;
        let keyCode = -1;
        let keyState = -1;
        // currently only one key event can be sent per sync
        // TODO: better key handling code
        const remainingKeyEvents = [];
        for (const inputEvent of this.#inputQueue) {
            switch (inputEvent.type) {
                case "mousemove":
                    if (hasMouseMove) {
                        break;
                    }
                    hasMouseMove = true;
                    mouseMoveX += inputEvent.dx;
                    mouseMoveY += inputEvent.dy;
                    break;
                case "mousedown":
                case "mouseup":
                    mouseButtonState = inputEvent.type === "mousedown" ? 1 : 0;
                    break;
                case "keydown":
                case "keyup":
                    if (hasKeyEvent) {
                        remainingKeyEvents.push(inputEvent);
                        break;
                    }
                    hasKeyEvent = true;
                    keyState = inputEvent.type === "keydown" ? 1 : 0;
                    keyCode = inputEvent.keyCode;
                    break;
            }
        }
        const inputBufferView = this.#inputBufferView;
        if (hasMouseMove) {
            inputBufferView[InputBufferAddresses.mouseMoveFlagAddr] = 1;
            inputBufferView[InputBufferAddresses.mouseMoveXDeltaAddr] =
                mouseMoveX;
            inputBufferView[InputBufferAddresses.mouseMoveYDeltaAddr] =
                mouseMoveY;
        }
        inputBufferView[InputBufferAddresses.mouseButtonStateAddr] =
            mouseButtonState;
        if (hasKeyEvent) {
            inputBufferView[InputBufferAddresses.keyEventFlagAddr] = 1;
            inputBufferView[InputBufferAddresses.keyCodeAddr] = keyCode;
            inputBufferView[InputBufferAddresses.keyStateAddr] = keyState;
        }
        this.#releaseInputLock();
        this.#inputQueue = remainingKeyEvents;
        if (this.#inputQueue.length) {
            this.#tryToSendInputLater();
        }
    }

    #tryToSendInputLater() {
        window.setTimeout(() => this.#tryToSendInput(), 0);
    }

    #acquireInputLock(): boolean {
        return acquireLock(
            this.#inputBufferView,
            InputBufferAddresses.globalLockAddr
        );
    }

    #releaseInputLock() {
        releaseLock(this.#inputBufferView, InputBufferAddresses.globalLockAddr);
    }

    #handleWorkerMessage = (e: MessageEvent) => {
        if (
            e.data.type === "emulator_ready" ||
            e.data.type === "emulator_loading"
        ) {
            document.body.className =
                e.data.type === "emulator_ready" ? "" : "loading";

            /* TODO: progress
            const progressElement =
                basiliskConfig.progressElement ||
                document.getElementById("progress");
            if (progressElement) {
                if (e.data.type === "emulator_loading") {
                    progressElement.value = Math.max(
                        10,
                        e.data.completion * 100
                    );
                    progressElement.max = 100;
                    progressElement.hidden = false;
                } else {
                    progressElement.value = null;
                    progressElement.max = null;
                    progressElement.hidden = true;
                }
            }
            */
        } else if (e.data.type === "emulator_blit") {
            this.#drawScreen();
        }
    };

    #handleVisibilityChange = () => {
        this.#drawScreen();
    };

    #drawScreen() {
        if (document.hidden) {
            return;
        }
        const pixelsRGBA = this.#screenImageData.data;
        const expandedFromPalettedMode = this.#videoModeBufferView[3];
        // if we were going to lock the framebuffer, this is where we'd do it
        if (expandedFromPalettedMode) {
            // palette expanded mode is already in RGBA order
            pixelsRGBA.set(this.#screenBufferView);
        } else {
            // offset by 1 to go from ARGB to RGBA (we don't actually care about the
            // alpha, it should be the same for all pixels)
            pixelsRGBA.set(
                this.#screenBufferView.subarray(
                    1,
                    this.#screenBufferView.byteLength - 1
                )
            );
            // However, the alpha ends up being 0, which makes it transparent, so we
            // need to override it to 255.
            // TODO(mihai): do this on the native side, perhaps with a custom blit
            // function.
            const {screenWidth, screenHeight} = this.#config;
            const maxAlphaIndex = screenWidth * screenHeight * 4 + 3;
            for (
                let alphaIndex = 3;
                alphaIndex < maxAlphaIndex;
                alphaIndex += 4
            ) {
                pixelsRGBA[alphaIndex] = 0xff;
            }
        }

        this.#screenCanvasContext.putImageData(this.#screenImageData, 0, 0);
    }
}

// openAudio(); TODO: audio
