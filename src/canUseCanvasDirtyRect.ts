/**
 * Chrome on Windows, Android and Chrome OS appears to be buggy when using the
 * dirty rect option of putImageData. This function returns true if we can use
 * it.
 * https://github.com/mihaip/infinite-mac/issues/95
 */
export function canUseCanvasDirtyRect(): boolean {
    if (cached !== undefined) {
        return cached;
    }

    cached = check();
    return cached;
}

function check(): boolean {
    // Ideally we'd test for this bug via putImageData and getImageData, but
    // the read back pixels are OK (at least in simple test cases).
    const {userAgent} = navigator;
    if (!userAgent.includes("Chrome")) {
        return true;
    }
    return (
        !userAgent.includes("Android") &&
        !userAgent.includes("CrOS") &&
        !userAgent.includes("Windows")
    );
}

let cached: boolean | undefined;
