import type {EmulatorFallbackCommand} from "./emulator-common";

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
        const fetchResponse = constructJsResponse(
            `globalThis["workerCommands"] = ${JSON.stringify(workerCommands)};`
        );
        workerCommands = [];
        event.respondWith(fetchResponse);
    } else if (requestUrl.pathname.endsWith("/worker-idlewait.js")) {
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
});

// Boilerplate to make sure we're running as quickly as possible.
self.addEventListener("install", event => {
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});
