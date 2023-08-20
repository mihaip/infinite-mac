import {type EmulatorChunkedFileSpec} from "./emulator-common";
import {dataFileName, dirtyChunksFileName} from "./emulator-common-disk-saver";
import {type EmulatorWorkerChunkedDiskDelegate} from "./emulator-worker-chunked-disk";

/**
 * Persists changes made to a chunked disk into a origin private file system
 * file. Keeps track of which chunks have been written to, so that we can
 * restore them on the next read.
 */
export class EmulatorWorkerDiskSaver
    implements EmulatorWorkerChunkedDiskDelegate
{
    #spec: EmulatorChunkedFileSpec;
    #delegate: EmulatorWorkerChunkedDiskDelegate;
    #dataHandle?: FileSystemSyncAccessHandle;
    #dirtyChunksHandle?: FileSystemSyncAccessHandle;
    #dirtyChunks: Uint8Array;
    #chunksToRead: Uint8Array;
    #chunksToReadCount: number;

    constructor(
        spec: EmulatorChunkedFileSpec,
        delegate: EmulatorWorkerChunkedDiskDelegate
    ) {
        this.#spec = spec;
        this.#delegate = delegate;
        const chunkByteCount = spec.chunks.length >> 3;
        this.#dirtyChunks = new Uint8Array(chunkByteCount);
        this.#chunksToRead = new Uint8Array(chunkByteCount);
        this.#chunksToReadCount = 0;
    }

    get name(): string {
        return this.#spec.name;
    }

    async init(opfsRoot: FileSystemDirectoryHandle) {
        const dataHandle = await opfsRoot.getFileHandle(
            dataFileName(this.#spec),
            {create: true}
        );
        this.#dataHandle = await dataHandle.createSyncAccessHandle();
        const dirtyChunksHandle = await opfsRoot.getFileHandle(
            dirtyChunksFileName(this.#spec),
            {create: true}
        );
        this.#dirtyChunksHandle =
            await dirtyChunksHandle.createSyncAccessHandle();
        this.#dirtyChunksHandle.read(this.#dirtyChunks, {at: 0});
        this.#dirtyChunksHandle.read(this.#chunksToRead, {at: 0});

        const chunkByteCount = this.#spec.chunks.length >> 3;
        for (let i = 0; i < chunkByteCount; i++) {
            const chunkByte = this.#chunksToRead[i];
            if (chunkByte === 0) {
                continue;
            }
            for (let j = 0; j < 8; j++) {
                const chunkBit = 1 << j;
                if (chunkByte & chunkBit) {
                    this.#chunksToReadCount++;
                }
            }
        }
        console.log(
            `Loaded saved disk ${this.#spec.name} with ${
                this.#chunksToReadCount
            } dirty chunks`
        );
    }

    close() {
        this.#dataHandle?.close();
        this.#dirtyChunksHandle?.close();
    }

    willReadChunk(chunk: Uint8Array, chunkIndex: number) {
        if (!this.#dataHandle || !this.#chunksToReadCount) {
            return;
        }
        const chunkByteIndex = chunkIndex >> 3;
        let chunkByte = this.#chunksToRead[chunkByteIndex];
        if (!chunkByte) {
            return;
        }
        const chunkBit = 1 << (chunkIndex & 7);
        if (chunkByte & chunkBit) {
            this.#dataHandle.read(chunk, {
                at: chunkIndex * this.#spec.chunkSize,
            });
            chunkByte &= ~chunkBit;
            this.#chunksToRead[chunkByteIndex] = chunkByte;
            this.#chunksToReadCount--;
        }
    }

    didWriteChunk(chunk: Uint8Array, chunkIndex: number) {
        if (!this.#dataHandle || !this.#dirtyChunksHandle) {
            return;
        }
        const chunkByteIndex = chunkIndex >> 3;
        let chunkByte = this.#dirtyChunks[chunkByteIndex];
        const chunkBit = 1 << (chunkIndex & 7);
        if (!(chunkByte & chunkBit)) {
            chunkByte |= chunkBit;
            this.#dirtyChunks[chunkByteIndex] = chunkByte;
            this.#dirtyChunksHandle.write(
                this.#dirtyChunks.slice(chunkByteIndex, chunkByteIndex + 1),
                {at: chunkByteIndex}
            );
        }
        this.#dataHandle.write(chunk, {
            at: chunkIndex * this.#spec.chunkSize,
        });
    }

    willLoadChunk(chunkIndex: number) {
        this.#delegate.willLoadChunk(chunkIndex);
    }

    didLoadChunk(chunkIndex: number) {
        this.#delegate.didLoadChunk(chunkIndex);
    }

    didFailToLoadChunk(chunkIndex: number, chunkUrl: string, error: string) {
        this.#delegate.didFailToLoadChunk(chunkIndex, chunkUrl, error);
    }
}

export async function initDiskSavers(savers: EmulatorWorkerDiskSaver[]) {
    if (!savers.length) {
        return;
    }
    let opfsRoot;
    try {
        opfsRoot = await navigator.storage.getDirectory();
    } catch (err) {
        console.warn("Could not get origin storage", err);
        return (
            `Could not open open the directory for saved disks (this browser may be missing the necessary APIs). Saved disks will ` +
            `be mounted, but they will be empty and changes to them will not be saved.`
        );
    }
    for (const saver of savers) {
        try {
            await saver.init(opfsRoot);
        } catch (err) {
            console.warn("Could not init disk saver", err);

            const reason = String(err).includes("TypeError")
                ? "this browser may be missing the necessary APIs"
                : "it may be open in another tab";
            return (
                `Could not open saved disk “${saver.name}” (${reason}). ` +
                `It will be mounted, but it will be empty and changes to it will not be saved.`
            );
        }
    }
}
