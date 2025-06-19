/// <reference types="node" />

import type * as http from "node:http";
import * as cdrom from "../workers-site/cd-rom";
import * as library from "../workers-site/library";

/**
 * @fileoverview Helper middleware to inject custom behavior into the Vite dev
 * server. Changes to this file should generally be reflected in the
 * Cloudflare Worker (workers-site/index.ts)
 */
export function viteDevMiddleware(
    req: http.IncomingMessage,
    res: http.ServerResponse
): boolean {
    if (!req.url) {
        return false;
    }

    const url = new URL(req.url, "http://localhost:3127");
    const pieces = url.pathname.split("/");
    if (url.pathname === "/varz" || url.pathname === "/errorz") {
        handleVarz(req, url, res);
        return true;
    } else if (url.pathname.startsWith("/Disk/")) {
        // Disk chunks are served from R2 in the worker (workers-site/disk.ts),
        // redirect them to the build directory locally.
        req.url = `/Images/build/${pieces.slice(2).join("/")}`;
        console.log(`Redirecting ${url.pathname} to ${req.url}`);
    } else if (url.pathname.startsWith("/CD-ROM/")) {
        handleWorkerResponse(
            cdrom.handleRequest(url.pathname, req.method ?? "GET"),
            res
        );
        return true;
    } else if (url.pathname.startsWith("/Library/")) {
        handleWorkerResponse(library.handleRequest(new Request(url)), res);
        return true;
    }

    // Let the client handle /<year>/<disk> URLs.
    if (pieces.length === 3 && parseInt(pieces[1]) >= 1984) {
        req.url = "/index.html";
        return false;
    }

    return false;
}

// Varz stub
function handleVarz(
    req: http.IncomingMessage,
    url: URL,
    res: http.ServerResponse
) {
    if (req.method === "GET" && url.searchParams.has("name")) {
        res.writeHead(200).end(
            Math.round(Math.random() * (1 << 20)).toString()
        );
        return;
    }
    res.writeHead(
        req.method === "GET" || req.method === "POST" ? 204 : 405
    ).end();
}

async function handleWorkerResponse(
    responsePromise: Promise<Response>,
    res: http.ServerResponse
) {
    const response = await responsePromise;
    const {status, statusText, headers} = response;
    res.writeHead(status, statusText, Object.fromEntries(headers.entries()));
    if (response.body) {
        const reader = response.body.getReader();
        for (;;) {
            const {done, value} = await reader.read();
            if (done) {
                res.end();
                break;
            }
            res.write(value);
        }
        return;
    } else {
        const body = await response.arrayBuffer();
        res.end(await Buffer.from(body));
    }
}
