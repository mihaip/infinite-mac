import {
    type EmulatorClipboardData,
    type EmulatorWorkerFallbackClipboardConfig,
    type EmulatorWorkerSharedMemoryClipboardConfig,
} from "@/emulator/common/common";
import {type EmulatorFallbackEndpoint} from "@/emulator/worker/worker";

export interface EmulatorWorkerClipboard {
    clipboardText(): string | undefined;
}

export class SharedMemoryEmulatorWorkerClipboard
    implements EmulatorWorkerClipboard
{
    #clipboardBufferView: Uint8Array;

    constructor(config: EmulatorWorkerSharedMemoryClipboardConfig) {
        this.#clipboardBufferView = new Uint8Array(
            config.clipboardBuffer,
            0,
            config.clipboardBufferSize
        );
    }

    clipboardText(): string | undefined {
        const clipboardData = this.#clipboardData();
        return clipboardData?.text;
    }

    #clipboardData(): EmulatorClipboardData | undefined {
        // Data is a JSON-encoded string and null-terminated.
        const endOfString = this.#clipboardBufferView.indexOf(0);
        if (endOfString === -1) {
            console.warn("Could not find null terminator.");
            return undefined;
        }
        const dataString = new TextDecoder().decode(
            // TextDecoder does not like shared buffers, and we need to truncate
            // anyway.
            this.#clipboardBufferView.slice(0, endOfString)
        );
        return JSON.parse(dataString) as EmulatorClipboardData;
    }
}

export class FallbackEmulatorWorkerClipboard
    implements EmulatorWorkerClipboard
{
    #fallbackEndpoint: EmulatorFallbackEndpoint;
    #data: EmulatorClipboardData | undefined;

    constructor(
        config: EmulatorWorkerFallbackClipboardConfig,
        fallbackEndpoint: EmulatorFallbackEndpoint
    ) {
        this.#fallbackEndpoint = fallbackEndpoint;
    }

    clipboardText(): string | undefined {
        const clipboardData = this.#clipboardData();
        return clipboardData?.text;
    }

    #clipboardData(): EmulatorClipboardData | undefined {
        this.#data =
            this.#fallbackEndpoint.consumeSetClipboardData() ?? this.#data;
        return this.#data;
    }
}
