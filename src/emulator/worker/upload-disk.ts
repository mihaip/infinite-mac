import {
    type EmulatorChunkedFileSpec,
    type EmulatorFileUpload,
} from "@/emulator/common/common";
import {
    EmulatorWorkerChunkedDisk,
    type EmulatorWorkerChunkedDiskDelegate,
} from "@/emulator/worker/chunked-disk";
import {getUploadData} from "@/emulator/worker/files";

export class EmulatorWorkerUploadDisk extends EmulatorWorkerChunkedDisk {
    #upload: EmulatorFileUpload;

    constructor(
        upload: EmulatorFileUpload,
        delegate: EmulatorWorkerChunkedDiskDelegate
    ) {
        super(generateUploadChunkedSpec(upload), delegate);
        this.#upload = upload;
    }

    protected override doChunkRequest(
        spec: EmulatorChunkedFileSpec,
        chunkIndex: number
    ): {chunk: Uint8Array} | {error: string; chunkUrl: string} {
        const range = getUploadChunkRange(spec, chunkIndex);
        try {
            const chunk = getUploadData(this.#upload, range);
            return {chunk};
        } catch (e) {
            return {
                error: `Error: ${e}`,
                chunkUrl: `upload-${spec.name}-chunk-${range.join("-")}`,
            };
        }
    }
}

function generateUploadChunkedSpec(
    upload: EmulatorFileUpload
): EmulatorChunkedFileSpec {
    const totalSize = upload.size;
    // Firefox does not support XHR range requests on File/Blob URLs, so we can't chunk things there.
    const chunkSize = navigator.userAgent.includes("Firefox")
        ? totalSize
        : 128 * 1024;
    let chunkStart = 0;
    const chunks: string[] = [];

    while (chunkStart < upload.size) {
        const chunkEnd = Math.min(chunkStart + chunkSize, upload.size);
        chunks.push(`${chunkStart}-${chunkEnd}`);
        chunkStart = chunkEnd;
    }
    return {
        name: upload.name,
        baseUrl: `/Upload-Disk/${upload.name}`,
        totalSize,
        chunks,
        chunkSize,
        prefetchChunks: [0],
    };
}

function getUploadChunkRange(
    spec: EmulatorChunkedFileSpec,
    chunkIndex: number
): [start: number, end: number] {
    const [startStr, endStr] = spec.chunks[chunkIndex].split("-");
    return [parseInt(startStr, 10), parseInt(endStr, 10)];
}
