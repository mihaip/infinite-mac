import {getAssetFromKV} from "@cloudflare/kv-asset-handler";
// @ts-expect-error
import manifestJSON from "__STATIC_CONTENT_MANIFEST";
const manifest = JSON.parse(manifestJSON);

type Env = {
    __STATIC_CONTENT: string;
    ETHERNET_ZONE: DurableObjectNamespace;
};
const handler: ExportedHandler<Env> = {fetch: handleRequest};

export default handler;
export {EthernetZone} from "./ethernet-zone";

async function handleRequest(
    request: Request,
    env: Env,
    ctx: ExecutionContext
) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1).split("/");
    if (path[0] === "zone") {
        const zoneName = path[1];
        const zoneId = env.ETHERNET_ZONE.idFromName(zoneName);
        const zone = env.ETHERNET_ZONE.get(zoneId);
        const zoneUrl = new URL(request.url);
        zoneUrl.pathname = "/" + path.slice(2).join("/");
        return zone.fetch(zoneUrl.toString(), request);
    }

    const fetchEvent = {
        request,
        waitUntil(promise: Promise<any>) {
            return ctx.waitUntil(promise);
        },
    };

    try {
        const page = await getAssetFromKV(fetchEvent, {
            mapRequestToAsset,
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: manifest,
        });
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
        try {
            const notFoundResponse = await getAssetFromKV(fetchEvent, {
                mapRequestToAsset: req =>
                    new Request(`${new URL(req.url).origin}/404.html`, req),
            });

            return new Response(notFoundResponse.body, {
                ...notFoundResponse,
                status: 404,
            });
        } catch (e) {}

        return new Response(e.message || e.toString(), {status: 500});
    }
}

// Override default mapRequestToAsset to not append index.html to unknown
// MIME types (which is what some of the extensions like .wasmz and .jsz
// end up with).
function mapRequestToAsset(request: Request): Request {
    const parsedUrl = new URL(request.url);
    let pathname = parsedUrl.pathname;

    if (pathname.endsWith("/")) {
        pathname = pathname.concat("index.html");
    }

    parsedUrl.pathname = pathname;
    return new Request(parsedUrl.toString(), request);
}
