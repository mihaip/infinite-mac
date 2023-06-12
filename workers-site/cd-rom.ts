export async function handleRequest(request: Request) {
    const url = new URL(request.url);
    const pathPieces = url.pathname.split("/");
    let srcUrl;
    try {
        srcUrl = atob(pathPieces[2]);
    } catch (e) {
        return new Response("Malformed CD-ROM src URL: " + pathPieces[2], {
            status: 400,
            statusText: "Bad Request",
            headers: {"Content-Type": "text/plain"},
        });
    }

    // Don't want to become a proxy for arbitrary URLs
    const srcUrlParsed = new URL(srcUrl);
    if (
        srcUrlParsed.protocol !== "https:" ||
        srcUrlParsed.host !== "archive.org"
    ) {
        return new Response("Unexpected CD-ROM src URL: " + srcUrl, {
            status: 400,
            headers: {"Content-Type": "text/plain"},
        });
    }

    const chunkMatch = /(\d+)-(\d+).chunk$/.exec(pathPieces[3]);
    if (!chunkMatch) {
        return new Response("Malformed CD-ROM src chunk: " + pathPieces[3], {
            status: 400,
            headers: {"Content-Type": "text/plain"},
        });
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
                    "Content-Length": contentLength,
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
    return new Response("CD-ROM fetch failed: " + chunkFetchError, {
        status: 500,
        headers: {"Content-Type": "text/plain"},
    });
}

async function fetchChunk(
    srcUrl: string,
    chunkStart: number,
    chunkEnd: number
) {
    const srcRes = await fetch(srcUrl, {
        headers: {
            "User-Agent": "Infinite Mac (+https://infinitemac.org)",
            "Range": `bytes=${chunkStart}-${chunkEnd}`,
        },
    });

    if (!srcRes.ok) {
        throw new Error(
            "Error response: " + srcRes.status + "/" + srcRes.statusText
        );
    }

    const srcBody = await srcRes.arrayBuffer();
    return {
        chunk: srcBody,
        contentLength: srcRes.headers.get("Content-Length")!,
    };
}
