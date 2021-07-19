import {
    EmulatorWorkerFallbackAudioConfig,
    EmulatorWorkerSharedMemoryAudioConfig,
    LockStates,
} from "./emulator-common";

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

export class FallbackEmulatorWorkerAudio implements EmulatorWorkerAudio {
    constructor(config: EmulatorWorkerFallbackAudioConfig) {
        // TODO
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
        // TODO
        return 0;
    }
}
