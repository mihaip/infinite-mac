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

    const defaultStreamOps = file.stream_ops;
    file.stream_ops = {
        ...defaultStreamOps,
        read(
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

            buffer.set(contents.slice(position, position + readSize), offset);
            return readSize;
        },
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
    if (extraPrefetch.length) {
        console.warn(
            `Chunked file ${spec.baseUrl} had unncessary chunks prefetched:`,
            extraPrefetch
        );
    }
    if (needsPrefetch.length) {
        console.warn(
            `Chunked file ${spec.baseUrl} had needs more chunks prefetched:`,
            needsPrefetch
        );
    }
}

const loadedChunksBySpec = new Map<EmulatorChunkedFileSpec, Set<number>>();
