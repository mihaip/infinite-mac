export function stringToArrayBuffer(config: string): ArrayBufferLike {
    return new TextEncoder().encode(config).buffer;
}

export function arrayBufferToString(buffer: ArrayBuffer): string {
    return new TextDecoder().decode(buffer);
}

export function replacePlaceholders(
    str: string,
    replacements: {[key: string]: number | string | boolean}
): string {
    for (const [key, value] of Object.entries(replacements)) {
        const replacement =
            typeof value === "boolean"
                ? value
                    ? "TRUE"
                    : "FALSE"
                : value.toString();
        str = str.replaceAll(`{${key}}`, replacement);
    }
    return str;
}
