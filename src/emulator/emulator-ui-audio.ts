import type {
    EmulatorAudioProcessorOptions,
    EmulatorWorkerAudioConfig,
    EmulatorWorkerFallbackAudioConfig,
    EmulatorWorkerSharedMemoryAudioConfig,
} from "./emulator-common";
import audioWorkletPath from "worklet-loader!./emulator-audio-worklet";
import type {EmulatorInput} from "./emulator-ui-input";
import {RingBuffer} from "ringbuf.js";

export abstract class EmulatorAudio {
    #input: EmulatorInput;
    #audioContext?: AudioContext;
    #debugInterval?: number;
    protected emulatorPlaybackNode?: AudioWorkletNode;

    constructor(input: EmulatorInput) {
        this.#input = input;
    }

    async init(
        sampleRate: number,
        sampleSize: number,
        channels: number,
        debug: boolean
    ) {
        console.log(
            `Initializing audio (sampleRate=${sampleRate}, sampleSize=${sampleSize}, channels=${channels})`
        );
        this.#audioContext = new AudioContext({
            latencyHint: "interactive",
            sampleRate,
        });
        if (!this.#audioContext.audioWorklet) {
            console.warn("AudioWorklet not supported");
            return;
        }
        await this.#audioContext.audioWorklet.addModule(audioWorkletPath);
        this.emulatorPlaybackNode = new AudioWorkletNode(
            this.#audioContext,
            "emulator-playback-processor",
            {
                numberOfInputs: 0,
                numberOfOutputs: 1,
                outputChannelCount: [channels],
                channelCount: channels,
                processorOptions: {
                    sampleSize,
                    debug,
                    config: this.workerConfig(),
                } as EmulatorAudioProcessorOptions,
            }
        );
        this.emulatorPlaybackNode.connect(this.#audioContext.destination);

        // We can't start the audio context until there's a user gesture.
        if (this.#audioContext.state === "suspended") {
            window.addEventListener("mousedown", this.#resumeOnGesture, {
                once: true,
            });
            window.addEventListener("touchstart", this.#resumeOnGesture, {
                once: true,
            });
        } else {
            this.#handleAudioContextRunning();
        }

        if (debug) {
            this.#debugInterval = window.setInterval(
                () => this.#debugLog(sampleRate, sampleSize, channels),
                100
            );
        }
    }

    #resumeOnGesture = () => {
        this.#audioContext?.resume();
        this.#audioContext?.addEventListener(
            "statechange",
            () => {
                if (this.#audioContext?.state === "running") {
                    // Give the audio worklet some time to start processing
                    // before we signal the emulator to start emitting audio,
                    // so that the buffer doesn't get too full.
                    window.setTimeout(
                        () => this.#handleAudioContextRunning(),
                        250
                    );
                }
            },
            {once: true}
        );
    };

    #handleAudioContextRunning() {
        this.resetAudioBuffer();
        this.#input.handleInput({type: "audio-context-running"});
    }

    stop() {
        this.#audioContext?.close();
        window.removeEventListener("mousedown", this.#resumeOnGesture);
        window.removeEventListener("touchstart", this.#resumeOnGesture);
        if (this.#debugInterval) {
            window.clearInterval(this.#debugInterval);
        }
    }

    #debugLog(sampleRate: number, sampleSize: number, channels: number) {
        const bufferByteLength = this.currentAudioBufferByteLength();
        if (bufferByteLength === 0) {
            return;
        }
        const bufferSampleLength =
            bufferByteLength / (sampleSize >> 3) / channels;
        const bufferMsLength = (bufferSampleLength / sampleRate) * 1000;
        console.log(
            "audio buffer:",
            ((bufferByteLength / AUDIO_BUFFER_SIZE) * 100).toFixed(1) +
                "% full - ",
            bufferByteLength,
            "bytes - ",
            bufferSampleLength,
            "samples - ",
            bufferMsLength.toFixed(1),
            "ms"
        );
    }

    abstract workerConfig(): EmulatorWorkerAudioConfig;

    protected abstract resetAudioBuffer(): void;
    protected abstract currentAudioBufferByteLength(): number;
}

const AUDIO_BUFFER_SIZE = 2 * 22050; // 1 second of 16-bit mono audio at 22050 Hz

export class SharedMemoryEmulatorAudio extends EmulatorAudio {
    #audioBuffer = new SharedArrayBuffer(AUDIO_BUFFER_SIZE);
    #audioRingBuffer = new RingBuffer(this.#audioBuffer, Uint8Array);

    workerConfig(): EmulatorWorkerSharedMemoryAudioConfig {
        return {
            type: "shared-memory",
            audioBuffer: this.#audioBuffer,
        };
    }

    protected resetAudioBuffer() {
        const buffer = new Uint8Array(this.#audioRingBuffer.available_read());
        this.#audioRingBuffer.pop(buffer);
    }

    protected currentAudioBufferByteLength(): number {
        return this.#audioRingBuffer.available_read();
    }
}

export class FallbackEmulatorAudio extends EmulatorAudio {
    workerConfig(): EmulatorWorkerFallbackAudioConfig {
        return {type: "fallback"};
    }

    handleData(data: Uint8Array) {
        this.emulatorPlaybackNode?.port.postMessage({type: "data", data});
    }

    protected resetAudioBuffer() {
        this.emulatorPlaybackNode?.port.postMessage({type: "reset"});
    }

    protected currentAudioBufferByteLength(): number {
        return 0;
    }
}
