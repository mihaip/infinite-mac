import {EmulatorWorkerVideoConfig} from "./emulator-common";

export class EmulatorWorkerVideo {
    #screenBufferView: Uint8Array;
    #videoModeBufferView: Int32Array;

    constructor(config: EmulatorWorkerVideoConfig) {
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
