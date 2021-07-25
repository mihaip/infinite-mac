/// <reference types="react-scripts" />
/// <reference types="emscripten" />

declare module "*.txt" {
    const path: string;
    export default path;
}

declare module "*.gz" {
    const path: string;
    export default path;
}

declare module "*.jsz" {
    const path: string;
    export default path;
}

declare module "*.wasmz" {
    const path: string;
    export default path;
}

declare module "worker-loader!*" {
    class WebpackWorker extends Worker {
        constructor();
    }

    export default WebpackWorker;
}

declare module "service-worker-loader!*" {
    const register: import("service-worker-loader/types").ServiceWorkerRegister;
    const ServiceWorkerNoSupportError: import("service-worker-loader/types").ServiceWorkerNoSupportError;
    const scriptUrl: import("service-worker-loader/types").ScriptUrl;
    export default register;
    export {ServiceWorkerNoSupportError, scriptUrl};
}

declare interface EmscriptenModule {
    // Not part of the default type definitions for some reason
    monitorRunDependencies(left: number): void;
}

interface Document {
    webkitFullscreenEnabled?: boolean;
    webkitFullscreenElement?: HTMLElement;
}

interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
}
