import type {
    EmulatorFileActions,
    EmulatorFileUpload,
    EmulatorWorkerFallbackFilesConfig,
    EmulatorWorkerSharedMemoryFilesConfig,
} from "./emulator-common";
import type {EmulatorFallbackEndpoint} from "./emulator-worker";

export interface EmulatorWorkerFiles {
    fileUploads(): EmulatorFileUpload[];
}

export class SharedMemoryEmulatorWorkerFiles implements EmulatorWorkerFiles {
    #filesBufferView: Uint8Array;

    constructor(config: EmulatorWorkerSharedMemoryFilesConfig) {
        this.#filesBufferView = new Uint8Array(
            config.filesBuffer,
            0,
            config.filesBufferSize
        );
    }

    fileUploads(): EmulatorFileUpload[] {
        // Data is a JSON-encoded string and null-terminated.
        const endOfString = this.#filesBufferView.indexOf(0);
        if (endOfString === -1) {
            console.warn("Could not find null terminator.");
            return [];
        }
        const actionsString = new TextDecoder().decode(
            // TextDecoder does not like shared buffers, and we need to truncate
            // anyway.
            this.#filesBufferView.slice(0, endOfString)
        );
        const actions = JSON.parse(actionsString) as EmulatorFileActions;
        if (!actions.uploads) {
            return [];
        }
        const uploads = Array.from(actions.uploads);
        actions.uploads = [];
        // Locking might be nice, but in practive we're uploading so rarely
        // that it's not likely to be an issue.
        const actionsBytes = new TextEncoder().encode(JSON.stringify(actions));
        this.#filesBufferView.set(actionsBytes);
        this.#filesBufferView.set([0], actionsBytes.length);
        return uploads;
    }
}

export class FallbackEmulatorWorkerFiles implements EmulatorWorkerFiles {
    #fallbackEndpoint: EmulatorFallbackEndpoint;

    constructor(
        config: EmulatorWorkerFallbackFilesConfig,
        fallbackEndpoint: EmulatorFallbackEndpoint
    ) {
        this.#fallbackEndpoint = fallbackEndpoint;
    }

    fileUploads(): EmulatorFileUpload[] {
        return this.#fallbackEndpoint.consumeFileUploads();
    }
}
