import {
    EmulatorWorkerFallbackVideoConfig,
    EmulatorWorkerSharedMemoryVideoConfig,
} from "./emulator-common";

export interface EmulatorWorkerVideo {
    blit(
        data: Uint8Array,
        width: number,
        height: number,
        depth: number,
        usingPalette: number
    ): void;
}

export class SharedMemoryEmulatorWorkerVideo implements EmulatorWorkerVideo {
    #screenBufferView: Uint8Array;
    #videoModeBufferView: Int32Array;

    constructor(config: EmulatorWorkerSharedMemoryVideoConfig) {
        this.#screenBufferView = new Uint8Array(
            config.screenBuffer,
            0,
            config.screenBufferSize
        );

        this.#videoModeBufferView = new Int32Array(
            config.videoModeBuffer,
            0,
            config.videoModeBufferSize
        );
    }

    blit(
        data: Uint8Array,
        width: number,
        height: number,
        depth: number,
        usingPalette: number
    ) {
        this.#videoModeBufferView[0] = width;
        this.#videoModeBufferView[1] = height;
        this.#videoModeBufferView[2] = depth;
        this.#videoModeBufferView[3] = usingPalette;
        this.#screenBufferView.set(data);
        postMessage({type: "emulator_blit"});
    }
}

export class FallbackEmulatorWorkerVideo implements EmulatorWorkerVideo {
    constructor(config: EmulatorWorkerFallbackVideoConfig) {
        // TODO
    }

    blit(
        data: Uint8Array,
        width: number,
        height: number,
        depth: number,
        usingPalette: number
    ) {
        // TODO
    }
}
