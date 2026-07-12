import {type EmulatorCDROM} from "@/emulator/common/common";
import allowedDomains from "@/defs/cdrom-sites.json";

type CDROMSpec = {
    srcUrl: string;
    totalSize?: number;
};

export async function handleRequest(request: Request, bucket: R2Bucket) {
    const url = new URL(request.url);
    const path = url.pathname;
    const pathPieces = path.split("/");
    let specStr;
    try {
        specStr = atob(pathPieces[2]);
    } catch (e) {
        return errorResponse("Malformed CD-ROM spec: " + pathPieces[2]);
    }

    let spec: CDROMSpec;
    if (specStr.startsWith("{")) {
        try {
            spec = JSON.parse(specStr);
        } catch (e) {
            return errorResponse("Malformed CD-ROM spec: " + specStr);
        }
    } else {
        // Simple spec, just a URL.
        spec = {srcUrl: specStr};
    }

    if (!isValidSrcUrl(spec.srcUrl)) {
        return errorResponse("Unexpected CD-ROM src URL: " + spec.srcUrl);
    }

    if (request.method === "GET") {
        return await handleGET(pathPieces, spec, bucket, url);
    }
    if (request.method === "PUT") {
        return await handlePUT(spec.srcUrl);
    }

    return errorResponse("Method not allowed", 405);
}

// Don't want to become a proxy for arbitrary URLs
export function isValidSrcUrl(srcUrl: string) {
    if (isR2MediaSrcUrl(srcUrl)) {
        return true;
    }
    let srcUrlParsed;
    try {
        srcUrlParsed = new URL(srcUrl);
    } catch (e) {
        return false;
    }
    const {protocol: srcProtocol, host: srcHost} = srcUrlParsed;
    if (srcProtocol !== "https:") {
        return false;
    }
    for (const allowedDomain of allowedDomains) {
        if (
            srcHost === allowedDomain ||
            srcHost.endsWith("." + allowedDomain)
        ) {
            return true;
        }
    }
    return false;
}

async function handleGET(
    pathPieces: string[],
    spec: CDROMSpec,
    bucket: R2Bucket,
    requestUrl: URL
) {
    const chunkMatch = /(\d+)-(\d+).chunk$/.exec(pathPieces[3]);
    if (!chunkMatch) {
        return errorResponse("Malformed CD-ROM src chunk: " + pathPieces[3]);
    }

    const chunkStart = parseInt(chunkMatch[1]);
    const chunkEnd = parseInt(chunkMatch[2]);

    let chunkFetchError;
    for (let retry = 0; retry < 3; retry++) {
        try {
            const {chunk, contentLength} = isR2MediaSrcUrl(spec.srcUrl)
                ? await fetchMediaChunk(
                      spec,
                      chunkStart,
                      chunkEnd,
                      bucket,
                      requestUrl
                  )
                : await fetchChunk(spec, chunkStart, chunkEnd);
            return new Response(chunk, {
                status: 200,
                headers: {
                    "Content-Type": "multipart/mixed",
                    "Content-Length": String(contentLength),
                    // Always allow caching (mirrors logic for our own disk chunks).
                    "Cache-Control": `public, max-age=${
                        60 * 60 * 24 * 30
                    }, immutable`,
                },
            });
        } catch (e) {
            chunkFetchError = e;
        }
    }

    console.warn("CD-ROM fetch failed", {
        ...spec,
        chunkStart,
        chunkEnd,
        chunkFetchError,
    });
    return errorResponse("CD-ROM fetch failed: " + chunkFetchError, 500);
}

/**
 * Generates a CD-ROM manifest from a source URL on the fly, equivalent to what
 * get_output_manifest from import-cd-roms.py does.
 */
async function handlePUT(srcUrl: string) {
    if (isR2MediaSrcUrl(srcUrl)) {
        return errorResponse("R2 media URLs are internal");
    }
    const response = await fetch(srcUrl, {
        method: "HEAD",
        headers: {
            "User-Agent": "Infinite Mac (+https://infinitemac.org)",
        },
    });
    if (!response.ok) {
        return errorResponse(
            `CD-ROM HEAD request failed: ${response.status} (${response.statusText})`
        );
    }
    const contentLength = response.headers.get("Content-Length");
    if (!contentLength) {
        return errorResponse(`CD-ROM HEAD request failed: no Content-Length`);
    }

    const fileSize = parseInt(contentLength);
    if (isNaN(fileSize)) {
        return errorResponse(
            `CD-ROM HEAD request failed: invalid Content-Length (${contentLength})`
        );
    }

    // It would be nice to also check that the Accept-Ranges header contains
    // `bytes`, but it seems to be stripped from the response when running in
    // a Cloudflare Worker.

    const cdrom: EmulatorCDROM = {
        // The name is not that important, but try to use the filename from the
        // URL if possible.
        name: new URL(srcUrl).pathname.split("/").pop() ?? "Untitled",
        srcUrl,
        fileSize,
        // Cover images are not shown for on-demand CD-ROMs, so leave them
        // blank.
        coverImageHash: "",
        coverImageSize: [0, 0],
    };
    if (srcUrl.endsWith(".bin")) {
        cdrom.mode = "MODE1/2352";
    }
    if (srcUrl.endsWith(".dsk")) {
        cdrom.mountReadWrite = true;
    }
    return new Response(JSON.stringify(cdrom), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
        },
    });
}

async function fetchChunk(
    spec: CDROMSpec,
    chunkStart: number,
    chunkEnd: number
): Promise<{chunk: ArrayBuffer; contentLength: number}> {
    // Don't allow Cloudflare to cache requests in large files, since it will attempt
    // to read the entire file (as opposed to just the range that we requested).
    const isLargeFile =
        spec.totalSize !== undefined && spec.totalSize > 250 * 1024 * 1024;
    const cacheOptions: Partial<RequestInit<RequestInitCfProperties>> =
        isLargeFile
            ? {cache: "no-store"}
            : {
                  cf: {
                      cacheEverything: true,
                      cacheTtl: 30 * 24 * 60 * 60,
                  },
              };
    const srcRes = await fetch(spec.srcUrl, {
        headers: {
            "User-Agent": "Infinite Mac (+https://infinitemac.org)",
            "Range": `bytes=${chunkStart}-${chunkEnd}`,
        },
        ...cacheOptions,
        signal: AbortSignal.timeout(2000),
    });

    if (!srcRes.ok) {
        throw new Error(
            "Error response: " + srcRes.status + "/" + srcRes.statusText
        );
    }

    const srcBody = await srcRes.arrayBuffer();
    return {
        chunk: srcBody,
        contentLength: srcBody.byteLength,
    };
}

async function fetchMediaChunk(
    spec: CDROMSpec,
    chunkStart: number,
    chunkEnd: number,
    bucket: R2Bucket,
    requestUrl: URL
) {
    if (!bucket) {
        if (import.meta.env.DEV) {
            return fetchLocalMediaChunk(spec, chunkStart, chunkEnd, requestUrl);
        }
        throw new Error("Bucket not configured");
    }
    return fetchR2MediaChunk(spec, chunkStart, chunkEnd, bucket);
}

async function fetchR2MediaChunk(
    spec: CDROMSpec,
    chunkStart: number,
    chunkEnd: number,
    bucket: R2Bucket
) {
    const object = await bucket.get(r2MediaKey(spec), {
        range: {
            offset: chunkStart,
            length: chunkEnd - chunkStart,
        },
    });
    if (object === null) {
        throw new Error("R2 media object not found");
    }
    if (!("body" in object)) {
        throw new Error("R2 media object has no body");
    }
    const chunk = await object.arrayBuffer();
    return {
        chunk,
        contentLength: chunk.byteLength,
    };
}

async function fetchLocalMediaChunk(
    spec: CDROMSpec,
    chunkStart: number,
    chunkEnd: number,
    requestUrl: URL
) {
    // Locally we don't have a R2 bucket configured, serve files directly
    // from the build directory (where import-cd-roms.py puts them).
    const mediaUrl = new URL(`/CD-ROMs/build/${r2MediaKey(spec)}`, requestUrl);
    const response = await fetch(mediaUrl, {
        headers: {Range: `bytes=${chunkStart}-${chunkEnd - 1}`},
    });
    if (!response.ok) {
        throw new Error(
            `Local media fetch failed: ${response.status}/${response.statusText}`
        );
    }
    let chunk = await response.arrayBuffer();
    if (response.status !== 206) {
        chunk = chunk.slice(chunkStart, chunkEnd);
    }
    return {chunk, contentLength: chunk.byteLength};
}

function isR2MediaSrcUrl(srcUrl: string) {
    return /^r2:\/\/media\/[0-9a-f]{64}\.media$/.test(srcUrl);
}

function r2MediaKey(spec: CDROMSpec): string {
    return spec.srcUrl.replace(/^r2:\/\//, "");
}

function errorResponse(message: string, status: number = 400): Response {
    return new Response(message, {
        status,
        statusText: message,
        headers: {"Content-Type": "text/plain"},
    });
}
