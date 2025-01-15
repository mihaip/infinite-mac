import {
    type EmulatorWorkerFallbackVideoBlit,
    type EmulatorWorkerFallbackVideoConfig,
    type EmulatorWorkerSharedMemoryVideoConfig,
    type EmulatorWorkerVideoBlit,
    type EmulatorWorkerVideoBlitRect,
    type EmulatorWorkerVideoConfig,
} from "./emulator-common";
import {type EmulatorConfig} from "./emulator-ui";

const VIDEO_MODE_BUFFER_SIZE = 10;

export interface EmulatorVideo {
    workerConfig(): EmulatorWorkerVideoConfig;
    blit(blitData: EmulatorWorkerVideoBlit): void;
    imageData(): Uint8Array | undefined;
    consumeBlitRect(): EmulatorWorkerVideoBlitRect | undefined;
}

export class SharedMemoryEmulatorVideo implements EmulatorVideo {
    #config: EmulatorConfig;
    #screenBuffer: SharedArrayBuffer;
    #screenBufferView: Uint8Array;
    #videoModeBuffer = new SharedArrayBuffer(VIDEO_MODE_BUFFER_SIZE * 4);
    #videoModeBufferView = new Int32Array(this.#videoModeBuffer);
    #lastBlitRect?: EmulatorWorkerVideoBlitRect;

    constructor(config: EmulatorConfig) {
        this.#config = config;
        // Allocate the maximum screen size we're likely to need, so that we
        // don't need to support resizing the SharedArrayBuffer if the
        // resolution is increased after machine startup.
        const screenBufferSize =
            Math.max(config.screenWidth, 1600) *
            Math.max(config.screenHeight, 1200) *
            4; // 32bpp
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
        // Don't need to do anything with the data, it's automatically read in
        // via the SharedArrayBuffer.
        const {rect} = blitData;
        if (!rect) {
            return;
        }
        if (!this.#lastBlitRect) {
            this.#lastBlitRect = rect;
        } else {
            unionBlitRect(this.#lastBlitRect, rect);
        }
    }

    imageData(): Uint8Array {
        const bufferSize = this.#videoModeBufferView[0];
        return this.#screenBufferView.subarray(0, bufferSize);
    }

    consumeBlitRect(): EmulatorWorkerVideoBlitRect | undefined {
        const rect = this.#lastBlitRect;
        this.#lastBlitRect = undefined;
        return rect;
    }
}

export class FallbackEmulatorVideo implements EmulatorVideo {
    #config: EmulatorConfig;
    #lastBlitData?: EmulatorWorkerFallbackVideoBlit;
    #lastBlitRect?: EmulatorWorkerVideoBlitRect;

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
        const {rect} = blitData;
        if (!rect) {
            return;
        }
        if (!this.#lastBlitRect) {
            this.#lastBlitRect = rect;
        } else {
            unionBlitRect(this.#lastBlitRect, rect);
        }
    }

    imageData(): Uint8Array | undefined {
        return this.#lastBlitData?.data;
    }

    consumeBlitRect(): EmulatorWorkerVideoBlitRect | undefined {
        const rect = this.#lastBlitRect;
        this.#lastBlitRect = undefined;
        return rect;
    }
}

function unionBlitRect(
    lastRect: EmulatorWorkerVideoBlitRect,
    rect: EmulatorWorkerVideoBlitRect
) {
    lastRect.top = Math.min(lastRect.top, rect.top);
    lastRect.left = Math.min(lastRect.left, rect.left);
    lastRect.bottom = Math.max(lastRect.bottom, rect.bottom);
    lastRect.right = Math.max(lastRect.right, rect.right);
}
