const macRoman = new TextDecoder("macintosh");

export function pstring(
    data: Uint8Array,
    offset: number,
    maxLength: number
): string {
    const length = data[offset];
    if (
        length === undefined ||
        length > maxLength ||
        offset + 1 + length > data.length
    ) {
        throw new Error(
            `Invalid Pascal string (offset: ${offset}, maxLength: ${maxLength}, got length ${length})`
        );
    }
    return macRoman.decode(data.subarray(offset + 1, offset + 1 + length));
}
