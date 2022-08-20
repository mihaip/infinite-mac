import type {
    EmulatorWorkerFallbackVideoBlit,
    EmulatorWorkerFallbackVideoConfig,
    EmulatorWorkerSharedMemoryVideoConfig,
    EmulatorWorkerVideoBlit,
    EmulatorWorkerVideoConfig,
} from "./emulator-common";
import type {EmulatorConfig} from "./emulator-ui";

const VIDEO_MODE_BUFFER_SIZE = 10;

export interface EmulatorVideo {
    workerConfig(): EmulatorWorkerVideoConfig;
    blit(blitData: EmulatorWorkerVideoBlit): void;
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

    blit(blitData: EmulatorWorkerVideoBlit) {
        // No-op, we get updates via the SharedArrayBuffer
    }

    putImageData(imageData: ImageData) {
        putVideoIntoImageData(
            this.#screenBufferView,
            Boolean(this.#videoModeBufferView[0]),
            imageData
        );
    }
}

export class FallbackEmulatorVideo implements EmulatorVideo {
    #config: EmulatorConfig;
    #lastBlitData?: EmulatorWorkerFallbackVideoBlit;

    constructor(config: EmulatorConfig) {
        this.#config = config;
    }

    workerConfig(): EmulatorWorkerFallbackVideoConfig {
        return {type: "fallback"};
    }

    blit(blitData: EmulatorWorkerVideoBlit) {
        if (blitData.type !== "fallback") {
            return;
        }

        this.#lastBlitData = blitData;
    }

    putImageData(imageData: ImageData): void {
        if (!this.#lastBlitData) {
            return;
        }

        putVideoIntoImageData(
            this.#lastBlitData.data,
            this.#lastBlitData.usingPalette,
            imageData
        );
    }
}

function putVideoIntoImageData(
    videoData: Uint8Array,
    usingPalette: boolean,
    imageData: ImageData
) {
    const pixelsRGBA = imageData.data;
    if (usingPalette) {
        // palette expanded mode is already in RGBA order
        pixelsRGBA.set(videoData);
    } else {
        // offset by 1 to go from ARGB to RGBA (we don't actually care about the
        // alpha, it should be the same for all pixels)
        pixelsRGBA.set(videoData.subarray(1, videoData.byteLength - 1));
    }
}
