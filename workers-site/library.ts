import {isValidSrcUrl} from "./cd-rom";

export async function handleRequest(request: Request) {
    if (request.method !== "GET") {
        return errorResponse("Method not allowed", 405);
    }
    const url = new URL(request.url);
    const path = url.pathname.split("/").slice(2).join("/");
    switch (path) {
        case "proxy":
            return await handleProxy(url);
        default:
            return errorResponse("Unknown library path", 404);
    }
}

async function handleProxy(url: URL) {
    const srcUrl = url.searchParams.get("url");
    if (!srcUrl) {
        return errorResponse("url parameter is required");
    }
    if (!isValidSrcUrl(srcUrl)) {
        return errorResponse("Unexpected Library src URL: " + srcUrl);
    }
    return fetch(srcUrl, {
        headers: {
            "User-Agent": "Infinite Mac (+https://infinitemac.org)",
        },
        cf: {
            cacheEverything: true,
            cacheTtl: 30 * 24 * 60 * 60,
        },
    });
}

function errorResponse(message: string, status: number = 400): Response {
    return new Response(message, {
        status,
        statusText: message,
        headers: {"Content-Type": "text/plain"},
    });
}
