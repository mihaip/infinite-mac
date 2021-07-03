/// <reference types="react-scripts" />

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
