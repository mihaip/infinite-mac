import {
    type EmulatorChunkedFileSpec,
    generateChunkUrl,
} from "./emulator-common";
import {type EmulatorWorkerDisk} from "./emulator-worker-disks";

export type EmulatorWorkerChunkedDiskDelegate = {
    willReadChunk?: (
        chunk: Uint8Array,
        chunkIndex: number,
        offset: number,
        length: number
    ) => void;
    didWriteChunk?: (
        chunk: Uint8Array,
        chunkIndex: number,
        offset: number,
        length: number
    ) => void;

    willLoadChunk: (chunkIndex: number) => void;
    didLoadChunk: (chunkIndex: number) => void;
    didFailToLoadChunk: (
        chunkIndex: number,
        chunkUrl: string,
        error: string
    ) => void;
};

export class EmulatorWorkerChunkedDisk implements EmulatorWorkerDisk {
    #spec: EmulatorChunkedFileSpec;
    #delegate: EmulatorWorkerChunkedDiskDelegate;
    #loadedChunks = new Map<number, Uint8Array>();

    constructor(
        spec: EmulatorChunkedFileSpec,
        delegate: EmulatorWorkerChunkedDiskDelegate
    ) {
        this.#spec = spec;
        this.#delegate = delegate;
    }

    get name(): string {
        return this.#spec.name;
    }

    get size(): number {
        return this.#spec.totalSize;
    }

    read(buffer: Uint8Array, offset: number, length: number): number {
        let readSize = 0;
        this.#forEachChunkInRange(
            offset,
            length,
            (chunk, chunkStart, chunkEnd, chunkIndex) => {
                const chunkOffset = offset - chunkStart;
                const chunkLength = Math.min(chunkEnd - offset, length);
                this.#delegate.willReadChunk?.(
                    chunk,
                    chunkIndex,
                    chunkOffset,
                    chunkLength
                );
                buffer.set(
                    chunk.subarray(chunkOffset, chunkOffset + chunkLength),
                    readSize
                );
                offset += chunkLength;
                length -= chunkLength;
                readSize += chunkLength;
            }
        );
        return readSize;
    }

    write(buffer: Uint8Array, offset: number, length: number): number {
        let writeSize = 0;
        this.#forEachChunkInRange(
            offset,
            length,
            (chunk, chunkStart, chunkEnd, chunkIndex) => {
                const chunkOffset = offset - chunkStart;
                const chunkLength = Math.min(chunkEnd - offset, length);
                chunk.set(
                    buffer.subarray(writeSize, writeSize + chunkLength),
                    chunkOffset
                );
                this.#delegate.didWriteChunk?.(
                    chunk,
                    chunkIndex,
                    chunkOffset,
                    chunkLength
                );
                offset += chunkLength;
                length -= chunkLength;
                writeSize += chunkLength;
            }
        );
        return writeSize;
    }

    #forEachChunkInRange(
        offset: number,
        length: number,
        callback: (
            chunk: Uint8Array,
            chunkStart: number,
            chunkEnd: number,
            chunkIndex: number
        ) => void
    ) {
        const {chunkSize} = this.#spec;
        const startChunk = Math.floor(offset / chunkSize);
        const endChunk = Math.floor((offset + length - 1) / chunkSize);
        for (
            let chunkIndex = startChunk;
            chunkIndex <= endChunk;
            chunkIndex++
        ) {
            let chunk = this.#loadedChunks.get(chunkIndex);
            if (!chunk) {
                chunk = this.#loadChunk(chunkIndex);
                this.#loadedChunks.set(chunkIndex, chunk);
            }
            if (!this.#loadedChunks.has(chunkIndex)) {
                this.#loadChunk(chunkIndex);
            }
            callback(
                chunk,
                chunkIndex * chunkSize,
                (chunkIndex + 1) * chunkSize,
                chunkIndex
            );
        }
    }

    protected doChunkRequest(
        spec: EmulatorChunkedFileSpec,
        chunkIndex: number
    ): {chunk: Uint8Array} | {error: string; chunkUrl: string} {
        const chunkUrl = generateChunkUrl(spec, chunkIndex);
        const xhr = new XMLHttpRequest();
        xhr.responseType = "arraybuffer";
        xhr.open("GET", chunkUrl, false);
        try {
            xhr.send();
        } catch (e) {
            return {error: `Error: ${e}`, chunkUrl};
        }
        if (xhr.status !== 200) {
            return {
                error: `HTTP status ${xhr.status}: (${xhr.statusText}`,
                chunkUrl,
            };
        }
        const chunk = new Uint8Array(xhr.response as ArrayBuffer);
        return {chunk};
    }

    #loadChunk(chunkIndex: number): Uint8Array {
        // Allow additional chunks to be created past the end (the disk image
        // may be truncated, and empty space at the end is omitted).
        const {chunkSize} = this.#spec;
        const chunkStart = chunkIndex * chunkSize;
        // Entirely out of bounds chunk, just synthesize an empty one.
        if (chunkStart >= this.size) {
            return new Uint8Array(chunkSize);
        }
        const chunkSignature = this.#spec.chunks[chunkIndex];
        if (!chunkSignature) {
            // Zero-ed out chunk, synthesize an empty one.
            return new Uint8Array(chunkSize);
        }
        this.#delegate.willLoadChunk(chunkIndex);
        const result = this.doChunkRequest(this.#spec, chunkIndex);
        this.#delegate.didLoadChunk(chunkIndex);
        if ("error" in result) {
            this.#delegate.didFailToLoadChunk(
                chunkIndex,
                result.chunkUrl,
                result.error
            );
            return new Uint8Array(chunkSize);
        }
        let {chunk} = result;
        // Chunk was on the boundary of a truncated image, pad it out to the
        // full chunk size.
        if (chunk.length < chunkSize) {
            const newChunk = new Uint8Array(chunkSize);
            newChunk.set(chunk);
            chunk = newChunk;
        }
        return chunk;
    }

    validate(): void {
        const spec = this.#spec;
        const prefetchedChunks = new Set(spec.prefetchChunks);
        const needsPrefetch = [];
        const extraPrefetch = [];
        for (const chunk of this.#loadedChunks.keys()) {
            if (!prefetchedChunks.has(chunk)) {
                needsPrefetch.push(chunk);
            }
        }
        for (const chunk of prefetchedChunks) {
            if (!this.#loadedChunks.has(chunk)) {
                extraPrefetch.push(chunk);
            }
        }
        const numberCompare = (a: number, b: number): number => a - b;
        if (extraPrefetch.length || needsPrefetch.length) {
            const prefix = `Chunked file "${spec.name}" (mounted at "${spec.baseUrl}")`;
            if (extraPrefetch.length) {
                console.warn(
                    `${prefix} had unnecessary chunks prefetched:`,
                    extraPrefetch.sort(numberCompare)
                );
            }
            if (needsPrefetch.length) {
                console.warn(
                    `${prefix} needs more chunks prefetched:`,
                    needsPrefetch.sort(numberCompare)
                );
            }
            console.warn(
                `${prefix} complete set of ideal prefetch chunks: ${JSON.stringify(
                    Array.from(this.#loadedChunks.keys()).sort(numberCompare)
                )}`
            );
        }
    }
}
