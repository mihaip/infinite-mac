import {
    type EmulatorChunkedFileSpec,
    type EmulatorFallbackCommand,
    generateNextChunkUrl,
    generateChunkUrl,
} from "./emulator-common";

declare const self: ServiceWorkerGlobalScope;

let workerCommands: EmulatorFallbackCommand[] = [];

function constructJsonResponse(json: any) {
    return new Response(JSON.stringify(json), {
        status: 200,
        statusText: "OK",
        headers: {
            "Content-Type": "application/json",
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
    if (requestUrl.pathname.endsWith("/worker-commands")) {
        handleWorkerCommands(event);
    } else if (requestUrl.pathname.endsWith("/worker-idlewait")) {
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
    const fetchResponse = constructJsonResponse(workerCommands);
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
                    resolve(constructJsonResponse({}));
                }
            }, 1);
        })
    );
}

async function handleDiskCacheRequest(request: Request): Promise<Response> {
    // Ignore cache-related errors, we don't want to block the fetch if the
    // cache fails (appears to happen on iOS when running with more constrained
    // quotas, e.g. in SFSafariViewController).
    let cache: Cache | undefined;
    try {
        cache = await caches.open(DISK_CACHE_NAME);
    } catch (e) {
        console.error("Error opening cache:", e);
    }

    // Kick off (but don't wait for) a prefetch of the next chunk regardless
    // of whether this is a cache hit (if prefetching is working, we should
    // almost always end up with a cache hit, but we want to keep fetching
    // subsequent chunks).
    if (cache) {
        prefetchNextChunk(cache, request.url);
        const match = await cache.match(request);
        if (match) {
            return match;
        }
    }
    const response = await fetch(request);
    try {
        cache?.put(request, response.clone());
    } catch (e) {
        console.error("Ignoring cache error: ", e);
    }
    return response;
}

async function prefetchNextChunk(cache: Cache, url: string) {
    const nextChunkUrl = generateNextChunkUrl(url, diskCacheSpecs);
    if (!nextChunkUrl) {
        return;
    }
    const nextChunkRequest = new Request(nextChunkUrl);
    const cachedResponse = await cache.match(nextChunkRequest);
    if (!cachedResponse) {
        await cache.add(nextChunkRequest);
    }
}

// Boilerplate to make sure we're running as quickly as possible.
self.addEventListener("install", event => {
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});
