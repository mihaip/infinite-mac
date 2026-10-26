import {type Plugin, defineConfig, lazyPlugins} from "vite-plus";
import path from "node:path";

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
        lint: {
            plugins: ["typescript", "unicorn", "oxc", "react", "import"],
            // Use Oxlint correctness checks plus the project rules below.
            categories: {
                correctness: "error",
            },
            options: {
                typeAware: true,
                // We invoke tsc directly so that we can have more control over
                // React app vs. worker settings.
                typeCheck: false,
            },
            ignorePatterns: [
                "src/emulator/worker/emscripten/*.js",
                "src/stuffit/generated/**",
            ],
            rules: {
                "no-case-declarations": "error",
                "no-empty": "error",
                "no-fallthrough": "error",
                "no-prototype-builtins": "error",
                "no-regex-spaces": "error",
                "no-unexpected-multiline": "error",
                "no-var": "error",
                "prefer-const": "error",
                "prefer-rest-params": "error",
                "prefer-spread": "error",
                "typescript/ban-ts-comment": "error",
                "no-array-constructor": "error",
                "typescript/no-empty-object-type": "error",
                "typescript/no-namespace": "error",
                "typescript/no-require-imports": "error",
                "typescript/no-unnecessary-type-constraint": "error",
                "typescript/no-unsafe-function-type": "error",
                "react/rules-of-hooks": "error",
                "import/named": "error",
                "import/export": "error",
                "import/no-named-as-default": "warn",
                "import/no-named-as-default-member": "warn",
                "import/no-duplicates": [
                    "error",
                    {
                        preferInline: true,
                    },
                ],
                "array-callback-return": "error",
                "no-constructor-return": "error",
                "no-promise-executor-return": "error",
                "no-self-compare": "error",
                "no-template-curly-in-string": "error",
                "no-unmodified-loop-condition": "error",
                "no-unreachable-loop": "error",
                "no-implied-eval": "error",
                "no-object-constructor": "error",
                "no-new-wrappers": "error",
                "no-script-url": "error",
                "no-useless-constructor": "error",
                eqeqeq: "error",
                "object-shorthand": [
                    "error",
                    "always",
                    {
                        avoidQuotes: true,
                    },
                ],
                "import/consistent-type-specifier-style": [
                    "error",
                    "prefer-inline",
                ],
                "import/no-empty-named-blocks": "error",
                "typescript/consistent-type-imports": [
                    "error",
                    {
                        fixStyle: "inline-type-imports",
                    },
                ],
                "typescript/prefer-optional-chain": "error",
                "typescript/array-type": "error",
                "typescript/consistent-generic-constructors": "error",
                "typescript/no-mixed-enums": "error",
                "typescript/no-unsafe-enum-comparison": "error",
                "typescript/no-dynamic-delete": "error",
                "typescript/prefer-nullish-coalescing": "error",
                "typescript/no-non-null-asserted-nullish-coalescing": "error",
                "typescript/no-unnecessary-type-arguments": "error",
                "typescript/non-nullable-type-assertion-style": "error",
                "typescript/prefer-for-of": "error",
                "typescript/prefer-includes": "error",
                "typescript/prefer-return-this-type": "error",
                "typescript/prefer-string-starts-ends-with": "error",
                "react/exhaustive-deps": "warn",
                "no-irregular-whitespace": [
                    "error",
                    {
                        skipJSXText: false,
                        skipRegExps: false,
                        skipTemplates: false,
                    },
                ],
                // Keep callback signatures and intentional property omissions.
                "no-unused-vars": [
                    "error",
                    {
                        args: "none",
                        caughtErrors: "none",
                        ignoreRestSiblings: true,
                    },
                ],
                // These React Compiler checks need a separate migration.
                "react/preserve-manual-memoization": "off",
                "react/purity": "off",
                "react/refs": "off",
                "react/set-state-in-effect": "off",
            },
            overrides: [
                {
                    files: ["src/**/*.ts", "src/**/*.tsx"],
                    rules: {
                        "no-restricted-imports": [
                            "error",
                            {
                                patterns: [
                                    {
                                        group: [
                                            "./**",
                                            "../**",
                                            // The changelog is outside the @/ alias root.
                                            "!../../CHANGELOG.md?raw",
                                        ],
                                        message:
                                            "Use @/ absolute imports for files inside src.",
                                    },
                                ],
                            },
                        ],
                    },
                },
                // Vite synthesizes default exports for these ?worker imports.
                {
                    files: [
                        "src/emulator/ui/audio.ts",
                        "src/emulator/ui/ui.ts",
                        "src/stuffit/ui/ui.ts",
                    ],
                    rules: {
                        "import/default": "off",
                    },
                },
            ],
        },
        fmt: {
            trailingComma: "es5",
            bracketSameLine: true,
            bracketSpacing: false,
            tabWidth: 4,
            semi: true,
            singleQuote: false,
            quoteProps: "preserve",
            arrowParens: "avoid",
            printWidth: 80,
            sortPackageJson: false,
            ignorePatterns: [
                "src/emulator/worker/emscripten/*.js",
                "src/stuffit/generated/**",
                "src/Data/*.json",
            ],
        },
        environments: {
            infinite_mac: {
                build: {
                    // Wrangler discovers prebuilt maps via sourceMappingURL.
                    sourcemap: true,
                },
            },
            client: {
                build: {
                    rolldownOptions: {
                        input: {
                            main: path.resolve(
                                import.meta.dirname,
                                "index.html"
                            ),
                            monkey: path.resolve(
                                import.meta.dirname,
                                "monkey/index.html"
                            ),
                        },
                        output: {
                            codeSplitting: {
                                groups: [
                                    {
                                        name: "shared",
                                        minShareCount: 2,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        },
        build: {
            outDir: "build",
            assetsDir: "assets/0",
            minify: true,
            // the library index is 1.5MB (before gzip), which is unavoidable.
            chunkSizeWarningLimit: 2048,
        },
        worker: {
            format: "es" as const,
        },
        assetsInclude: [
            "**/*.rom",
            "**/*.hda",
            "**/*.media",
            "**/*nvram.bin",
            "**/*pram.bin",
        ],
        resolve: {
            alias: {
                "@": path.resolve(import.meta.dirname, "src"),
            },
        },
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
        // Use lazy plugins for things that are needed only for builds, so that
        // linting is fast (see https://viteplus.dev/guide/troubleshooting#slow-config-loading-caused-by-heavy-plugins)
        plugins: lazyPlugins(async () => {
            const [
                {default: react},
                {default: basicSsl},
                {default: svgr},
                {cloudflare},
            ] = await Promise.all([
                import("@vitejs/plugin-react"),
                import("@vitejs/plugin-basic-ssl"),
                import("vite-plugin-svgr"),
                import("@cloudflare/vite-plugin"),
            ]);
            return [
                ssrDevCssPlugin(),
                basicSslWrapped(basicSsl()),
                react(),
                svgr(),
                cloudflare(),
            ];
        }),
    };
});

// The basicSsl() plugin will set up https for both dev/serve and preview, but we only
// want it for the latter. The plugin doesn't support options
// (https://github.com/vitejs/vite-plugin-basic-ssl/issues/9), so we instead
// wrap it and undo the dev/serve https config after it's done.
function basicSslWrapped(originalBasicSsl: Plugin): Plugin {
    const {configResolved: originalConfigResolved} = originalBasicSsl;
    if (typeof originalConfigResolved !== "function") {
        return originalBasicSsl;
    }
    return {
        ...originalBasicSsl,
        async configResolved(config) {
            await originalConfigResolved.call(this, config);
            delete config.server.https;
        },
    };
}

// Minimal plugin based on https://github.com/hi-ogawa/vite-plugins/tree/main/packages/ssr-css
// that injects all CSS into the HTML response so that we don't have a flash of
// unstyled content in dev mode (when Vite normally injects the CSS via JS-generated
// <style> tag).
function ssrDevCssPlugin(): Plugin {
    const virtualCssPath = "/@virtual:ssr-css.css";
    const collectedStyles = new Map<string, string>();
    return {
        name: "ssr-dev-css",
        apply: "serve",
        transform(code, id) {
            if (id.includes("node_modules")) return null;
            if (id.endsWith(".css")) {
                collectedStyles.set(id, code);
            }
            return null;
        },
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url === virtualCssPath) {
                    res.setHeader("Content-Type", "text/css");
                    res.end(Array.from(collectedStyles.values()).join("\n"));
                    return;
                }
                next();
            });
        },
        transformIndexHtml() {
            return [
                {
                    tag: "link",
                    injectTo: "head",
                    attrs: {
                        rel: "stylesheet",
                        href: virtualCssPath,
                        "data-ssr-css": true,
                    },
                },
                {
                    tag: "script",
                    injectTo: "head",
                    attrs: {type: "module"},
                    // Remove our injected stylesheet after the page has finished
                    // loading, so that the regular Vite CSS can take over (it
                    // gets updated for HMR, whereas our snapshot is static).
                    children: `
                        document.addEventListener("DOMContentLoaded", () => {
                            document.querySelectorAll("[data-ssr-css]")
                                .forEach(node => node.remove());
                        }, {once: true});
                    `,
                },
            ];
        },
    };
}
