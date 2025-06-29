import {type Assets} from "./index";
import {isValidSrcUrl} from "./cd-rom";
import {type RequestInit as CloudflareWorkerRequestInit} from "@cloudflare/workers-types/2021-11-03";

export async function handleRequest(request: Request, assets: Assets) {
    if (request.method !== "GET") {
        return errorResponse("Method not allowed", 405);
    }
    const url = new URL(request.url);
    const path = url.pathname.split("/").slice(2).join("/");
    switch (path) {
        case "proxy":
            return await handleProxy(url);
        case "details":
            return await handleDetails(url, assets);
        default:
            return errorResponse("Unknown library path", 404);
    }
}

async function handleDetails(url: URL, assets: Assets) {
    const id = url.searchParams.get("id");
    if (!id) {
        return errorResponse("id parameter is required");
    }
    const type = url.searchParams.get("type");
    if (!type) {
        return errorResponse("id parameter is required");
    }
    const assetUrl = url.searchParams.get("u");
    if (!assetUrl) {
        return errorResponse("u parameter is required");
    }

    if (!details) {
        // eslint-disable-next-line require-atomic-updates
        details = await loadLibraryDetails(assets, assetUrl);
    }

    return new Response(JSON.stringify(details[type][id]), {
        headers: {
            "Content-Type": "application/json",
        },
    });
}

let details: {[type: string]: {[id: string]: LibraryDetailsItem}};

type LibraryDetailsItem = {[key: string]: any};

async function loadLibraryDetails(assets: Assets, assetUrl: string) {
    console.time("Load library details");
    // The library details file is large (~20 MB). If we include it as a JSON
    // asset in the worker it will turned into a .js file, which is slow to
    // load and parse. Instead, treat it as a static asset (handled by the
    // client) and fetch it as JSON lazily when needed.
    const assetResponse = await assets.fetch(new Request(assetUrl));
    const libraryDetails = (await assetResponse.json()) as object;
    const unpacked = Object.fromEntries(
        Object.entries(libraryDetails).map(([type, items]) => [
            type,
            unpackDetailsItems(items as any[]),
        ])
    );
    console.timeEnd("Load library details");
    return unpacked;
}

function unpackDetailsItems(detailsItems: any[]) {
    return Object.fromEntries(
        detailsItems.map((detailItem, i) => {
            const [
                url,
                files,
                description,
                screenshots,
                manuals,
                composers,
                externalDownloadUrl,
            ] = detailItem;

            return [
                i,
                {
                    url,
                    files: files ?? {},
                    description,
                    screenshots: screenshots ?? [],
                    manuals: manuals ?? {},
                    composers: composers ?? [],
                    externalDownloadUrl,
                },
            ];
        })
    );
}

async function handleProxy(url: URL) {
    const srcUrl = url.searchParams.get("url");
    if (!srcUrl) {
        return errorResponse("url parameter is required");
    }
    if (!isValidSrcUrl(srcUrl)) {
        return errorResponse("Unexpected Library src URL: " + srcUrl);
    }

    const requestInit: CloudflareWorkerRequestInit = {
        headers: {
            "User-Agent": "Infinite Mac (+https://infinitemac.org)",
        },
        cf: {
            cacheEverything: true,
            cacheTtl: 30 * 24 * 60 * 60,
        },
    };

    return fetch(srcUrl, requestInit as RequestInit);
}

function errorResponse(message: string, status: number = 400): Response {
    return new Response(message, {
        status,
        statusText: message,
        headers: {"Content-Type": "text/plain"},
    });
}
