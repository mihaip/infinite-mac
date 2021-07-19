import {
    EmulatorInputEvent,
    EmulatorWorkerFallbackInputConfig,
    EmulatorWorkerInputConfig,
    EmulatorWorkerSharedMemoryInputConfig,
    InputBufferAddresses,
    LockStates,
} from "./emulator-common";

const INPUT_BUFFER_SIZE = 100;

export interface EmulatorInput {
    workerConfig(): EmulatorWorkerInputConfig;
    handleInput(inputEvent: EmulatorInputEvent): void;
}

export class SharedMemoryEmulatorInput implements EmulatorInput {
    #inputBuffer = new SharedArrayBuffer(INPUT_BUFFER_SIZE * 4);
    #inputBufferView = new Int32Array(this.#inputBuffer);
    #inputQueue: EmulatorInputEvent[] = [];

    workerConfig(): EmulatorWorkerSharedMemoryInputConfig {
        return {
            type: "shared-memory",
            inputBuffer: this.#inputBuffer,
            inputBufferSize: INPUT_BUFFER_SIZE,
        };
    }

    handleInput(inputEvent: EmulatorInputEvent) {
        this.#inputQueue.push(inputEvent);
        this.#tryToSendInput();
    }

    #tryToSendInput() {
        if (!this.#inputQueue.length) {
            return;
        }
        if (!this.#acquireInputLock()) {
            this.#tryToSendInputLater();
            return;
        }
        let hasMouseMove = false;
        let mouseMoveX = 0;
        let mouseMoveY = 0;
        let mouseButtonState = -1;
        let hasKeyEvent = false;
        let keyCode = -1;
        let keyState = -1;
        // currently only one key event can be sent per sync
        // TODO: better key handling code
        const remainingKeyEvents = [];
        for (const inputEvent of this.#inputQueue) {
            switch (inputEvent.type) {
                case "mousemove":
                    if (hasMouseMove) {
                        break;
                    }
                    hasMouseMove = true;
                    mouseMoveX += inputEvent.dx;
                    mouseMoveY += inputEvent.dy;
                    break;
                case "mousedown":
                case "mouseup":
                    mouseButtonState = inputEvent.type === "mousedown" ? 1 : 0;
                    break;
                case "keydown":
                case "keyup":
                    if (hasKeyEvent) {
                        remainingKeyEvents.push(inputEvent);
                        break;
                    }
                    hasKeyEvent = true;
                    keyState = inputEvent.type === "keydown" ? 1 : 0;
                    keyCode = inputEvent.keyCode;
                    break;
            }
        }
        const inputBufferView = this.#inputBufferView;
        if (hasMouseMove) {
            inputBufferView[InputBufferAddresses.mouseMoveFlagAddr] = 1;
            inputBufferView[InputBufferAddresses.mouseMoveXDeltaAddr] =
                mouseMoveX;
            inputBufferView[InputBufferAddresses.mouseMoveYDeltaAddr] =
                mouseMoveY;
        }
        inputBufferView[InputBufferAddresses.mouseButtonStateAddr] =
            mouseButtonState;
        if (hasKeyEvent) {
            inputBufferView[InputBufferAddresses.keyEventFlagAddr] = 1;
            inputBufferView[InputBufferAddresses.keyCodeAddr] = keyCode;
            inputBufferView[InputBufferAddresses.keyStateAddr] = keyState;
        }
        this.#releaseInputLock();
        this.#inputQueue = remainingKeyEvents;
        if (this.#inputQueue.length) {
            this.#tryToSendInputLater();
        }
    }

    #tryToSendInputLater() {
        window.setTimeout(() => this.#tryToSendInput(), 0);
    }

    #acquireInputLock(): boolean {
        return acquireLock(
            this.#inputBufferView,
            InputBufferAddresses.globalLockAddr
        );
    }

    #releaseInputLock() {
        releaseLock(this.#inputBufferView, InputBufferAddresses.globalLockAddr);
    }
}

function acquireLock(bufferView: Int32Array, lockIndex: number) {
    const res = Atomics.compareExchange(
        bufferView,
        lockIndex,
        LockStates.READY_FOR_UI_THREAD,
        LockStates.UI_THREAD_LOCK
    );
    if (res === LockStates.READY_FOR_UI_THREAD) {
        return true;
    }
    return false;
}

function releaseLock(bufferView: Int32Array, lockIndex: number) {
    Atomics.store(bufferView, lockIndex, LockStates.READY_FOR_EMUL_THREAD);
    Atomics.notify(bufferView, lockIndex);
}

export class FallbackEmulatorInput implements EmulatorInput {
    workerConfig(): EmulatorWorkerFallbackInputConfig {
        return {type: "fallback"};
    }

    handleInput(inputEvent: EmulatorInputEvent): void {}
}
