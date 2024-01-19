import {type EmulatorCDROM} from "../src/emulator/emulator-common";

export async function handleRequest(path: string, method: string) {
    const pathPieces = path.split("/");
    let srcUrl;
    try {
        srcUrl = atob(pathPieces[2]);
    } catch (e) {
        return errorResponse("Malformed CD-ROM src URL: " + pathPieces[2]);
    }

    if (!isValidSrcUrl(srcUrl)) {
        return errorResponse("Unexpected CD-ROM src URL: " + srcUrl);
    }

    if (method === "GET") {
        return await handleGET(pathPieces, srcUrl);
    }
    if (method === "PUT") {
        return await handlePUT(srcUrl);
    }

    return errorResponse("Method not allowed", 405);
}

// Don't want to become a proxy for arbitrary URLs
function isValidSrcUrl(srcUrl: string) {
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
    const allowedDomains = [
        "macintoshgarden.org",
        "archive.org",
        "img.classicmacdemos.com",
        "macintoshrepository.org",
        "fsck.technology",
        "nextcomputers.org",
    ];
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

async function handleGET(pathPieces: string[], srcUrl: string) {
    const chunkMatch = /(\d+)-(\d+).chunk$/.exec(pathPieces[3]);
    if (!chunkMatch) {
        return errorResponse("Malformed CD-ROM src chunk: " + pathPieces[3]);
    }

    const chunkStart = parseInt(chunkMatch[1]);
    const chunkEnd = parseInt(chunkMatch[2]);

    let chunkFetchError;
    for (let retry = 0; retry < 3; retry++) {
        try {
            const {chunk, contentLength} = await fetchChunk(
                srcUrl,
                chunkStart,
                chunkEnd
            );
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
        srcUrl,
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
    return new Response(JSON.stringify(cdrom), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
        },
    });
}

async function fetchChunk(
    srcUrl: string,
    chunkStart: number,
    chunkEnd: number
) {
    const parsedSrcUrl = new URL(srcUrl);
    let mode: EmulatorCDROM["mode"];
    if (parsedSrcUrl.hash) {
        mode = parsedSrcUrl.hash.slice(1) as EmulatorCDROM["mode"];
        parsedSrcUrl.hash = "";
        srcUrl = parsedSrcUrl.toString();
        switch (mode) {
            case "MODE1/2352":
                chunkStart = (chunkStart / 2048) * 2352;
                chunkEnd = (chunkEnd / 2048) * 2352;
                break;
            default:
                throw new Error("Invalid CD-ROM mode: " + mode);
        }
    }
    const srcRes = await fetch(srcUrl, {
        headers: {
            "User-Agent": "Infinite Mac (+https://infinitemac.org)",
            "Range": `bytes=${chunkStart}-${chunkEnd}`,
        },
        signal: AbortSignal.timeout(2000),
    });

    if (!srcRes.ok) {
        throw new Error(
            "Error response: " + srcRes.status + "/" + srcRes.statusText
        );
    }

    let srcBody = await srcRes.arrayBuffer();
    switch (mode) {
        case "MODE1/2352": {
            // Get just the data portion of each segment.
            const srcBodyUint8 = new Uint8Array(srcBody);
            const dataBody = new ArrayBuffer(
                (srcBody.byteLength / 2352) * 2048
            );
            const dataBodyUint8 = new Uint8Array(dataBody);
            for (
                let srcOffset = 0, dstOffset = 0;
                srcOffset < srcBody.byteLength;
                srcOffset += 2352, dstOffset += 2048
            ) {
                dataBodyUint8.set(
                    srcBodyUint8.subarray(
                        srcOffset + 12 + 3 + 1,
                        srcOffset + 12 + 3 + 1 + 2048
                    ),
                    dstOffset
                );
            }
            srcBody = dataBody;
            break;
        }
    }
    return {
        chunk: srcBody,
        contentLength: srcBody.byteLength,
    };
}

function errorResponse(message: string, status: number = 400): Response {
    return new Response(message, {
        status,
        statusText: message,
        headers: {"Content-Type": "text/plain"},
    });
}
