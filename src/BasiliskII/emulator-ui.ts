import {InputBufferAddresses, LockStates} from "./emulator-common";

const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;

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
    audio.format == 0x0008 /*AUDIO_U8*/ || audio.format == 0x8008 /*AUDIO_S8*/
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

const SCREEN_BUFFER_SIZE = SCREEN_WIDTH * SCREEN_HEIGHT * 4; // 32bpp;

const canvasCtx = canvas.getContext("2d", {desynchronized: true});
const imageData = canvasCtx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);

const screenBuffer = new SharedArrayBuffer(SCREEN_BUFFER_SIZE);
const screenBufferView = new Uint8Array(screenBuffer);

const VIDEO_MODE_BUFFER_SIZE = 10;
const videoModeBuffer = new SharedArrayBuffer(VIDEO_MODE_BUFFER_SIZE * 4);
const videoModeBufferView = new Int32Array(videoModeBuffer);

const AUDIO_CONFIG_BUFFER_SIZE = 10;
const audioConfigBuffer = new SharedArrayBuffer(AUDIO_CONFIG_BUFFER_SIZE);
const audioConfigBufferView = new Uint8Array(audioConfigBuffer);

const audioBlockChunkSize = audio.bufferSize + 2;
const AUDIO_DATA_BUFFER_SIZE =
    audioBlockChunkSize * audio.maxBuffersInSharedMemory;
const audioDataBuffer = new SharedArrayBuffer(AUDIO_DATA_BUFFER_SIZE);
const audioDataBufferView = new Uint8Array(audioDataBuffer);

const INPUT_BUFFER_SIZE = 100;
const inputBuffer = new SharedArrayBuffer(INPUT_BUFFER_SIZE * 4);
const inputBufferView = new Int32Array(inputBuffer);
let inputQueue = [];

const Atomics_notify = Atomics.wake || Atomics.notify;

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

function acquireLock(bufferView, lockIndex) {
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

function releaseLock(bufferView, lockIndex) {
    Atomics.store(bufferView, lockIndex, LockStates.READY_FOR_EMUL_THREAD); // unlock

    Atomics_notify(bufferView, lockIndex);
}

function releaseInputLock() {
    releaseLock(inputBufferView, InputBufferAddresses.globalLockAddr);
}
function tryToSendInput() {
    if (!inputQueue.length) {
        return;
    }
    if (!acquireLock(inputBufferView, InputBufferAddresses.globalLockAddr)) {
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
    for (let i = 0; i < inputQueue.length; i++) {
        const inputEvent = inputQueue[i];
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
    if (hasMouseMove) {
        inputBufferView[InputBufferAddresses.mouseMoveFlagAddr] = 1;
        inputBufferView[InputBufferAddresses.mouseMoveXDeltaAddr] = mouseMoveX;
        inputBufferView[InputBufferAddresses.mouseMoveYDeltaAddr] = mouseMoveY;
    }
    inputBufferView[InputBufferAddresses.mouseButtonStateAddr] =
        mouseButtonState;
    if (hasKeyEvent) {
        inputBufferView[InputBufferAddresses.keyEventFlagAddr] = 1;
        inputBufferView[InputBufferAddresses.keyCodeAddr] = keyCode;
        inputBufferView[InputBufferAddresses.keyStateAddr] = keyState;
    }
    releaseInputLock();
    inputQueue = remainingKeyEvents;
}
function handleInput(inputEvent) {
    inputQueue.push(inputEvent);
    tryToSendInput();
}
canvas.addEventListener("mousemove", function (event) {
    handleInput({type: "mousemove", dx: event.offsetX, dy: event.offsetY});
});
canvas.addEventListener("mousedown", function (event) {
    handleInput({type: "mousedown"});
});
canvas.addEventListener("mouseup", function (event) {
    handleInput({type: "mouseup"});
});
window.addEventListener("keydown", function (event) {
    handleInput({type: "keydown", keyCode: event.keyCode});
});
window.addEventListener("keyup", function (event) {
    handleInput({type: "keyup", keyCode: event.keyCode});
});

const workerConfig = Object.assign(
    {
        inputBuffer: inputBuffer,
        inputBufferSize: INPUT_BUFFER_SIZE,
        screenBuffer: screenBuffer,
        screenBufferSize: SCREEN_BUFFER_SIZE,
        videoModeBuffer: videoModeBuffer,
        videoModeBufferSize: VIDEO_MODE_BUFFER_SIZE,
        audioDataBuffer: audioDataBuffer,
        audioDataBufferSize: AUDIO_DATA_BUFFER_SIZE,
        audioBlockBufferSize: audio.bufferSize,
        audioBlockChunkSize: audioBlockChunkSize,
        SCREEN_WIDTH: SCREEN_WIDTH,
        SCREEN_HEIGHT: SCREEN_HEIGHT,
    },
    basiliskConfig
);

if (basiliskConfig.singleThreadedEmscripten) {
    const worker = new Worker(
        basiliskConfig.baseURL + "BasiliskII-worker-boot.js"
    );

    worker.postMessage(workerConfig);
    worker.onmessage = function (e) {
        if (
            e.data.type === "emulator_ready" ||
            e.data.type === "emulator_loading"
        ) {
            document.body.className =
                e.data.type === "emulator_ready" ? "" : "loading";

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
        } else if (e.data.type === "emulator_blit") {
            drawScreen();
        }
    };
}

function drawScreen() {
    if (document.hidden) {
        return;
    }
    const pixelsRGBA = imageData.data;
    const expandedFromPalettedMode = videoModeBufferView[3];
    const start = audioContext.currentTime;
    // if we were going to lock the framebuffer, this is where we'd do it
    if (expandedFromPalettedMode) {
        // palette expanded mode is already in RGBA order
        pixelsRGBA.set(screenBufferView);
    } else {
        // offset by 1 to go from ARGB to RGBA (we don't actually care about the
        // alpha, it should be the same for all pixels)
        pixelsRGBA.set(
            screenBufferView.subarray(1, screenBufferView.byteLength - 1)
        );
        // However, the alpha ends up being 0, which makes it transparent, so we
        // need to override it to 255.
        // TODO(mihai): do this on the native side, perhaps with a custom blit
        // function.
        const maxAlphaIndex = SCREEN_WIDTH * SCREEN_HEIGHT * 4 + 3;
        for (let alphaIndex = 3; alphaIndex < maxAlphaIndex; alphaIndex += 4) {
            pixelsRGBA[alphaIndex] = 0xff;
        }
    }

    canvasCtx.putImageData(imageData, 0, 0);
}

document.addEventListener("visibilitychange", drawScreen);

openAudio();
