import {getAssetFromKV} from "@cloudflare/kv-asset-handler";

/**
 * The DEBUG flag will do two things that help during development:
 * 1. we will skip caching on the edge, which makes it easier to
 *    debug.
 * 2. we will return an error message on exception in your Response rather
 *    than the default 404.html page.
 */
const DEBUG = false;

// Large files are served directly from the Git repo, since Worker Sites/the
// KV store has a 25MB size limit.
const GIT_REPO = "https://github.com/mihaip/infinite-mac";

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
        let response;
        if (url.pathname.startsWith("/Library")) {
            // TODO: cache in Cloudflare if GitHub gets mad about serving?
            // Though the response should end up being cached too.
            const gitHubResponse = await fetch(
                `${GIT_REPO}/raw/main/public/${url.pathname}`
            );
            response = new Response(gitHubResponse.body, {
                status: gitHubResponse.status,
                statusText: gitHubResponse.statusText,
                headers: new Headers(gitHubResponse.headers),
            });
        } else {
            const page = await getAssetFromKV(event, options);
            response = new Response(page.body, page);
        }

        // Make sure that pre-compressed static content is passed through (see
        // https://stackoverflow.com/a/64849685/343108)
        if (url.pathname.endsWith(".br")) {
            response = new Response(response.body, {
                status: response.status,
                headers: response.headers,
                encodeBody: "manual",
            });

            response.headers.set("Content-Encoding", "br");
            // Content-type ends up being text/plain by default, switch to a
            // more sensible value.
            response.headers.set("Content-Type", "application/octet-stream");
        }

        // Mirror MIME type overriding done by setupProxy.js
        if (url.pathname.endsWith(".jsz")) {
            response.headers.set("Content-Type", "text/javascript");
        } else if (url.pathname.endsWith(".wasmz")) {
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
            (url.pathname.startsWith("/Library") &&
                url.searchParams.has("v")) ||
            (url.pathname.startsWith("/Disk") && url.searchParams.has("v"))
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
