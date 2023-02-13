import type {EmulatorChunkedFileSpec} from "./emulator-common";
import {generateChunkUrl} from "./emulator-common";

export function createChunkedFile(
    parent: string | FS.FSNode,
    name: string,
    spec: EmulatorChunkedFileSpec,
    canRead: boolean,
    canWrite: boolean
): FS.FSNode {
    const contents = new Uint8Array(spec.totalSize);
    const file = FS.createDataFile(
        parent,
        name,
        contents,
        canRead,
        canWrite,
        // Set canOwn so that MEMFS uses `contents` directly, and we can mutate
        // it later when loading the contents on demand.
        true
    );

    const {chunkSize} = spec;
    const loadedChunks = new Set<number>();
    loadedChunksBySpec.set(spec, loadedChunks);

    function loadChunk(chunkIndex: number) {
        const chunkUrl = generateChunkUrl(spec, chunkIndex);
        const xhr = new XMLHttpRequest();
        xhr.responseType = "arraybuffer";
        xhr.open("GET", chunkUrl, false);
        xhr.send();
        const data = new Uint8Array(xhr.response as ArrayBuffer);
        contents.set(data, chunkIndex * chunkSize);
    }

    function ensureChunksAreLoaded(position: number, length: number): number {
        const readSize = Math.min(contents.length - position, length);

        const startChunk = Math.floor(position / chunkSize);
        const endChunk = Math.floor((position + readSize - 1) / chunkSize);
        for (
            let chunkIndex = startChunk;
            chunkIndex <= endChunk;
            chunkIndex++
        ) {
            if (!loadedChunks.has(chunkIndex)) {
                loadChunk(chunkIndex);
                loadedChunks.add(chunkIndex);
            }
        }
        return readSize;
    }

    const defaultStreamOps = file.stream_ops;
    function read(
        this: typeof defaultStreamOps,
        stream: FS.FSStream,
        buffer: Uint8Array,
        offset: number,
        length: number,
        position: number
    ) {
        if (position >= contents.length) {
            return 0;
        }
        if (stream.node.contents.buffer !== contents.buffer) {
            // If Emscripten somehow changes the contents out from under us,
            // we should go back to normal reading.
            return defaultStreamOps.read.call(
                this,
                stream,
                buffer,
                offset,
                length,
                position
            );
        }

        const readSize = ensureChunksAreLoaded(position, length);

        buffer.set(contents.slice(position, position + readSize), offset);
        return readSize;
    }
    function write(
        this: typeof defaultStreamOps,
        stream: FS.FSStream,
        buffer: Uint8Array,
        offset: number,
        length: number,
        position: number,
        canOwn?: boolean
    ) {
        // If we get a write before a read, ensure that the backing contents
        // are populated and we don't try to load chunks later (overwriting
        // the writes).
        ensureChunksAreLoaded(position, length);

        return defaultStreamOps.write.call(
            this,
            stream,
            buffer,
            offset,
            length,
            position,
            canOwn
        );
    }

    file.stream_ops = {
        ...defaultStreamOps,
        read,
        write,
    };

    return file;
}

export function validateSpecPrefetchChunks(spec: EmulatorChunkedFileSpec) {
    const loadedChunks = loadedChunksBySpec.get(spec);
    if (!loadedChunks) {
        console.warn(
            `Chunked file ${spec.baseUrl} never had any chunks loaded`
        );
        return;
    }
    const prefetchedChunks = new Set(spec.prefetchChunks);
    const needsPrefetch = [];
    const extraPrefetch = [];
    for (const chunk of loadedChunks) {
        if (!prefetchedChunks.has(chunk)) {
            needsPrefetch.push(chunk);
        }
    }
    for (const chunk of prefetchedChunks) {
        if (!loadedChunks.has(chunk)) {
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
                Array.from(loadedChunks).sort(numberCompare)
            )}`
        );
    }
}

const loadedChunksBySpec = new Map<EmulatorChunkedFileSpec, Set<number>>();
