import type {
    EmulatorInputEvent,
    EmulatorWorkerFallbackInputConfig,
    EmulatorWorkerInputConfig,
    EmulatorWorkerSharedMemoryInputConfig,
} from "./emulator-common";
import {
    updateInputBufferWithEvents,
    InputBufferAddresses,
    LockStates,
} from "./emulator-common";
import type {EmulatorFallbackCommandSender} from "./emulator-ui";

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
        this.#inputQueue = updateInputBufferWithEvents(
            this.#inputQueue,
            this.#inputBufferView
        );
        this.#releaseInputLock();
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
    ) as LockStates;
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
    #commandSender: EmulatorFallbackCommandSender;

    constructor(commandSender: EmulatorFallbackCommandSender) {
        this.#commandSender = commandSender;
    }
    workerConfig(): EmulatorWorkerFallbackInputConfig {
        return {type: "fallback", inputBufferSize: INPUT_BUFFER_SIZE};
    }

    handleInput(inputEvent: EmulatorInputEvent): void {
        this.#commandSender({type: "input", event: inputEvent});
    }
}
