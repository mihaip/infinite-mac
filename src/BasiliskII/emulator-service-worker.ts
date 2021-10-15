import type {
    EmulatorChunkedFileSpec,
    EmulatorFallbackCommand,
} from "./emulator-common";
import {generateChunkUrl} from "./emulator-common";

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

const DISK_CACHE_NAME = "disk-cache";
const diskCacheSpecs: EmulatorChunkedFileSpec[] = [];

self.addEventListener("message", event => {
    const {data} = event;
    if (data.type === "worker-command") {
        workerCommands.push(data.command);
    } else if (data.type === "init-disk-cache") {
        const diskFileSpec = data.spec as EmulatorChunkedFileSpec;
        diskCacheSpecs.push(diskFileSpec);
        event.waitUntil(
            (async function () {
                const cache = await caches.open(DISK_CACHE_NAME);
                const prefetchChunkUrls = [];
                for (const chunk of diskFileSpec.prefetchChunks) {
                    const chunkUrl = generateChunkUrl(diskFileSpec, chunk);
                    const cachedResponse = await cache.match(
                        new Request(chunkUrl)
                    );
                    if (!cachedResponse) {
                        prefetchChunkUrls.push(chunkUrl);
                    }
                }
                if (prefetchChunkUrls.length) {
                    return cache.addAll(prefetchChunkUrls);
                }
            })()
        );
    }
});

self.addEventListener("fetch", (event: FetchEvent) => {
    const requestUrl = new URL(event.request.url);
    if (requestUrl.pathname.endsWith("/worker-commands.js")) {
        handleWorkerCommands(event);
    } else if (requestUrl.pathname.endsWith("/worker-idlewait.js")) {
        handleIdleWait(event);
    } else if (
        diskCacheSpecs.some(spec =>
            decodeURIComponent(requestUrl.pathname).startsWith(spec.baseUrl)
        )
    ) {
        event.respondWith(handleDiskCacheRequest(event.request));
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

async function handleDiskCacheRequest(request: Request): Promise<Response> {
    const cache = await caches.open(DISK_CACHE_NAME);
    const match = await cache.match(request);
    if (match) {
        return match;
    }
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
}

// Boilerplate to make sure we're running as quickly as possible.
self.addEventListener("install", event => {
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});
