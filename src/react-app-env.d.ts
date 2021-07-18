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

declare interface EmscriptenModule {
    // Not part of the default type definitions for some reason
    monitorRunDependencies(left: number): void;
}
