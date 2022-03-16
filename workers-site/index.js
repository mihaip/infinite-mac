import {getAssetFromKV} from "@cloudflare/kv-asset-handler";

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
        const response = new Response(page.body, page);
        const {pathname} = url;

        // Force a MIME type from the list at
        // https://support.cloudflare.com/hc/en-us/articles/200168396 to ensure
        // that the ROM and chunks get compressed.
        if (pathname.endsWith(".rom") || pathname.endsWith(".chunk")) {
            response.headers.set("Content-Type", "multipart/mixed");
        }

        // Mirror MIME type overriding done by setupProxy.js
        if (pathname.endsWith(".jsz")) {
            response.headers.set("Content-Type", "text/javascript");
        } else if (pathname.endsWith(".wasmz")) {
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
            pathname.startsWith("/static") ||
            (pathname.startsWith("/Disk") && pathname.endsWith(".chunk"))
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
