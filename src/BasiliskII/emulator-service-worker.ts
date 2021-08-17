import JSZip from "jszip";
import type {EmulatorFallbackCommand} from "./emulator-common";
import {getDebugFinderInfo, getDebugFolderInfo} from "./emulator-finder";

declare const self: ServiceWorkerGlobalScope;

let workerCommands: EmulatorFallbackCommand[] = [];

function constructJsResponse(js: string) {
    return new Response(js, {
        status: 200,
        statusText: "OK",
        headers: {
            "Content-Type": "text/javascript",
        },
    });
}

self.addEventListener("message", event => {
    const {data} = event;
    if (data.type === "worker-command") {
        workerCommands.push(data.command);
    }
});

self.addEventListener("fetch", (event: FetchEvent) => {
    const requestUrl = new URL(event.request.url);
    if (requestUrl.pathname.endsWith("/worker-commands.js")) {
        handleWorkerCommands(event);
    } else if (requestUrl.pathname.endsWith("/worker-idlewait.js")) {
        handleIdleWait(event);
    } else if (
        requestUrl.pathname.startsWith("/Library/") &&
        requestUrl.pathname.endsWith(".zip") &&
        requestUrl.searchParams.has("item")
    ) {
        event.respondWith(handleLibraryFile(event));
    }
});

function handleWorkerCommands(event: FetchEvent) {
    const fetchResponse = constructJsResponse(
        `globalThis["workerCommands"] = ${JSON.stringify(workerCommands)};`
    );
    workerCommands = [];
    event.respondWith(fetchResponse);
}

function handleIdleWait(event: FetchEvent) {
    const requestUrl = new URL(event.request.url);
    const timeout = parseInt(requestUrl.searchParams.get("timeout")!, 10);
    // Subtract 1ms since that's the overhead of a roundtrip with the
    // service worker.
    const endTime = performance.now() + timeout - 1;
    event.respondWith(
        new Promise<Response>(resolve => {
            const interval = self.setInterval(() => {
                // Iterrupt idlewait if new commands (presumably input) has
                // come in.
                if (workerCommands.length || performance.now() >= endTime) {
                    self.clearInterval(interval);
                    resolve(constructJsResponse(""));
                }
            }, 1);
        })
    );
}

const libraryZipPromises = new Map<string, Promise<JSZip>>();

async function handleLibraryFile(event: FetchEvent): Promise<Response> {
    const requestUrl = new URL(event.request.url);
    const item = requestUrl.searchParams.get("item")!;

    const zipPath = requestUrl.pathname;
    let zipPromise = libraryZipPromises.get(zipPath);
    if (!zipPromise) {
        // TODO: consider using Service Worker Cache API to further cache
        // ZIPs on the client. For now an in-memory cache is good enough to
        // serve all of the files (that are likely to be requested in quick
        // succession)
        const zipVersion = requestUrl.searchParams.get("v")!;
        zipPromise = fetchZip(zipPath, zipVersion);
        libraryZipPromises.set(zipPath, zipPromise);
    }
    const zip = await zipPromise;

    const file = zip.file(item.substring(1));
    if (!file) {
        return new Response(`Could not find ${item}`, {
            status: 200,
            statusText: "OK",
            headers: {
                "Content-Type": "text/plain",
                "X-Content-Type-Options": "nosniff",
            },
        });
    }

    if (requestUrl.searchParams.get("debug")) {
        const fileBuffer = await file.async("arraybuffer");
        const debugInfo: {[key: string]: any} = {
            length: fileBuffer.byteLength,
        };
        if (item.includes("/.finf/")) {
            debugInfo.finderInfo = getDebugFinderInfo(fileBuffer);
        } else if (item === "/DInfo") {
            debugInfo.folderInfo = getDebugFolderInfo(fileBuffer);
        }

        return new Response(JSON.stringify(debugInfo, undefined, 4), {
            status: 200,
            statusText: "OK",
            headers: {
                "Content-Type": "text/plain",
            },
        });
    }

    return new Response(await file.async("arraybuffer"), {
        status: 200,
        statusText: "OK",
        headers: {
            "Content-Type": "application/octet-stream",
        },
    });
}

async function fetchZip(path: string, version: string): Promise<JSZip> {
    async function postMessage(data: any) {
        const clients = await self.clients.matchAll({type: "window"});
        clients.forEach(client => client.postMessage(data));
    }
    const name = decodeURIComponent(path.split("/").slice(-1)[0].split(".")[0]);
    postMessage({type: "library_zip_fetch_start", name});

    const response = await fetch(`${path}?v=${version}`);
    const totalBytes = response.headers.has("Content-Length")
        ? parseInt(response.headers.get("content-Length")!, 10)
        : -1;
    postMessage({
        type: "library_zip_fetch_progress",
        name,
        bytesReceived: 0,
        totalBytes,
    });

    const reader = response.body!.getReader();
    let bytesReceived = 0;
    const responseChunks = [];
    while (true) {
        const result = await reader.read();

        if (result.done) {
            break;
        }
        bytesReceived += result.value.length;
        postMessage({
            type: "library_zip_fetch_progress",
            name,
            bytesReceived,
            totalBytes,
        });
        responseChunks.push(result.value);
    }

    const responseBlob = new Blob(responseChunks);

    const zip = await JSZip.loadAsync(responseBlob);

    postMessage({type: "library_zip_complete", name});

    return zip;
}

// Boilerplate to make sure we're running as quickly as possible.
self.addEventListener("install", event => {
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});
