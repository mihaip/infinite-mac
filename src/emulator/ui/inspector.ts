import {
    INSPECTOR_CONTROL_BYTES,
    INSPECTOR_GRACE_MS,
    type InspectorControl,
    type InspectorMessage,
    type InspectorState,
    type InspectorWorkerConfig,
    writeInspectorControl,
} from "../common/inspector";

// Owned by the emulator session, independently of drawer contents or React.
export class EmulatorInspector {
    #config: InspectorWorkerConfig;
    #sendFallback?: (control: InspectorControl) => void;
    #listeners = new Set<() => void>();
    #state: InspectorState = {
        supported: false,
        capturing: false,
        paused: false,
        sequence: 0,
    };
    #closeTimer?: ReturnType<typeof setTimeout>;
    #resourceKey?: string;
    #previewKeys: string[] = [];
    #disposed = false;
    #open = false;

    constructor(
        shared: boolean,
        sendFallback?: (control: InspectorControl) => void
    ) {
        this.#config = shared
            ? {
                  type: "shared-memory",
                  control: new SharedArrayBuffer(INSPECTOR_CONTROL_BYTES),
              }
            : {type: "fallback"};
        this.#sendFallback = sendFallback;
        this.#publish();
    }
    workerConfig() {
        return this.#config;
    }
    getSnapshot = () => this.#state;
    subscribe = (listener: () => void) => {
        this.#listeners.add(listener);
        return () => {
            this.#listeners.delete(listener);
        };
    };
    #update(state: Partial<InspectorState>) {
        this.#state = {...this.#state, ...state};
        this.#listeners.forEach(listener => listener());
    }
    handleMessage(message: InspectorMessage) {
        if (this.#disposed || message.version !== 1) return;
        if (message.type === "inspector_capabilities") {
            this.#update({supported: message.inspectors.includes("resources")});
        } else if (
            message.type === "inspector_snapshot" &&
            message.sequence > this.#state.sequence &&
            !!message.paused === this.#state.paused
        ) {
            this.#update({
                sequence: message.sequence,
                snapshot: message.snapshot,
                error: undefined,
            });
        } else if (message.type === "inspector_error" && !this.#state.paused) {
            this.#update({error: message.error});
        }
    }
    setOpen(open: boolean) {
        if (this.#disposed) return;
        this.#open = open;
        clearTimeout(this.#closeTimer);
        if (open) {
            this.#update({capturing: true});
            this.#publish();
        } else if (this.#state.capturing && !this.#state.paused) {
            this.#closeTimer = setTimeout(() => {
                this.#update({capturing: false});
                this.#publish();
            }, INSPECTOR_GRACE_MS);
        }
    }
    setPaused(paused: boolean) {
        if (this.#disposed || paused === this.#state.paused) return;
        this.#update({paused});
        // An explicitly frozen capture remains available until resume or stop.
        this.setOpen(this.#open);
        this.#publish();
    }
    selectResource(key?: string) {
        this.#resourceKey = key;
        this.#publish();
    }
    selectPreviews(keys: string[]) {
        if (
            keys.length === this.#previewKeys.length &&
            keys.every((key, i) => key === this.#previewKeys[i])
        )
            return;
        this.#previewKeys = keys;
        this.#publish();
    }
    #publish() {
        const control: InspectorControl = {
            version: 1,
            subscriptions: this.#state.capturing ? ["resources"] : [],
            paused: this.#state.paused,
            resourceKey: this.#resourceKey,
            previewKeys: this.#previewKeys,
        };
        if (this.#config.type === "shared-memory")
            writeInspectorControl(this.#config.control, control);
        else this.#sendFallback?.(control);
    }
    dispose() {
        if (this.#disposed) return;
        this.workerStopped();
        this.#disposed = true;
        this.#listeners.clear();
    }
    workerStopped() {
        clearTimeout(this.#closeTimer);
        this.#open = false;
        this.#resourceKey = undefined;
        this.#previewKeys = [];
        this.#update({
            capturing: false,
            paused: false,
            supported: false,
            sequence: 0,
            snapshot: undefined,
            error: undefined,
        });
        this.#publish();
    }
}
