export function fourCCToString(long: number): string {
    return (
        String.fromCharCode((long >> 24) & 0xff) +
        String.fromCharCode((long >> 16) & 0xff) +
        String.fromCharCode((long >> 8) & 0xff) +
        String.fromCharCode((long >> 0) & 0xff)
    );
}
