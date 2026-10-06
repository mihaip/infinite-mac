/**
 * @fileoverview Minimal declarations for client code used by the worker. Exact
 * paths in the worker tsconfig map imports here to keep browser dependencies out
 * of its Cloudflare type environment; Vite still bundles the real client code.
 * Add declarations and matching paths only when the worker needs another client
 * API, and keep these types independent of client source imports.
 */

export declare function runDefFromUrl(url: string): object | undefined;

declare const App: import("react").ComponentType;
export default App;
