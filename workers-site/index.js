import {getAssetFromKV} from "@cloudflare/kv-asset-handler";
import JSZip from "jszip";

/**
 * The DEBUG flag will do two things that help during development:
 * 1. we will skip caching on the edge, which makes it easier to
 *    debug.
 * 2. we will return an error message on exception in your Response rather
 *    than the default 404.html page.
 */
const DEBUG = false;

addEventListener("fetch", event => {
    try {
        event.respondWith(handleEvent(event));
    } catch (e) {
        if (DEBUG) {
            return event.respondWith(
                new Response(e.message || e.toString(), {
                    status: 500,
                })
            );
        }
        event.respondWith(new Response("Internal Error", {status: 500}));
    }
});

async function handleEvent(event) {
    const url = new URL(event.request.url);
    const options = {};

    try {
        if (DEBUG) {
            // customize caching
            options.cacheControl = {
                bypassCache: true,
            };
        }
        const page = await getAssetFromKV(event, options);

        let response;

        // Serve individual files from library .zip archives.
        if (
            url.pathname.startsWith("/Library") &&
            url.pathname.endsWith(".zip") &&
            url.searchParams.get("item")
        ) {
            const item = url.searchParams.get("item");
            const data = await page.arrayBuffer();
            const zip = await JSZip.loadAsync(data);
            const file = zip.file(item.substring(1));
            if (file) {
                const body = await file.async("arraybuffer");
                response = new Response(body, {status: 200});
                response.headers.set(
                    "Content-Type",
                    "application/octet-stream"
                );
            } else {
                response = new Response(`Could not find ${item}`, {
                    status: 404,
                });
                response.headers.set("Content-Type", "text/plain");
            }
            response.headers.set("X-Content-Type-Options", "nosniff");
        } else {
            response = new Response(page.body, page);
        }

        // Make sure that pre-gzipped static content is passed through (see
        // https://stackoverflow.com/a/64849685/343108)
        if (url.pathname.endsWith(".gz")) {
            response = new Response(response.body, {
                status: response.status,
                headers: response.headers,
                encodeBody: "manual",
            });

            response.headers.set("Content-Encoding", "gzip");
            // Ensure that the final response is still compressed when sent to
            // the browser, compressible MIME types are listed at
            // https://support.cloudflare.com/hc/en-us/articles/200168396-What-will-Cloudflare-compress-
            response.headers.set("Content-Type", "multipart/bag");
        }

        // Mirror MIME type overriding done by setupProxy.js
        if (url.pathname.endsWith(".jsz")) {
            response.headers.set("Content-Type", "text/javascript");
        } else if (url.pathname.endsWith(".jsz")) {
            response.headers.set("Content-Type", "application/wasm");
        }

        response.headers.set("X-XSS-Protection", "1; mode=block");
        response.headers.set("X-Content-Type-Options", "nosniff");
        response.headers.set("X-Frame-Options", "DENY");
        response.headers.set("Referrer-Policy", "unsafe-url");
        response.headers.set("Feature-Policy", "none");
        // Allow SharedArrayBuffer to work
        response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
        response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");

        // Static content uses a content hash in the URL, so it can be cached
        // for a while (30 days).
        if (
            url.pathname.startsWith("/static") ||
            url.pathname.startsWith("/Library")
        ) {
            response.headers.set(
                "Cache-Control",
                `max-age=${60 * 60 * 24 * 30}`
            );
        }

        return response;
    } catch (e) {
        // if an error is thrown try to serve the asset at 404.html
        if (!DEBUG) {
            try {
                const notFoundResponse = await getAssetFromKV(event, {
                    mapRequestToAsset: req =>
                        new Request(`${new URL(req.url).origin}/404.html`, req),
                });

                return new Response(notFoundResponse.body, {
                    ...notFoundResponse,
                    status: 404,
                });
            } catch (e) {}
        }

        return new Response(e.message || e.toString(), {status: 500});
    }
}
