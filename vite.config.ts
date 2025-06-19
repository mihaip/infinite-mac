import {type ResolvedConfig, defineConfig} from "vite";
import react from "@vitejs/plugin-react-swc";
import basicSsl from "@vitejs/plugin-basic-ssl";
import svgr from "vite-plugin-svgr";
import {viteDevMiddleware} from "./src/vite-dev-middleware";

const headers = {
    // Allow SharedArrayBuffer to work locally
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    // Allow the service worker to intercept all paths, even when
    // initiated from a year subpath.
    "Service-Worker-Allowed": "/",
};

export default defineConfig(() => {
    return {
        build: {
            outDir: "build",
            minify: true,
            // the library index is 1.5MB (before gzip), which is unavoidable.
            chunkSizeWarningLimit: 2048,
        },
        worker: {
            format: "es",
        },
        assetsInclude: [
            "**/*.rom",
            "**/*.hda",
            "**/*nvram.bin",
            "**/*pram.bin",
        ],
        server: {
            port: 3127,
            headers,
            host: "0.0.0.0",
        },
        preview: {
            port: 4127,
            headers,
        },
        clearScreen: false,
        plugins: [
            basicSslWrapped(),
            react(),
            svgr(),
            {
                name: "dev-middleware",
                configureServer: server => {
                    // Add stubs for the functionality provided by the
                    // Cloudflare worker.
                    server.middlewares.use((req, res, next) => {
                        const handled = viteDevMiddleware(req, res);
                        if (!handled) {
                            next();
                        }
                    });
                },
            },
        ],
    };
});

// The basicSsl() plugin will set up https for both dev/serve and preview, but we only
// want it for the latter. The plugin doesn't support options
// (https://github.com/vitejs/vite-plugin-basic-ssl/issues/9), so we instead
// wrap it and undo the dev/serve https config after it's done.
function basicSslWrapped() {
    const originalBasicSsl = basicSsl();
    let configResolved:
        | ((config: ResolvedConfig) => void | Promise<void>)
        | undefined;
    const {configResolved: originalConfigResolved} = originalBasicSsl;
    if (typeof originalConfigResolved === "function") {
        configResolved = function (config) {
            const originalResult = originalConfigResolved(config);
            if (originalResult instanceof Promise) {
                return originalResult.then(() => {
                    delete config.server.https;
                });
            }
            delete config.server.https;
        };
    }
    return {
        ...originalBasicSsl,
        configResolved,
    };
}
