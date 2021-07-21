import type {
    EmulatorInputEvent,
    EmulatorWorkerFallbackInputConfig,
    EmulatorWorkerSharedMemoryInputConfig,
} from "./emulator-common";
import {updateInputBufferWithEvents} from "./emulator-common";
import {InputBufferAddresses, LockStates} from "./emulator-common";
import type {EmulatorFallbackCommandReceiver} from "./emulator-worker";

export interface EmulatorWorkerInput {
    idleWait(timeout: number): void;
    acquireInputLock(): number;
    releaseInputLock(): void;
    getInputValue(addr: number): number;
}

export class SharedMemoryEmulatorWorkerInput implements EmulatorWorkerInput {
    #inputBufferView: Int32Array;

    constructor(config: EmulatorWorkerSharedMemoryInputConfig) {
        this.#inputBufferView = new Int32Array(
            config.inputBuffer,
            0,
            config.inputBufferSize
        );
    }

    idleWait(timeout: number) {
        Atomics.wait(
            this.#inputBufferView,
            InputBufferAddresses.globalLockAddr,
            LockStates.READY_FOR_UI_THREAD,
            // Time out such that we don't miss any frames (giving 2 milliseconds
            // for blit and any CPU emulation to run).
            timeout
        );
    }

    acquireInputLock(): number {
        return tryToAcquireCyclicalLock(
            this.#inputBufferView,
            InputBufferAddresses.globalLockAddr
        );
    }

    releaseInputLock() {
        resetInputBuffer(this.#inputBufferView);

        releaseCyclicalLock(
            this.#inputBufferView,
            InputBufferAddresses.globalLockAddr
        );
    }

    getInputValue(addr: number): number {
        return this.#inputBufferView[addr];
    }
}

function tryToAcquireCyclicalLock(
    bufferView: Int32Array,
    lockIndex: number
): number {
    const res = Atomics.compareExchange(
        bufferView,
        lockIndex,
        LockStates.READY_FOR_EMUL_THREAD,
        LockStates.EMUL_THREAD_LOCK
    );
    if (res === LockStates.READY_FOR_EMUL_THREAD) {
        return 1;
    }
    return 0;
}

function releaseCyclicalLock(bufferView: Int32Array, lockIndex: number) {
    Atomics.store(bufferView, lockIndex, LockStates.READY_FOR_UI_THREAD);
}

export class FallbackEmulatorWorkerInput implements EmulatorWorkerInput {
    #commandReceiver: EmulatorFallbackCommandReceiver;
    #inputBuffer: Int32Array;
    #inputQueue: EmulatorInputEvent[] = [];

    constructor(
        config: EmulatorWorkerFallbackInputConfig,
        commandReceiver: EmulatorFallbackCommandReceiver
    ) {
        this.#commandReceiver = commandReceiver;
        this.#inputBuffer = new Int32Array(config.inputBufferSize);
    }

    idleWait(timeout: number) {
        // Not possible with the fallback mode
    }

    acquireInputLock(): number {
        this.#inputQueue = this.#inputQueue.concat(
            this.#commandReceiver.consumeInputEvents()
        );
        this.#inputQueue = updateInputBufferWithEvents(
            this.#inputQueue,
            this.#inputBuffer
        );
        return 1;
    }

    releaseInputLock(): void {
        resetInputBuffer(this.#inputBuffer);
    }

    getInputValue(addr: number): number {
        return this.#inputBuffer[addr];
    }
}

function resetInputBuffer(inputBuffer: Int32Array) {
    inputBuffer[InputBufferAddresses.mouseMoveFlagAddr] = 0;
    inputBuffer[InputBufferAddresses.mouseMoveXDeltaAddr] = 0;
    inputBuffer[InputBufferAddresses.mouseMoveYDeltaAddr] = 0;
    inputBuffer[InputBufferAddresses.mouseButtonStateAddr] = 0;
    inputBuffer[InputBufferAddresses.keyEventFlagAddr] = 0;
    inputBuffer[InputBufferAddresses.keyCodeAddr] = 0;
    inputBuffer[InputBufferAddresses.keyStateAddr] = 0;
}
