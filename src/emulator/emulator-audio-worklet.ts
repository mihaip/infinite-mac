import {RingBuffer} from "ringbuf.js";
import {
    type EmulatorAudioProcessorOptions,
    type EmulatorWorkerSharedMemoryAudioConfig,
} from "./emulator-common";

interface EmulatorAudioDataProvider {
    audioData(): Uint8Array | undefined;
}

// Only read this much at a time from the read buffer (2x audio_frame_per_block
// from Basilisk II's audio_js.cpp, assuming 16-bit samples). This way we can
// exert backpressure on the worker if the buffer starts to fill up.
const READ_CHUNK_SIZE = 384 * 2 * 2;

class SharedMemoryEmulatorAudioDataProvider
    implements EmulatorAudioDataProvider
{
    #audioRingBuffer: RingBuffer<Uint8Array>;

    constructor(config: EmulatorWorkerSharedMemoryAudioConfig) {
        this.#audioRingBuffer = new RingBuffer(config.audioBuffer, Uint8Array);
    }

    audioData(): Uint8Array | undefined {
        if (this.#audioRingBuffer.empty()) {
            return undefined;
        }
        const audioDataLength = this.#audioRingBuffer.available_read();
        const audioData = new Uint8Array(
            Math.min(audioDataLength, READ_CHUNK_SIZE)
        );
        this.#audioRingBuffer.pop(audioData);
        return audioData;
    }
}

class FallbackEmulatorAudioDataProvider implements EmulatorAudioDataProvider {
    #datas: Uint8Array[] = [];
    constructor(processor: AudioWorkletProcessor) {
        processor.port.onmessage = e => {
            if (e.data.type === "data") {
                this.#datas.push(e.data.data);
            } else if (e.data.type === "reset") {
                this.#datas = [];
            }
        };
    }

    audioData(): Uint8Array | undefined {
        return this.#datas.shift();
    }
}

export class EmulatorPlaybackProcessor extends AudioWorkletProcessor {
    #options: EmulatorAudioProcessorOptions;
    #audioDataProvider: EmulatorAudioDataProvider;
    #currentAudioData: Uint8Array | undefined;
    #currentAudioDataView: DataView | undefined;
    #currentAudioDataOffset = 0;
    #silenceWarningLogTime = -1;
    #errorLogTime = -1;

    constructor(options: {processorOptions: EmulatorAudioProcessorOptions}) {
        super();
        this.#options = options.processorOptions;
        const {config} = this.#options;
        if (config.type === "shared-memory") {
            this.#audioDataProvider = new SharedMemoryEmulatorAudioDataProvider(
                config
            );
        } else {
            this.#audioDataProvider = new FallbackEmulatorAudioDataProvider(
                this
            );
        }
    }

    process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: Record<string, Float32Array>
    ): boolean {
        const output = outputs[0];
        const channel = output[0];
        for (let i = 0; i < channel.length; i++) {
            try {
                channel[i] = this.#generateSample();
            } catch (e) {
                // Avoid spamming the console too often
                if (currentTime - this.#errorLogTime > 1) {
                    console.error(
                        `Could not generate sample (size=${
                            this.#currentAudioData?.byteLength
                        } offset=${this.#currentAudioDataOffset})`,
                        e
                    );
                    this.#errorLogTime = currentTime;
                }
                channel[i] = 0;
            }
        }
        return true;
    }

    #generateSample(): number {
        if (
            !this.#currentAudioData ||
            this.#currentAudioData.byteLength === this.#currentAudioDataOffset
        ) {
            this.#currentAudioData = this.#audioDataProvider.audioData();
            this.#currentAudioDataOffset = 0;
            if (this.#currentAudioData) {
                this.#currentAudioDataView = new DataView(
                    this.#currentAudioData.buffer,
                    this.#currentAudioData.byteOffset
                );
                // eslint-disable-next-line no-constant-condition
                if (this.#options.debug && false) {
                    // too noisy even for debug
                    this.#logCurrentAudioData();
                }
            }
        }
        if (
            !this.#currentAudioData ||
            !this.#currentAudioDataView ||
            this.#currentAudioData.byteLength === this.#currentAudioDataOffset
        ) {
            // Avoid spamming the console too often if we're generating silence.
            if (
                this.#options.debug &&
                currentTime - this.#silenceWarningLogTime > 1
            ) {
                console.warn("No audio data, generating silence");
                this.#silenceWarningLogTime = currentTime;
            }
            return 0;
        }

        switch (this.#options.sampleSize) {
            case 16: {
                const sample16 = this.#currentAudioDataView.getInt16(
                    this.#currentAudioDataOffset
                );
                this.#currentAudioDataOffset += 2;
                return sample16 / 0x8000; // convert i16 to f32 in range -1 to +1
            }
            case 8: {
                const sample8 = this.#currentAudioDataView.getInt8(
                    this.#currentAudioDataOffset
                );
                this.#currentAudioDataOffset += 1;
                return sample8 / 0x80; // convert u8 to f32 in range -1 to +1
            }
            default:
                throw new Error(
                    `Unsupported sample size: ${this.#options.sampleSize}`
                );
        }
    }

    #logCurrentAudioData() {
        if (!this.#currentAudioData || !this.#currentAudioDataView) {
            return;
        }
        const v: string[] = [];
        let repeat = 1;
        const sampleSize = this.#options.sampleSize >> 3;
        for (
            let i = 0;
            i < this.#currentAudioData.byteLength;
            i += sampleSize
        ) {
            const sample = (
                sampleSize === 2
                    ? this.#currentAudioDataView.getUint16(i)
                    : this.#currentAudioDataView.getUint8(i)
            ).toString(16);
            if (v.length > 0 && v[v.length - 1] === sample) {
                repeat++;
                continue;
            }
            if (repeat > 1) {
                v[v.length - 1] += `•${repeat}`;
            }
            repeat = 1;
            v.push(sample);
        }
        if (v.length === 1 && v[0] === "0") {
            // All silence, ignore.
            return;
        }
        if (repeat > 1) {
            v[v.length - 1] += `•${repeat}`;
        }
        console.log("Got audio data: " + v.join(" "));
    }
}

registerProcessor("emulator-playback-processor", EmulatorPlaybackProcessor);
