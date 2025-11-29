import {RingBuffer} from "ringbuf.js";
import {
    type EmulatorWorkerFallbackAudioConfig,
    type EmulatorWorkerSharedMemoryAudioConfig,
} from "@/emulator/common/common";

export interface EmulatorWorkerAudio {
    audioBufferSize(): number;
    enqueueAudio(newAudio: Uint8Array): void;
}

export class SharedMemoryEmulatorWorkerAudio implements EmulatorWorkerAudio {
    #audioRingBuffer: RingBuffer<Uint8Array>;

    constructor(config: EmulatorWorkerSharedMemoryAudioConfig) {
        this.#audioRingBuffer = new RingBuffer(config.audioBuffer, Uint8Array);
    }

    audioBufferSize(): number {
        return this.#audioRingBuffer.available_read();
    }

    enqueueAudio(newAudio: Uint8Array): void {
        const availableWrite = this.#audioRingBuffer.available_write();
        if (availableWrite < newAudio.byteLength) {
            console.warn(
                `Audio buffer cannot fit new audio (${newAudio.byteLength} bytes), only ${availableWrite} bytes available.`
            );
            return;
        }

        this.#audioRingBuffer.push(newAudio);
    }
}

export type EmulatorWorkerAudioFallbackSender = (data: Uint8Array) => void;

export class FallbackEmulatorWorkerAudio implements EmulatorWorkerAudio {
    #sender: EmulatorWorkerAudioFallbackSender;

    constructor(
        config: EmulatorWorkerFallbackAudioConfig,
        sender: EmulatorWorkerAudioFallbackSender
    ) {
        this.#sender = sender;
    }

    audioBufferSize(): number {
        return 0;
    }

    enqueueAudio(newAudio: Uint8Array): number {
        // Can't send the Wasm memory directly, need to make a copy. It's net
        // neutral because we can use a Transferable for it.
        this.#sender(new Uint8Array(newAudio));
        return newAudio.length;
    }
}
