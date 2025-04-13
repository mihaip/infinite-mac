import * as varz from "./varz";
import * as cdrom from "./cd-rom";
import * as disk from "./disk";
import * as library from "./library";
import {getAssetFromKV} from "@cloudflare/kv-asset-handler";
// @ts-expect-error TODO: include declaration for this generated module.
import manifestJSON from "__STATIC_CONTENT_MANIFEST";
const manifest = JSON.parse(manifestJSON);

type Env = {
    __STATIC_CONTENT: string;
    ETHERNET_ZONE: DurableObjectNamespace;
    VARZ: KVNamespace;
    DISK_BUCKET: R2Bucket;
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
    if (path[0] === "varz") {
        return varz.handleRequest(request, env.VARZ);
    }
    if (path[0] === "errorz") {
        return varz.handleErrorzRequest(request, env.VARZ);
    }
    if (path[0] === "CD-ROM") {
        return cdrom.handleRequest(url.pathname, request.method);
    }
    if (path[0] === "Library") {
        return library.handleRequest(request);
    }
    if (path[0] === "Disk") {
        return disk.handleRequest(request, env.DISK_BUCKET, ctx);
    }

    const legacyDomainRedirect = getLegacyDomainRedirect(url);
    if (legacyDomainRedirect) {
        return Response.redirect(
            "https://infinitemac.org" + legacyDomainRedirect,
            301
        );
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
            pathIsEncoded: true,
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: manifest,
        });
        const response = new Response(page.body, page);
        const {pathname} = url;

        // Force a MIME type from the list at
        // https://support.cloudflare.com/hc/en-us/articles/200168396 to ensure
        // that the ROM and chunks get compressed.
        if (
            [".rom", ".hda", "pram.bin", "nvram.bin"].some(ext =>
                pathname.endsWith(ext)
            )
        ) {
            response.headers.set("Content-Type", "multipart/mixed");
        }

        response.headers.set("X-Content-Type-Options", "nosniff");
        if (pathname === "/embed") {
            response.headers.set(
                "Cross-Origin-Resource-Policy",
                "cross-origin"
            );
        } else {
            response.headers.set("X-Frame-Options", "DENY");
        }
        // Allow SharedArrayBuffer to work
        response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
        response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
        // Allow the service worker to intercept all paths, even when
        // initiated from a year subpath.
        response.headers.set("Service-Worker-Allowed", "/");

        // Static content uses a content hash in the URL, so it can be cached
        // for a while (30 days).
        if (pathname.startsWith("/assets")) {
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
        } catch (e) {
            // Ignored
        }

        const err = e as Error;
        return new Response(err.message || err.toString(), {status: 500});
    }
}

// Override default mapRequestToAsset to not append index.html to unknown
// MIME types.
function mapRequestToAsset(request: Request): Request {
    const parsedUrl = new URL(request.url);
    let {pathname} = parsedUrl;

    // Let the client-side handle runDef URLs (minimal version of runDefFromUrl).
    const pieces = pathname.split("/");
    if (pieces.length === 3 && parseInt(pieces[1]) >= 1984) {
        // Year paths
        pathname = "/index.html";
    } else if (
        pieces.length === 2 &&
        (pieces[1] === "run" || pieces[1] === "embed")
    ) {
        // Custom run paths
        pathname = "/index.html";
    } else if (pathname.endsWith("/")) {
        // Regular index path
        pathname = pathname.concat("index.html");
    }

    parsedUrl.pathname = pathname;
    return new Request(parsedUrl.toString(), request);
}

const LEGACY_DOMAINS: {[domain: string]: string} = {
    "system6.app": "/1991/System%206.0.8",
    "system7.app": "/1996/System%207.5.3",
    "kanjitalk7.app": "/1996/KanjiTalk%207.5.3",
    "macos8.app": "/1998/Mac%20OS%208.1",
    "macos9.app": "/2000/Mac%20OS%209.0.4",
};

function getLegacyDomainRedirect(url: URL): string | undefined {
    let appleTalkZone;
    let domain = url.hostname;
    const pieces = domain.split(".");
    if (pieces.length === 3) {
        appleTalkZone = pieces[0];
        domain = pieces.slice(1).join(".");
    }

    const redirectPath = LEGACY_DOMAINS[domain];
    if (!redirectPath) {
        return undefined;
    }
    const params = url.searchParams;
    if (appleTalkZone && appleTalkZone !== "www") {
        params.set("appleTalk", appleTalkZone);
    }
    let search = params.toString();
    if (search) {
        search = "?" + search;
    }
    return redirectPath + search + url.hash;
}
