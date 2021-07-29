import type {
    EmulatorFileActions,
    EmulatorFileUpload,
    EmulatorWorkerFallbackFilesConfig,
    EmulatorWorkerFilesConfig,
    EmulatorWorkerSharedMemoryFilesConfig,
} from "./emulator-common";
import type {EmulatorFallbackCommandSender} from "./emulator-ui";

const FILES_BUFFER_SIZE = 10240;

export interface EmulatorFiles {
    workerConfig(): EmulatorWorkerFilesConfig;
    uploadFile(upload: EmulatorFileUpload): void;
}

export class SharedMemoryEmulatorFiles implements EmulatorFiles {
    #actions: EmulatorFileActions = {uploads: []};
    #filesBuffer = new SharedArrayBuffer(FILES_BUFFER_SIZE);
    #filesBufferView = new Uint8Array(this.#filesBuffer);

    constructor() {
        this.#updateBuffer();
    }

    workerConfig(): EmulatorWorkerSharedMemoryFilesConfig {
        return {
            type: "shared-memory",
            filesBuffer: this.#filesBuffer,
            filesBufferSize: FILES_BUFFER_SIZE,
        };
    }

    uploadFile(upload: EmulatorFileUpload) {
        this.#actions.uploads.push(upload);
        this.#updateBuffer();
    }

    #updateBuffer() {
        const actionsString = JSON.stringify(this.#actions);
        const actionsBytes = new TextEncoder().encode(actionsString);
        if (actionsBytes.length > FILES_BUFFER_SIZE) {
            console.warn("Files actions is too large, dropping");
            this.#actions = {uploads: []};
            return;
        }
        this.#filesBufferView.set(actionsBytes);
        this.#filesBufferView.set([0], actionsBytes.length);
    }
}

export class FallbackEmulatorFiles implements EmulatorFiles {
    #commandSender: EmulatorFallbackCommandSender;
    constructor(commandSender: EmulatorFallbackCommandSender) {
        this.#commandSender = commandSender;
    }

    workerConfig(): EmulatorWorkerFallbackFilesConfig {
        return {type: "fallback"};
    }

    uploadFile(upload: EmulatorFileUpload) {
        this.#commandSender({
            type: "upload_file",
            upload,
        });
    }
}
