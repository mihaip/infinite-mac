import {defineConfig, globalIgnores} from "eslint/config";
import {fixupConfigRules, fixupPluginRules} from "@eslint/compat";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import {fileURLToPath} from "node:url";
import js from "@eslint/js";
import {FlatCompat} from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default defineConfig([
    globalIgnores([
        "src/emulator/dingusppc.js",
        "src/emulator/minivmac-*.js",
        "src/emulator/ppc.js",
        "src/emulator/previous.js",
        "src/emulator/BasiliskII.js",
        "src/emulator/SheepShaver.js",
    ]),
    {
        extends: fixupConfigRules(
            compat.extends(
                "eslint:recommended",
                "plugin:@typescript-eslint/recommended",
                "plugin:react-hooks/recommended",
                "plugin:import/recommended"
            )
        ),

        plugins: {
            "@typescript-eslint": fixupPluginRules(typescriptEslint),
        },

        languageOptions: {
            parser: tsParser,
            ecmaVersion: 5,
            sourceType: "script",

            parserOptions: {
                project: true,
                tsconfigRootDir: "./",
            },
        },

        rules: {
            "array-callback-return": "error",
            "no-constant-binary-expression": "error",
            "no-constructor-return": "error",
            "no-promise-executor-return": "error",
            "no-self-compare": "error",
            "no-template-curly-in-string": "error",
            "no-unmodified-loop-condition": "error",
            "no-unreachable-loop": "error",

            "require-atomic-updates": [
                "error",
                {
                    allowProperties: true,
                },
            ],

            "no-eval": "error",
            "no-implied-eval": "error",
            "no-new-object": "error",
            "no-new-wrappers": "error",
            "no-script-url": "error",
            "no-useless-constructor": "error",
            "no-useless-rename": "error",
            "no-var": "error",
            eqeqeq: "error",

            "object-shorthand": [
                "error",
                "always",
                {
                    avoidQuotes: true,
                },
            ],

            "prefer-const": "error",
            "import/consistent-type-specifier-style": [
                "error",
                "prefer-inline",
            ],
            "import/no-unresolved": "off",
            "import/no-empty-named-blocks": "error",

            "import/no-duplicates": [
                "error",
                {
                    "prefer-inline": true,
                },
            ],

            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    fixStyle: "inline-type-imports",
                },
            ],

            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    vars: "all",
                    args: "none",
                    ignoreRestSiblings: false,
                },
            ],

            "@typescript-eslint/prefer-optional-chain": "error",
            "@typescript-eslint/array-type": "error",
            "@typescript-eslint/consistent-generic-constructors": "error",
            "@typescript-eslint/no-duplicate-enum-values": "error",
            "@typescript-eslint/no-mixed-enums": "error",
            "@typescript-eslint/no-unsafe-enum-comparison": "error",
            "@typescript-eslint/no-dynamic-delete": "error",
            "@typescript-eslint/prefer-nullish-coalescing": "error",
            "@typescript-eslint/no-non-null-asserted-nullish-coalescing":
                "error",
            "@typescript-eslint/no-unnecessary-type-arguments": "error",
            "@typescript-eslint/non-nullable-type-assertion-style": "error",
            "@typescript-eslint/prefer-for-of": "error",
            "@typescript-eslint/prefer-includes": "error",
            "@typescript-eslint/prefer-return-this-type": "error",
            "@typescript-eslint/prefer-string-starts-ends-with": "error",

            "@typescript-eslint/require-array-sort-compare": [
                "error",
                {
                    ignoreStringArrays: true,
                },
            ],

            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-inferrable-types": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-unused-vars": "off",
        },
    },
]);
