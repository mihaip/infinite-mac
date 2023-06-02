import {
    type EmulatorCDROM,
    type EmulatorFileActions,
    type EmulatorFileUpload,
    type EmulatorWorkerFallbackFilesConfig,
    type EmulatorWorkerSharedMemoryFilesConfig,
} from "./emulator-common";
import {type EmulatorFallbackEndpoint} from "./emulator-worker";

export interface EmulatorWorkerFiles {
    consumeRequests(): {uploads: EmulatorFileUpload[]; cdroms: EmulatorCDROM[]};
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

    consumeRequests(): {
        uploads: EmulatorFileUpload[];
        cdroms: EmulatorCDROM[];
    } {
        // Data is a JSON-encoded string and null-terminated.
        const endOfString = this.#filesBufferView.indexOf(0);
        if (endOfString === -1) {
            console.warn("Could not find null terminator.");
            return {uploads: [], cdroms: []};
        }
        const actionsString = new TextDecoder().decode(
            // TextDecoder does not like shared buffers, and we need to truncate
            // anyway.
            this.#filesBufferView.slice(0, endOfString)
        );
        const actions = JSON.parse(actionsString) as EmulatorFileActions;
        if (
            (!actions.uploads || actions.uploads.length === 0) &&
            (!actions.cdroms || actions.cdroms.length === 0)
        ) {
            return {uploads: [], cdroms: []};
        }
        const uploads = Array.from(actions.uploads);
        const cdroms = Array.from(actions.cdroms);
        actions.uploads = [];
        actions.cdroms = [];
        // Locking might be nice, but in practive we're uploading so rarely
        // that it's not likely to be an issue.
        const actionsBytes = new TextEncoder().encode(JSON.stringify(actions));
        this.#filesBufferView.set(actionsBytes);
        this.#filesBufferView.set([0], actionsBytes.length);
        return {uploads, cdroms};
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

    consumeRequests(): {
        uploads: EmulatorFileUpload[];
        cdroms: EmulatorCDROM[];
    } {
        const uploads = this.#fallbackEndpoint.consumeFileUploads();
        const cdroms = this.#fallbackEndpoint.consumeCDROMs();
        return {uploads, cdroms};
    }
}

export function getUploadData(upload: EmulatorFileUpload): Uint8Array {
    const xhr = new XMLHttpRequest();
    xhr.responseType = "arraybuffer";
    xhr.open("GET", upload.url, false);
    xhr.send();
    const data = new Uint8Array(xhr.response as ArrayBuffer);
    if (data.byteLength !== upload.size) {
        console.warn(
            `Lazy file from URL ${upload.url} was expected to have size ` +
                `${upload.size} but instead had ${data.byteLength}`
        );
    }
    return data;
}
