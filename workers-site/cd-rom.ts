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

    let srcRes;
    try {
        srcRes = await fetch(srcUrl, {
            headers: {
                "User-Agent": "Infinite Mac (+https://infinitemac.org)",
                "Range": `bytes=${chunkStart}-${chunkEnd}`,
            },
        });
    } catch (e) {
        console.warn("CD-ROM fetch failed", {
            srcUrl,
            chunkStart,
            chunkEnd,
            e,
        });
        return new Response("CD-ROM fetch failed: " + e, {
            status: 500,
            headers: {"Content-Type": "text/plain"},
        });
    }

    if (!srcRes.ok) {
        console.warn("CD-ROM fetch error", {
            srcUrl,
            chunkStart,
            chunkEnd,
            srcRes,
        });
        return new Response(
            "CD-ROM fetch failed: " + srcRes.status + "/" + srcRes.statusText,
            {
                status: 500,
                headers: {"Content-Type": "text/plain"},
            }
        );
    }

    let srcBody;
    try {
        srcBody = await srcRes.arrayBuffer();
    } catch (e) {
        console.warn("CD-ROM body fetch failed", {
            srcUrl,
            chunkStart,
            chunkEnd,
            e,
        });
        return new Response("CD-ROM body fetch failed: " + e, {
            status: 500,
            headers: {"Content-Type": "text/plain"},
        });
    }

    return new Response(srcBody, {
        status: 200,
        headers: {
            "Content-Type": "multipart/mixed",
            "Content-Length": srcRes.headers.get("Content-Length")!,
            // Always allow caching (mirrors logic for our own disk chunks).
            "Cache-Control": `public, max-age=${60 * 60 * 24 * 30}, immutable`,
        },
    });
}
