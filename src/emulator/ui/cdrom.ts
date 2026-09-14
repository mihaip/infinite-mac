import {fetchWithProgress} from "@/lib/fetch";
import {type EmulatorCDROM} from "@/emulator/common/common";

export async function fetchCDROM(
    cdrom: EmulatorCDROM,
    onProgress: (fraction: number) => void
): Promise<EmulatorCDROM> {
    // HEAD may report the compressed size, while fetch delivers decoded bytes.
    // Keep progress below completion until the full download has finished.
    const blob = await fetchWithProgress(cdrom.srcUrl, loaded =>
        onProgress(Math.min(loaded / cdrom.fileSize, 0.99))
    );
    onProgress(1);
    const blobURL = URL.createObjectURL(blob);
    return {
        ...cdrom,
        srcUrl: blobURL,
        fileSize: blob.size,
    };
}

export async function probeCORSRangeSupport(
    cdrom: EmulatorCDROM
): Promise<boolean> {
    // Probe in the browser: a HEAD response does not guarantee that range
    // GETs allow CORS. A single range requires no preflight, and we do
    // not require servers to expose Content-Range or Accept-Ranges.
    // Use a realistic chunk size: a one-byte probe can succeed even when
    // the server ranges over compressed bytes that the browser decodes.
    const probeSize = Math.min(128 * 1024, cdrom.fileSize);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(cdrom.srcUrl, {
            mode: "cors",
            credentials: "omit",
            // Do not cache the probe as a partial representation of the
            // image (some HTTP caches reuse it for later range requests).
            cache: "no-store",
            headers: {Range: `bytes=0-${probeSize - 1}`},
            signal: controller.signal,
        });
        if (
            response.status === 206 &&
            (await response.arrayBuffer()).byteLength === probeSize
        ) {
            return true;
        }
    } catch {
        // Some hosts allow ordinary GETs but reject range requests.
    } finally {
        // Stop a server that ignored Range from downloading the image
        // while the fallback starts a normal GET with progress reporting.
        controller.abort();
        clearTimeout(timeout);
    }
    return false;
}
