import {
    type EmulatorChunkedFileSpec,
    type EmulatorFallbackCommand,
    generateNextChunkUrl,
    generateChunkUrl,
} from "@/emulator/common/common";

declare const self: ServiceWorkerGlobalScope;

const workerInfoById = new Map<string, WorkerInfo>();

class WorkerInfo {
    public commands: EmulatorFallbackCommand[] = [];
    public isPaused = false;
    public onUnpauseCallbacks: ((response: Response) => void)[] = [];
}

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
        const command = data.command as EmulatorFallbackCommand;
        const workerId = data.workerId as string;
        let workerInfo = workerInfoById.get(workerId);
        if (!workerInfo) {
            workerInfo = new WorkerInfo();
            workerInfoById.set(workerId, workerInfo);
        }
        let shouldPush = true;
        if (command.type === "input") {
            if (command.event.type === "pause") {
                workerInfo.isPaused = true;
                shouldPush = false;
            }
            if (command.event.type === "unpause") {
                workerInfo.isPaused = false;
                shouldPush = false;
                for (const callback of workerInfo.onUnpauseCallbacks) {
                    callback(prepareCommandsFetchResponse(workerId));
                }
                workerInfo.onUnpauseCallbacks = [];
            }
        }
        if (shouldPush) {
            workerInfo.commands.push(data.command);
        }
    } else if (data.type === "init-disk-cache") {
        const diskFileSpec = data.spec as EmulatorChunkedFileSpec;
        diskCacheSpecs.push(diskFileSpec);
        event.waitUntil(
            (async function () {
                const cache = await caches.open(DISK_CACHE_NAME);
                const prefetchChunkUrls = [];
                for (const chunkIndex of diskFileSpec.prefetchChunks) {
                    const chunkSignature = diskFileSpec.chunks[chunkIndex];
                    if (!chunkSignature) {
                        // Zero-ed out chunk, skip it.
                        continue;
                    }
                    const chunkUrl = generateChunkUrl(diskFileSpec, chunkIndex);
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
        const workerId = requestUrl.searchParams.get("worker-id");
        if (!workerId) {
            console.error("No worker-id provided");
            event.respondWith(constructJsonResponse([]));
            return;
        }
        handleWorkerCommands(event, workerId);
    } else if (requestUrl.pathname.endsWith("/worker-idlewait")) {
        const workerId = requestUrl.searchParams.get("worker-id");
        if (!workerId) {
            console.error("No worker-id provided");
            event.respondWith(constructJsonResponse({}));
            return;
        }
        handleIdleWait(event, workerId);
    } else if (
        diskCacheSpecs.some(spec =>
            decodeURIComponent(requestUrl.pathname).startsWith(spec.baseUrl)
        )
    ) {
        event.respondWith(handleDiskCacheRequest(event.request));
    }
});

function handleWorkerCommands(event: FetchEvent, workerId: string) {
    const workerInfo = workerInfoById.get(workerId);
    if (!workerInfo) {
        console.error("No worker info found for worker ID", workerId);
        event.respondWith(constructJsonResponse([]));
        return;
    }
    if (workerInfo.isPaused) {
        const unpausePromise = new Promise<Response>(resolve => {
            console.log("Emulator paused, waiting for input");
            const startTime = performance.now();
            workerInfo.onUnpauseCallbacks.push(response => {
                console.log(
                    "Emulator unpaused after",
                    ((performance.now() - startTime) / 1000).toFixed(1),
                    "seconds"
                );
                resolve(response);
            });
        });
        event.respondWith(unpausePromise);
        return;
    }
    event.respondWith(prepareCommandsFetchResponse(workerId));
}

function prepareCommandsFetchResponse(workerId: string): Response {
    const workerInfo = workerInfoById.get(workerId);
    if (!workerInfo) {
        console.error(
            "No worker info found for worker ID, returning no commands",
            workerId
        );
        return constructJsonResponse([]);
    }
    const fetchResponse = constructJsonResponse(workerInfo.commands);
    workerInfo.commands = [];
    return fetchResponse;
}

function handleIdleWait(event: FetchEvent, workerId: string) {
    const workerInfo = workerInfoById.get(workerId);
    if (!workerInfo) {
        console.error(
            "No worker info found for worker ID, skipping idlewait",
            workerId
        );
        event.respondWith(constructJsonResponse({}));
        return;
    }
    const requestUrl = new URL(event.request.url);
    const timeout = parseInt(requestUrl.searchParams.get("timeout")!, 10);
    // Subtract 1ms since that's the overhead of a roundtrip with the
    // service worker.
    const endTime = performance.now() + timeout - 1;
    event.respondWith(
        new Promise<Response>(resolve => {
            const interval = self.setInterval(() => {
                // Interrupt idlewait if new commands (presumably input) has
                // come in.
                if (
                    workerInfo.commands.length ||
                    performance.now() >= endTime
                ) {
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
