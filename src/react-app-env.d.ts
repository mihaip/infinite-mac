/// <reference types="react-scripts" />
/// <reference types="emscripten" />

declare module "*.txt" {
    const path: string;
    export default path;
}

declare module "*.rom" {
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

declare module "worklet-loader!*" {
    const path: string;
    export default path;
}

declare module "service-worker-loader!*" {
    const register: import("service-worker-loader/types").ServiceWorkerRegister;
    const ServiceWorkerNoSupportError: import("service-worker-loader/types").ServiceWorkerNoSupportError;
    const scriptUrl: import("service-worker-loader/types").ScriptUrl;
    export default register;
    export {ServiceWorkerNoSupportError, scriptUrl};
}

declare namespace FS {
    function analyzePath(path: string): {
        exists: boolean;
        name: string;
        object: FS.FSNode;
        parentPath: string;
        parentObject: FS.FSNode;
    };

    interface FSNode {
        id: number;
        mode: number;
        // Internals useful in implementing lazy files
        contents: Uint8Array;
        usedBytes: number;
        stream_ops: {[name: string]: Function};
    }

    interface FSStream {
        node: FSNode;
    }
}

interface Document {
    webkitFullscreenEnabled?: boolean;
    webkitFullscreenElement?: HTMLElement;
}

interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
}

interface Navigator {
    keyboard?: Keyboard;
}

interface Keyboard {
    lock?(keyCodes?: string[]): Promise<void>;
}

declare module "ringbuf.js" {
    export class RingBuffer<T extends TypedArray> {
        constructor(sab: SharedArrayBuffer, type: typeof T);
        push(elements: T, length?: number, offset: number = 0): number;
        pop(elements: T, length?: number, offset: number = 0): number;
        empty(): boolean;
        full(): boolean;
        capacity(): number;
        available_read(): number;
        available_write(): number;
    }
}

interface EmscriptenModule {
    quit: (status: number, toThrow?: Error) => void;
}
