export function createLazyFile(
    parent: string | FS.FSNode,
    name: string,
    url: string,
    size: number,
    canRead: boolean,
    canWrite: boolean
): FS.FSNode {
    const contents = new Uint8Array(size);
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
    const defaultStreamOps = file.stream_ops;
    file.stream_ops = {
        ...defaultStreamOps,
        read(...args: any[]) {
            const xhr = new XMLHttpRequest();
            xhr.responseType = "arraybuffer";
            xhr.open("GET", url, false);
            xhr.send();
            const data = new Uint8Array(xhr.response as ArrayBuffer);
            if (data.byteLength !== size) {
                console.warn(
                    `Lazy file from URL ${url} was expected to have size ` +
                        `${size} but instead had ${data.byteLength}`
                );
            }
            contents.set(data);
            // Ideally we'd just reset the stream_ops for the file to the
            // default, but any already-opened streams have saved a copy to
            // our modified ones, so we also need to restore the version of
            // read in our modified copy.
            file.stream_ops.read = defaultStreamOps.read;
            file.stream_ops = defaultStreamOps;
            return defaultStreamOps.read.apply(this, args);
        },
    };

    return file;
}
