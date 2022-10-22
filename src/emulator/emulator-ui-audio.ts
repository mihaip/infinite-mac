import type {
    EmulatorWorkerAudioConfig,
    EmulatorWorkerFallbackAudioConfig,
    EmulatorWorkerSharedMemoryAudioConfig,
} from "./emulator-common";
import {LockStates} from "./emulator-common";

// SDL Audio Formats
enum EmulatorAudioFormat {
    AUDIO_U8 = 0x0008,
    AUDIO_S8 = 0x8008,
    AUDIO_S16LSB = 0x8010,
}

export interface EmulatorAudio {
    workerConfig(): EmulatorWorkerAudioConfig;
    start(): void;
}

abstract class BaseEmulatorAudio {
    #channels = 1;
    #samples = 4096;
    #freq = 22050; // could also be 11025 or 44100
    #format = EmulatorAudioFormat.AUDIO_S16LSB;
    #audioTotalSamples = this.#samples * this.#channels;
    #bytesPerSample =
        this.#format === EmulatorAudioFormat.AUDIO_U8 ||
        this.#format === EmulatorAudioFormat.AUDIO_S8
            ? 1
            : 2;
    #bufferSize = this.#audioTotalSamples * this.#bytesPerSample;
    #bufferDurationSecs =
        this.#bufferSize / this.#bytesPerSample / this.#channels / this.#freq; // Duration of a single queued buffer in seconds.
    #bufferingDelay = 50 / 1000; // Audio samples are played with a constant delay of this many seconds to account for browser and jitter.

    #nextPlayTime = 0;
    #timeout: number;
    #numAudioTimersPending: 1;
    // To account for jittering in frametimes, always have multiple audio
    // buffers queued up for the audio output device.
    // This helps that we won't starve that easily if a frame takes long to
    // complete.
    #numSimultaneouslyQueuedBuffers = 5;

    #audioContext: AudioContext;
    #gainNode: GainNode;

    #paused: boolean = false;

    constructor() {
        this.#numAudioTimersPending = 1;
        this.#timeout = window.setTimeout(this.#callback, 1);

        this.#audioContext = new AudioContext({latencyHint: "interactive"});
        this.#gainNode = this.#audioContext.createGain();
        this.#gainNode.gain.value = 1;
        this.#gainNode.connect(this.#audioContext.destination);
    }

    start() {
        this.#audioContext.resume();
    }

    #pushAudio(
        blockBuffer: Uint8Array, // u8 typed array
        sizeBytes: number // probably (frames per block=4096) * (bytes per sample=2) * (n channels=1)
    ) {
        if (this.#paused) return;

        const sizeSamples = sizeBytes / this.#bytesPerSample; // How many samples fit in the callback buffer?
        const sizeSamplesPerChannel = sizeSamples / this.#channels; // How many samples per a single channel fit in the cb buffer?
        if (sizeSamplesPerChannel !== this.#samples) {
            throw new Error("Received mismatching audio buffer size!");
        }
        // Allocate new sound buffer to be played.
        const source = this.#audioContext.createBufferSource();
        const soundBuffer = this.#audioContext.createBuffer(
            this.#channels,
            sizeSamplesPerChannel,
            this.#freq
        );
        // source.connect(audioContext.destination);
        source.connect(this.#gainNode);

        this.#fillWebAudioBufferFromChunk(
            blockBuffer,
            sizeSamplesPerChannel,
            soundBuffer
        );
        // Workaround https://bugzilla.mozilla.org/show_bug.cgi?id=883675 by setting the buffer only after filling. The order is important here!
        source.buffer = soundBuffer;

        // Schedule the generated sample buffer to be played out at the correct time right after the previously scheduled
        // sample buffer has finished.
        const curtime = this.#audioContext.currentTime;

        // assertion
        if (curtime > this.#nextPlayTime && this.#nextPlayTime !== 0) {
            console.log(
                "warning: Audio callback had starved sending audio by " +
                    (curtime - this.#nextPlayTime) +
                    " seconds."
            );
        }

        // Don't ever start buffer playbacks earlier from current time than a given constant 'audio.bufferingDelay', since a browser
        // may not be able to mix that audio clip in immediately, and there may be subsequent jitter that might cause the stream to starve.
        const playtime = Math.max(
            curtime + this.#bufferingDelay,
            this.#nextPlayTime
        );
        source.start(playtime);

        this.#nextPlayTime = playtime + this.#bufferDurationSecs;
    }

    protected abstract getBlockBuffer(): Uint8Array | null;

    #fillWebAudioBufferFromChunk(
        blockBuffer: Uint8Array,
        blockSize: number, // probably 4096
        dstAudioBuffer: AudioBuffer
    ) {
        for (let c = 0; c < this.#channels; ++c) {
            const channelData = dstAudioBuffer.getChannelData(c);
            if (channelData.length !== blockSize) {
                throw new Error(
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
    }

    // Pulls and queues new audio data if appropriate. This function gets "over-called" in both requestAnimationFrames and
    // setTimeouts to ensure that we get the finest granularity possible and as many chances from the browser to fill
    // new audio data. This is because setTimeouts alone have very poor granularity for audio streaming purposes, but also
    // the application might not be using emscripten_set_main_loop to drive the main loop, so we cannot rely on that alone.
    #queueNewAudioData() {
        let i = 0;
        for (; i < this.#numSimultaneouslyQueuedBuffers; ++i) {
            // Only queue new data if we don't have enough audio data already in queue. Otherwise skip this time slot
            // and wait to queue more in the next time the callback is run.
            const secsUntilNextPlayStart =
                this.#nextPlayTime - this.#audioContext.currentTime;
            if (
                secsUntilNextPlayStart >=
                this.#bufferingDelay +
                    this.#bufferDurationSecs *
                        this.#numSimultaneouslyQueuedBuffers
            )
                return;

            const blockBuffer = this.getBlockBuffer();
            if (!blockBuffer) {
                return;
            }

            // And queue it to be played after the currently playing audio stream.
            this.#pushAudio(blockBuffer, this.#bufferSize);
        }
        // console.log(`queued ${i} buffers of audio`);
    }

    // Create a callback function that will be routinely called to ask more audio data from the user application.
    #callback = () => {
        --this.#numAudioTimersPending;

        this.#queueNewAudioData();

        // Queue this callback function to be called again later to pull more audio data.
        const secsUntilNextPlayStart =
            this.#nextPlayTime - this.#audioContext.currentTime;

        // Queue the next audio frame push to be performed half-way when the previously queued buffer has finished playing.
        const preemptBufferFeedSecs = this.#bufferDurationSecs / 2.0;

        if (
            this.#numAudioTimersPending < this.#numSimultaneouslyQueuedBuffers
        ) {
            ++this.#numAudioTimersPending;
            this.#timeout = window.setTimeout(
                this.#callback,
                Math.max(
                    0.0,
                    1000.0 * (secsUntilNextPlayStart - preemptBufferFeedSecs)
                )
            );

            // If we are risking starving, immediately queue an extra buffer.
            if (
                this.#numAudioTimersPending <
                this.#numSimultaneouslyQueuedBuffers
            ) {
                ++this.#numAudioTimersPending;
                setTimeout(this.#callback, 1.0);
            }
        }
    };

    protected getBufferSize(): number {
        return this.#bufferSize;
    }
}

export class SharedMemoryEmulatorAudio
    extends BaseEmulatorAudio
    implements EmulatorAudio
{
    #gotFirstBlock: boolean = false;
    #nextChunkIndex = 0;
    #maxBuffersInSharedMemory = 5;
    #audioBlockChunkSize = this.getBufferSize() + 2;
    #audioDataBufferSize =
        this.#audioBlockChunkSize * this.#maxBuffersInSharedMemory;
    #audioDataBuffer = new SharedArrayBuffer(this.#audioDataBufferSize);
    #audioDataBufferView = new Uint8Array(this.#audioDataBuffer);

    workerConfig(): EmulatorWorkerSharedMemoryAudioConfig {
        return {
            type: "shared-memory",
            audioDataBuffer: this.#audioDataBuffer,
            audioDataBufferSize: this.#audioDataBufferSize,
            audioBlockBufferSize: this.getBufferSize(),
            audioBlockChunkSize: this.#audioBlockChunkSize,
        };
    }

    protected getBlockBuffer(): Uint8Array | null {
        // audio chunk layout
        // 0: lock state
        // 1: pointer to next chunk
        // 2->buffersize+2: audio buffer
        const curChunkIndex = this.#nextChunkIndex;
        const curChunkAddr = curChunkIndex * this.#audioBlockChunkSize;

        if (
            this.#audioDataBufferView[curChunkAddr] !==
            LockStates.UI_THREAD_LOCK
        ) {
            if (this.#gotFirstBlock) {
                // TODO: UI thread tried to read audio data from worker-locked chunk
            }
            return null;
        }
        this.#gotFirstBlock = true;

        const blockBuffer = this.#audioDataBufferView.slice(
            curChunkAddr + 2,
            curChunkAddr + 2 + this.getBufferSize()
        );
        this.#nextChunkIndex = this.#audioDataBufferView[curChunkAddr + 1];
        // console.assert(audio.nextChunkIndex != curChunkIndex, `curChunkIndex=${curChunkIndex} == nextChunkIndex=${audio.nextChunkIndex}`)
        this.#audioDataBufferView[curChunkAddr] = LockStates.EMUL_THREAD_LOCK;
        // debugger
        // console.log(`got buffer=${curChunkIndex}, next=${audio.nextChunkIndex}`)
        return blockBuffer;
    }
}

export class FallbackEmulatorAudio
    extends BaseEmulatorAudio
    implements EmulatorAudio
{
    #lastData: Uint8Array | null = null;
    workerConfig(): EmulatorWorkerFallbackAudioConfig {
        return {type: "fallback"};
    }

    protected getBlockBuffer(): Uint8Array | null {
        const data = this.#lastData;
        this.#lastData = null;
        return data;
    }

    handleData(data: Uint8Array) {
        this.#lastData = data;
    }
}
