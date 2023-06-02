import {
    type EmulatorClipboardData,
    type EmulatorWorkerClipboardConfig,
    type EmulatorWorkerFallbackClipboardConfig,
} from "./emulator-common";
import {type EmulatorFallbackCommandSender} from "./emulator-ui";

export interface EmulatorClipboard {
    workerConfig(): EmulatorWorkerClipboardConfig;
    setClipboardText(text: string): void;
}

const CLIPBOARD_BUFFER_SIZE = 10240;

export class SharedMemoryEmulatorClipboard implements EmulatorClipboard {
    #data: EmulatorClipboardData = {};
    #clipboardBuffer = new SharedArrayBuffer(CLIPBOARD_BUFFER_SIZE);
    #clipboardBufferView = new Uint8Array(this.#clipboardBuffer);

    constructor() {
        this.#updateBuffer();
    }

    workerConfig(): EmulatorWorkerClipboardConfig {
        return {
            type: "shared-memory",
            clipboardBuffer: this.#clipboardBuffer,
            clipboardBufferSize: CLIPBOARD_BUFFER_SIZE,
        };
    }

    setClipboardText(text: string): void {
        this.#data = {text};
        this.#updateBuffer();
    }

    #updateBuffer() {
        const dataString = JSON.stringify(this.#data);
        const dataBytes = new TextEncoder().encode(dataString);
        if (dataBytes.length > CLIPBOARD_BUFFER_SIZE) {
            console.warn("Clipboard is too large, dropping");
            this.#data = {};
            return;
        }
        this.#clipboardBufferView.set(dataBytes);
        this.#clipboardBufferView.set([0], dataBytes.length);
    }
}

export class FallbackEmulatorClipboard implements EmulatorClipboard {
    #commandSender: EmulatorFallbackCommandSender;
    constructor(commandSender: EmulatorFallbackCommandSender) {
        this.#commandSender = commandSender;
    }

    workerConfig(): EmulatorWorkerFallbackClipboardConfig {
        return {type: "fallback"};
    }

    setClipboardText(text: string): void {
        this.#commandSender({
            type: "set_clipboard_data",
            data: {text},
        });
    }
}
