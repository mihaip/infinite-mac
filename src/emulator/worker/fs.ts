export function fsPathExists(path: string): boolean {
    try {
        FS.stat(path);
        return true;
    } catch {
        return false;
    }
}

export function readBinaryFile(path: string): Uint8Array<ArrayBuffer> {
    // FS.readFile allocates a new Uint8Array, but the upstream declaration
    // defaults to ArrayBufferLike and loses this ownership detail.
    return FS.readFile(path, {encoding: "binary"}) as Uint8Array<ArrayBuffer>;
}
