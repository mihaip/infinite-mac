import {
    EmulatorWorkerFallbackVideoConfig,
    EmulatorWorkerSharedMemoryVideoConfig,
    EmulatorWorkerVideoConfig,
} from "./emulator-common";
import type {EmulatorConfig} from "./emulator-ui";

const VIDEO_MODE_BUFFER_SIZE = 10;

export interface EmulatorVideo {
    workerConfig(): EmulatorWorkerVideoConfig;
    putImageData(imageData: ImageData): void;
}

export class SharedMemoryEmulatorVideo implements EmulatorVideo {
    #config: EmulatorConfig;
    #screenBuffer: SharedArrayBuffer;
    #screenBufferView: Uint8Array;
    #videoModeBuffer = new SharedArrayBuffer(VIDEO_MODE_BUFFER_SIZE * 4);
    #videoModeBufferView = new Int32Array(this.#videoModeBuffer);

    constructor(config: EmulatorConfig) {
        this.#config = config;
        const screenBufferSize = config.screenWidth * config.screenHeight * 4; // 32bpp
        this.#screenBuffer = new SharedArrayBuffer(screenBufferSize);
        this.#screenBufferView = new Uint8Array(this.#screenBuffer);
    }

    workerConfig(): EmulatorWorkerSharedMemoryVideoConfig {
        return {
            type: "shared-memory",
            screenBuffer: this.#screenBuffer,
            screenBufferSize: this.#screenBuffer.byteLength,
            videoModeBuffer: this.#videoModeBuffer,
            videoModeBufferSize: VIDEO_MODE_BUFFER_SIZE,
            screenWidth: this.#config.screenWidth,
            screenHeight: this.#config.screenHeight,
        };
    }

    putImageData(imageData: ImageData) {
        const pixelsRGBA = imageData.data;
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
    }
}

export class FallbackEmulatorVideo implements EmulatorVideo {
    constructor(config: EmulatorConfig) {}

    workerConfig(): EmulatorWorkerFallbackVideoConfig {
        return {type: "fallback"};
    }

    putImageData(imageData: ImageData): void {}
}
