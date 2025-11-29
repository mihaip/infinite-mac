import {
    type EmulatorWorkerFallbackVideoConfig,
    type EmulatorWorkerSharedMemoryVideoConfig,
    type EmulatorWorkerVideoBlit,
    type EmulatorWorkerVideoBlitRect,
} from "@/emulator/common/common";

export interface EmulatorWorkerVideo {
    blit(data: Uint8Array, rect?: EmulatorWorkerVideoBlitRect): void;
}

export type EmulatorWorkerVideoBlitSender = (
    data: EmulatorWorkerVideoBlit,
    transfer?: Transferable[]
) => void;

export class SharedMemoryEmulatorWorkerVideo implements EmulatorWorkerVideo {
    #screenBufferView: Uint8Array;
    #videoModeBufferView: Int32Array;
    #blitSender: EmulatorWorkerVideoBlitSender;

    constructor(
        config: EmulatorWorkerSharedMemoryVideoConfig,
        blitSender: EmulatorWorkerVideoBlitSender
    ) {
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
        this.#blitSender = blitSender;
    }

    blit(data: Uint8Array, rect?: EmulatorWorkerVideoBlitRect) {
        this.#videoModeBufferView[0] = data.length;
        this.#screenBufferView.set(data);
        this.#blitSender({type: "shared-memory", rect});
    }
}

export class FallbackEmulatorWorkerVideo implements EmulatorWorkerVideo {
    #blitSender: EmulatorWorkerVideoBlitSender;

    constructor(
        config: EmulatorWorkerFallbackVideoConfig,
        blitSender: EmulatorWorkerVideoBlitSender
    ) {
        this.#blitSender = blitSender;
    }

    blit(data: Uint8Array, rect?: EmulatorWorkerVideoBlitRect) {
        // Can't send the Wasm memory directly, need to make a copy. It's net
        // neutral because we can use a Transferable for it.
        data = new Uint8Array(data);
        this.#blitSender(
            {
                type: "fallback",
                data,
                rect,
            },
            [data.buffer]
        );
    }
}
