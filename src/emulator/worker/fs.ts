export function fsPathExists(path: string): boolean {
    try {
        FS.stat(path);
        return true;
    } catch {
        return false;
    }
}
