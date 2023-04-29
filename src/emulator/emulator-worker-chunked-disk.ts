import type {EmulatorChunkedFileSpec} from "./emulator-common";
import {generateChunkUrl} from "./emulator-common";
import type {EmulatorWorkerDisk} from "./emulator-worker-disks";

export class EmulatorWorkerChunkedDisk implements EmulatorWorkerDisk {
    #spec: EmulatorChunkedFileSpec;
    #loadedChunks = new Map<number, Uint8Array>();

    constructor(spec: EmulatorChunkedFileSpec) {
        this.#spec = spec;
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
            (chunk, chunkStart, chunkEnd) => {
                const chunkOffset = offset - chunkStart;
                const chunkLength = Math.min(chunkEnd - offset, length);
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
            (chunk, chunkStart, chunkEnd) => {
                const chunkOffset = offset - chunkStart;
                const chunkLength = Math.min(chunkEnd - offset, length);
                chunk.set(
                    buffer.subarray(writeSize, writeSize + chunkLength),
                    chunkOffset
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
            chunkEnd: number
        ) => void
    ) {
        length = Math.min(this.size - offset, length);
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
                (chunkIndex + 1) * chunkSize
            );
        }
    }

    #loadChunk(chunkIndex: number): Uint8Array {
        const chunkUrl = generateChunkUrl(this.#spec, chunkIndex);
        const xhr = new XMLHttpRequest();
        xhr.responseType = "arraybuffer";
        xhr.open("GET", chunkUrl, false);
        xhr.send();
        if (xhr.status !== 200) {
            postMessage({
                type: "emulator_did_have_error",
                error: `Could not load disk chunk ${chunkUrl}: ${xhr.status} (${xhr.statusText})`,
            });
        }
        return new Uint8Array(xhr.response as ArrayBuffer);
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
                    `${prefix} had unncessary chunks prefetched:`,
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
