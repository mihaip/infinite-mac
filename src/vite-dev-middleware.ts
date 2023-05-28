/// <reference types="node" />

import type * as http from "node:http";

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
        handleCDROM(url.pathname, res);
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

async function handleCDROM(path: string, res: http.ServerResponse) {
    const pathPieces = path.split("/");
    let srcUrl;
    try {
        srcUrl = atob(pathPieces[2]);
    } catch (e) {
        res.writeHead(400, "Malformed CD-ROM src URL: " + pathPieces[2]).end();
        return;
    }
    const chunkMatch = /(\d+)-(\d+).chunk$/.exec(pathPieces[3]);
    if (!chunkMatch) {
        res.writeHead(400, "Malformed CD-ROM chunk: " + pathPieces[3]).end();
        return;
    }

    const chunkStart = parseInt(chunkMatch[1]);
    const chunkEnd = parseInt(chunkMatch[2]);

    let srcRes;
    try {
        srcRes = await fetch(srcUrl, {
            headers: {"Range": `bytes=${chunkStart}-${chunkEnd}`},
        });
    } catch (e) {
        console.warn("CD-ROM fetch failed", {
            srcUrl,
            chunkStart,
            chunkEnd,
            e,
        });
        res.writeHead(500, "CD-ROM fetch failed: " + e).end();
        return;
    }

    if (!srcRes.ok) {
        console.warn("CD-ROM fetch error", {
            srcUrl,
            chunkStart,
            chunkEnd,
            srcRes,
        });
        res.writeHead(
            500,
            "CD-ROM fetch failed: " + srcRes.status + "/" + srcRes.statusText
        ).end();
        return;
    }

    let srcBody;
    try {
        srcBody = await srcRes.arrayBuffer();
    } catch (e) {
        console.warn("CD-ROM body fetch failed", {
            srcUrl,
            chunkStart,
            chunkEnd,
            e,
        });
        res.writeHead(500, "CD-ROM body fetch failed: " + e).end();
        return;
    }

    res.writeHead(200, "OK", {
        "Content-Type": "multipart/mixed",
        // TODO: cache control headers?
        "Content-Length": srcRes.headers.get("Content-Length")!,
    });
    // Copy response body from srcRes to res
    res.end(Buffer.from(srcBody));
}
