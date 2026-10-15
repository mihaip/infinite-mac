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
            plugins: ["typescript", "react", "import"],
            // Preserve the previous rule set instead of enabling Oxlint defaults.
            // TODO: Evaluate adopting Oxlint defaults and keeping only project-specific
            // overrides, reviewing any added or removed checks before switching.
            categories: {
                correctness: "off",
            },
            options: {
                typeAware: true,
                // Compiler diagnostics still use the project's TypeScript version.
                typeCheck: false,
            },
            ignorePatterns: [
                "src/emulator/worker/emscripten/*.js",
                "src/stuffit/generated/**",
            ],
            rules: {
                "for-direction": "error",
                "no-async-promise-executor": "error",
                "no-case-declarations": "error",
                "no-compare-neg-zero": "error",
                "no-cond-assign": ["error", "except-parens"],
                "no-constant-binary-expression": "error",
                "no-constant-condition": [
                    "error",
                    {
                        checkLoops: "allExceptWhileTrue",
                    },
                ],
                "no-control-regex": "error",
                "no-debugger": "error",
                "no-delete-var": "error",
                "no-dupe-else-if": "error",
                "no-duplicate-case": "error",
                "no-empty": [
                    "error",
                    {
                        allowEmptyCatch: false,
                    },
                ],
                "no-empty-character-class": "error",
                "no-empty-pattern": [
                    "error",
                    {
                        allowObjectPatternsAsParameters: false,
                    },
                ],
                "no-empty-static-block": "error",
                "no-ex-assign": "error",
                "no-extra-boolean-cast": ["error", {}],
                "no-fallthrough": [
                    "error",
                    {
                        allowEmptyCase: false,
                        reportUnusedFallthroughComment: false,
                    },
                ],
                "no-global-assign": [
                    "error",
                    {
                        exceptions: [],
                    },
                ],
                "no-invalid-regexp": ["error", {}],
                "no-irregular-whitespace": [
                    "error",
                    {
                        skipComments: false,
                        skipJSXText: false,
                        skipRegExps: false,
                        skipStrings: true,
                        skipTemplates: false,
                    },
                ],
                "no-loss-of-precision": "error",
                "no-misleading-character-class": [
                    "error",
                    {
                        allowEscape: false,
                    },
                ],
                "no-nonoctal-decimal-escape": "error",
                "no-prototype-builtins": "error",
                "no-regex-spaces": "error",
                "no-self-assign": [
                    "error",
                    {
                        props: true,
                    },
                ],
                "no-shadow-restricted-names": [
                    "error",
                    {
                        reportGlobalThis: false,
                    },
                ],
                "no-sparse-arrays": "error",
                "no-unexpected-multiline": "error",
                "no-unsafe-finally": "error",
                "no-unsafe-optional-chaining": [
                    "error",
                    {
                        disallowArithmeticOperators: false,
                    },
                ],
                "no-unused-labels": "error",
                "no-unused-private-class-members": "error",
                "no-useless-backreference": "error",
                "no-useless-catch": "error",
                "no-useless-escape": [
                    "error",
                    {
                        allowRegexCharacters: [],
                    },
                ],
                "require-yield": "error",
                "use-isnan": [
                    "error",
                    {
                        enforceForIndexOf: false,
                        enforceForSwitchCase: true,
                    },
                ],
                "valid-typeof": [
                    "error",
                    {
                        requireStringLiterals: false,
                    },
                ],
                "no-var": "error",
                "prefer-const": [
                    "error",
                    {
                        destructuring: "any",
                        ignoreReadBeforeAssign: false,
                    },
                ],
                "prefer-rest-params": "error",
                "prefer-spread": "error",
                "typescript/ban-ts-comment": "error",
                "no-array-constructor": "error",
                "typescript/no-duplicate-enum-values": "error",
                "typescript/no-empty-object-type": "error",
                "typescript/no-extra-non-null-assertion": "error",
                "typescript/no-misused-new": "error",
                "typescript/no-namespace": "error",
                "typescript/no-non-null-asserted-optional-chain": "error",
                "typescript/no-require-imports": "error",
                "typescript/no-this-alias": "error",
                "typescript/no-unnecessary-type-constraint": "error",
                "typescript/no-unsafe-declaration-merging": "error",
                "typescript/no-unsafe-function-type": "error",
                "no-unused-expressions": [
                    "error",
                    {
                        allowShortCircuit: false,
                        allowTaggedTemplates: false,
                        allowTernary: false,
                    },
                ],
                "typescript/no-wrapper-object-types": "error",
                "typescript/prefer-as-const": "error",
                "typescript/prefer-namespace-keyword": "error",
                "typescript/triple-slash-reference": "error",
                "react/rules-of-hooks": "error",
                "react/exhaustive-deps": "warn",
                "import/named": "error",
                "import/namespace": "error",
                "import/default": "error",
                "import/export": "error",
                "import/no-named-as-default": "warn",
                "import/no-named-as-default-member": "warn",
                "import/no-duplicates": [
                    "error",
                    {
                        preferInline: true,
                    },
                ],
                "array-callback-return": [
                    "error",
                    {
                        allowImplicit: false,
                        checkForEach: false,
                        allowVoid: false,
                    },
                ],
                "no-constructor-return": "error",
                "no-promise-executor-return": [
                    "error",
                    {
                        allowVoid: false,
                    },
                ],
                "no-self-compare": "error",
                "no-template-curly-in-string": "error",
                "no-unmodified-loop-condition": "error",
                "no-unreachable-loop": [
                    "error",
                    {
                        ignore: [],
                    },
                ],
                "no-eval": [
                    "error",
                    {
                        allowIndirect: false,
                    },
                ],
                "no-implied-eval": "error",
                "no-object-constructor": "error",
                "no-new-wrappers": "error",
                "no-script-url": "error",
                "no-useless-constructor": "error",
                "no-useless-rename": [
                    "error",
                    {
                        ignoreDestructuring: false,
                        ignoreImport: false,
                        ignoreExport: false,
                    },
                ],
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
                "typescript/require-array-sort-compare": [
                    "error",
                    {
                        ignoreStringArrays: true,
                    },
                ],
            },
            // Vite synthesizes default exports for these ?worker imports.
            overrides: [
                {
                    files: [
                        "src/emulator/ui/audio.ts",
                        "src/emulator/ui/ui.ts",
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
                    },
                },
            ];
        },
    };
}
