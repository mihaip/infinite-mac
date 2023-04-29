// Changes to this file should generally be reflected in the Cloudflare Worker
// (workers-site/index.js)
module.exports = function (app) {
    app.use(function (req, res, next) {
        if (req.path === "/varz") {
            return handleVarz(req, res);
        } else if (req.path.startsWith("/CD-ROM/")) {
            return handleCDROM(req, res);
        }

        // Force correct file types for files that we mess with the extension
        // of, since otherwise file-loader appears to get confused.
        if (req.path.endsWith(".jsz")) {
            res.setHeader("Content-Type", "text/javascript");
        } else if (req.path.endsWith(".wasmz")) {
            res.setHeader("Content-Type", "application/wasm");
        }

        // Allow SharedArrayBuffer to work locally
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

        next();
    });
};

// Varz stub
function handleVarz(req, res) {
    res.status(
        req.method === "GET" || req.method === "POST" ? 204 : 405
    ).send();
}

async function handleCDROM(req, res) {
    const pathPieces = req.path.split("/");
    let srcUrl;
    try {
        srcUrl = atob(pathPieces[2]);
    } catch (e) {
        res.writeHead(400, "Malformed CD-ROM src URL: " + pathPieces[2]).send();
        return;
    }
    const chunkMatch = /(\d+)-(\d+).chunk$/.exec(pathPieces[3]);
    if (!chunkMatch) {
        res.writeHead(400, "Malformed CD-ROM chunk: " + pathPieces[3]).send();
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
        res.writeHead(500, "CD-ROM fetch failed: " + e).send();
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
        ).send();
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
        res.writeHead(500, "CD-ROM body fetch failed: " + e).send();
        return;
    }

    res.status(200);
    res.setHeader("Content-Type", "multipart/mixed");
    // TODO: cache control headers?
    res.setHeader("Content-Length", srcRes.headers.get("Content-Length"));
    // Copy response body from srcRes to res
    res.send(Buffer.from(srcBody));
}
