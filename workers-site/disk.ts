export async function handleRequest(
    request: Request,
    bucket: R2Bucket,
    ctx: ExecutionContext
) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1).split("/");
    const key = path[1];

    if (!bucket) {
        // Locally we don't have a R2 bucket configured, serve files directly
        // from the build directory (where import-disks.py puts them and
        // sync-disks.sh uploads them to R2from).
        if (import.meta.env.DEV) {
            const chunkUrl = new URL(`/Images/build/${key}`, url);
            return Response.redirect(chunkUrl.toString(), 302);
        }
        return errorResponse("Bucket not configured", 500);
    }
    if (request.method !== "GET") {
        return errorResponse("Method not allowed", 405);
    }

    const cache = caches.default;
    const cacheResponse = await cache.match(request);
    if (cacheResponse) {
        return cacheResponse;
    }

    const object = await bucket.get(key);

    if (object === null) {
        return errorResponse("Chunk not found", 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    // Force a MIME type from the list at
    // https://support.cloudflare.com/hc/en-us/articles/200168396 to ensure
    // that chunks get compressed.
    headers.set("Content-Type", "multipart/mixed");
    // Always allow caching
    headers.set(
        "Cache-Control",
        `public, max-age=${60 * 60 * 24 * 30}, immutable`
    );
    const response = new Response(object.body, {headers});

    ctx.waitUntil(cache.put(request, response.clone()));

    return response;
}

function errorResponse(message: string, status: number = 400): Response {
    return new Response(message, {
        status,
        statusText: message,
        headers: {"Content-Type": "text/plain"},
    });
}
