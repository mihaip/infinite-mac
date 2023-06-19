/// <reference types="node" />

import type * as http from "node:http";
import * as cdrom from "../workers-site/cd-rom";

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
    if (url.pathname === "/varz") {
        handleVarz(req, res);
        return true;
    } else if (url.pathname.startsWith("/CD-ROM/")) {
        handleCDROM(url.pathname, req.method ?? "GET", res);
        return true;
    }

    // Let the client handle /<year>/<disk> URLs.
    const pieces = url.pathname.split("/");
    if (pieces.length === 3 && parseInt(pieces[1]) >= 1984) {
        req.url = "/index.html";
        return false;
    }

    return false;
}

// Varz stub
function handleVarz(req: http.IncomingMessage, res: http.ServerResponse) {
    res.writeHead(
        req.method === "GET" || req.method === "POST" ? 204 : 405
    ).end();
}

async function handleCDROM(
    path: string,
    method: string,
    res: http.ServerResponse
) {
    const response = await cdrom.handleRequest(path, method);
    const {status, statusText, headers} = response;
    res.writeHead(status, statusText, Object.fromEntries(headers.entries()));
    const body = await response.arrayBuffer();
    res.end(await Buffer.from(body));
}
