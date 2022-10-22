import type {
    EmulatorWorkerFallbackAudioConfig,
    EmulatorWorkerSharedMemoryAudioConfig,
} from "./emulator-common";
import {LockStates} from "./emulator-common";

export interface EmulatorWorkerAudio {
    openAudio(
        sampleRate: number,
        sampleSize: number,
        channels: number,
        framesPerBuffer: number
    ): void;

    enqueueAudio(newAudio: Uint8Array): number;
}

export class SharedMemoryEmulatorWorkerAudio implements EmulatorWorkerAudio {
    #audioDataBufferView: Uint8Array;
    #nextAudioChunkIndex = 0;
    #audioBlockChunkSize: number;

    constructor(config: EmulatorWorkerSharedMemoryAudioConfig) {
        this.#audioDataBufferView = new Uint8Array(
            config.audioDataBuffer,
            0,
            config.audioDataBufferSize
        );
        this.#audioBlockChunkSize = config.audioBlockChunkSize;
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

    enqueueAudio(newAudio: Uint8Array): number {
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
        return newAudio.length;
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

    openAudio(
        sampleRate: number,
        sampleSize: number,
        channels: number,
        framesPerBuffer: number
    ): void {
        // TODO
    }

    enqueueAudio(newAudio: Uint8Array): number {
        // Can't send the Wasm memory directly, need to make a copy. It's net
        // neutral because we can use a Transferable for it.
        this.#sender(new Uint8Array(newAudio));
        return newAudio.length;
    }
}
