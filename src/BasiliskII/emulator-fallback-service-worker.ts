import type {EmulatorFallbackCommand} from "./emulator-common";

declare const self: ServiceWorkerGlobalScope;

let workerCommands: EmulatorFallbackCommand[] = [];

function constructResponse(): Response {
    return new Response(
        `globalThis["workerCommands"] = ${JSON.stringify(workerCommands)};`,
        {
            status: 200,
            statusText: "OK",
            headers: {
                "Content-Type": "text/javascript",
            },
        }
    );
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
        const fetchResponse = constructResponse();
        workerCommands = [];
        event.respondWith(fetchResponse);
    }
});

// Boilerplate to make sure we're running as quickly as possible.
self.addEventListener("install", event => {
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});
