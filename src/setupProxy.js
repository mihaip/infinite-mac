const JSZip = require("jszip");
const fs = require("fs");

// Changes to this file should generally be reflected in the Cloudflare Worker
// (workers-site/index.js)
module.exports = function (app) {
    app.use(function (req, res, next) {
        // Force correct file types for files that we mess with the extension
        // of, since otherwise file-loader appears to get confused.
        if (req.path.endsWith(".jsz")) {
            res.setHeader("Content-Type", "text/javascript");
        } else if (req.path.endsWith(".wasmz")) {
            res.setHeader("Content-Type", "application/wasm");
        }

        // Handle pre-gzipped files
        if (req.path.endsWith(".gz")) {
            res.setHeader("Content-Encoding", "gzip");
        }

        // Serve individual files from library .zip archives.
        if (
            req.path.startsWith("/Library") &&
            req.path.endsWith(".zip") &&
            req.query.item
        ) {
            const item = req.query.item;
            // Not secure, allows path traversal.
            fs.readFile(`public${req.path}`, (err, data) => {
                if (err) {
                    throw err;
                }
                JSZip.loadAsync(data).then(zip => {
                    const file = zip.file(item.substring(1));
                    if (file) {
                        res.status(200);
                        res.setHeader(
                            "Content-Type",
                            "application/octet-stream"
                        );
                        file.async("nodebuffer").then(buffer => {
                            res.send(buffer);
                            res.end();
                        });
                    } else {
                        res.status(404);
                        res.setHeader("Content-Type", "text/plain");
                        // Not secure, allows XSS
                        res.send(`Could not find ${item}`);
                        res.end();
                    }
                });
            });
            return;
        }

        // Allow SharedArrayBuffer to work locally
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

        next();
    });
};
