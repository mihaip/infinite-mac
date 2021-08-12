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
                        if (req.query.debug) {
                            res.setHeader("Content-Type", "text/plain");
                            file.async("nodebuffer").then(buffer => {
                                const debugInfo = {
                                    length: buffer.length,
                                };
                                if (item.includes("/.finf/")) {
                                    debugInfo.finderInfo =
                                        getDebugFinderInfo(buffer);
                                }
                                res.send(
                                    JSON.stringify(debugInfo, undefined, 4)
                                );
                                res.end();
                                res.end();
                            });
                        } else {
                            res.setHeader(
                                "Content-Type",
                                "application/octet-stream"
                            );
                            file.async("nodebuffer").then(buffer => {
                                res.send(buffer);
                                res.end();
                            });
                        }
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

/**
 * Decodes a .finfo file containing an FInfo struct based on the encoding
 * specified in BasiliskII/src/include/extfs_defs.h and
 * https://web.archive.org/web/20040918142656/http://developer.apple.com/documentation/Carbon/Reference/Finder_Interface/finder_interface/data_type_8.html
 */
function getDebugFinderInfo(buffer) {
    function toChars(long) {
        return (
            String.fromCharCode((long >> 24) & 0xff) +
            String.fromCharCode((long >> 16) & 0xff) +
            String.fromCharCode((long >> 8) & 0xff) +
            String.fromCharCode((long >> 0) & 0xff)
        );
    }
    function toFlags(flags) {
        const result = [];
        for (const [flagName, flag] of Object.entries(FinderFlags)) {
            if (flags & flag) {
                result.push(flagName);
            }
        }
        return result;
    }
    return {
        typeCode: toChars(buffer.readInt32BE(0)),
        creatorCode: toChars(buffer.readInt32BE(4)),
        flags: toFlags(buffer.readInt16BE(8)),
        location: {
            x: buffer.readInt16BE(10),
            y: buffer.readInt16BE(12),
        },
        folder: buffer.readInt16BE(14),
    };
}

const FinderFlags = {
    kIsOnDesk: 0x0001,
    kColor: 0x000e,
    kIsShared: 0x0040,
    kHasBeenInited: 0x0100,
    kHasCustomIcon: 0x0400,
    kIsStationery: 0x0800,
    kNameLocked: 0x1000,
    kHasBundle: 0x2000,
    kIsInvisible: 0x4000,
    kIsAlias: 0x8000,
};
