export function createLazyFile(
    parent: string | FS.FSNode,
    name: string,
    url: string,
    canRead: boolean,
    canWrite: boolean
): FS.FSNode {
    return FS.createLazyFile(parent, name, url, canRead, canWrite);
}
