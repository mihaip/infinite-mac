import {
    type EmulatorCDROM,
    type EmulatorFileActions,
    type EmulatorFileUpload,
    type EmulatorWorkerFallbackFilesConfig,
    type EmulatorWorkerFilesConfig,
    type EmulatorWorkerSharedMemoryFilesConfig,
} from "@/emulator/common/common";
import {type EmulatorFallbackCommandSender} from "@/emulator/ui/ui";

const FILES_BUFFER_SIZE = 1024 * 1024;

export interface EmulatorFiles {
    workerConfig(): EmulatorWorkerFilesConfig;
    uploadFile(upload: EmulatorFileUpload): void;
    uploadFiles(upload: EmulatorFileUpload[]): void;
    loadCDROM(cdrom: EmulatorCDROM): void;
}

export class SharedMemoryEmulatorFiles implements EmulatorFiles {
    #actions: EmulatorFileActions = {uploads: [], cdroms: []};
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

    uploadFile(uploads: EmulatorFileUpload) {
        this.uploadFiles([uploads]);
    }

    uploadFiles(uploads: EmulatorFileUpload[]) {
        this.#actions.uploads.push(...uploads);
        this.#updateBuffer();
    }

    loadCDROM(cdrom: EmulatorCDROM) {
        this.#actions.cdroms.push(cdrom);
        this.#updateBuffer();
    }

    #updateBuffer() {
        const actionsString = JSON.stringify(this.#actions);
        this.#actions = {uploads: [], cdroms: []};
        const actionsBytes = new TextEncoder().encode(actionsString);
        if (actionsBytes.length > FILES_BUFFER_SIZE) {
            console.warn("Files actions is too large, dropping");
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

    uploadFiles(uploads: EmulatorFileUpload[]) {
        for (const upload of uploads) {
            this.uploadFile(upload);
        }
    }

    loadCDROM(cdrom: EmulatorCDROM) {
        this.#commandSender({
            type: "load_cdrom",
            cdrom,
        });
    }
}
