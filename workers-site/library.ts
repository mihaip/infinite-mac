import {isValidSrcUrl} from "./cd-rom";
import {type RequestInit as CloudflareWorkerRequestInit} from "@cloudflare/workers-types/2021-11-03";

export async function handleRequest(request: Request) {
    if (request.method !== "GET") {
        return errorResponse("Method not allowed", 405);
    }
    const url = new URL(request.url);
    const path = url.pathname.split("/").slice(2).join("/");
    switch (path) {
        case "proxy":
            return await handleProxy(url);
        case "details":
            return await handleDetails(url);
        default:
            return errorResponse("Unknown library path", 404);
    }
}

async function handleDetails(url: URL) {
    const id = url.searchParams.get("id");
    if (!id) {
        return errorResponse("id parameter is required");
    }
    const type = url.searchParams.get("type");
    if (!type) {
        return errorResponse("id parameter is required");
    }

    if (!details) {
        // eslint-disable-next-line require-atomic-updates
        details = await loadLibraryDetails();
    }

    return new Response(JSON.stringify(details[type][id]), {
        headers: {
            "Content-Type": "application/json",
        },
    });
}

let details: {[type: string]: {[id: string]: LibraryDetailsItem}};

type LibraryDetailsItem = {[key: string]: any};

async function loadLibraryDetails() {
    console.time("Load library details");
    const {default: libraryDetailsExport} = (await import(
        "./Library-details.json"
    )) as {default: string | object};
    const libraryDetails =
        typeof libraryDetailsExport === "object"
            ? libraryDetailsExport
            : JSON.parse(libraryDetailsExport);
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
