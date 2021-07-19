import {
    EmulatorWorkerInputConfig,
    InputBufferAddresses,
    LockStates,
} from "./emulator-common";

export class EmulatorWorkerInput {
    #inputBufferView: Int32Array;

    constructor(config: EmulatorWorkerInputConfig) {
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
        // reset
        this.#inputBufferView[InputBufferAddresses.mouseMoveFlagAddr] = 0;
        this.#inputBufferView[InputBufferAddresses.mouseMoveXDeltaAddr] = 0;
        this.#inputBufferView[InputBufferAddresses.mouseMoveYDeltaAddr] = 0;
        this.#inputBufferView[InputBufferAddresses.mouseButtonStateAddr] = 0;
        this.#inputBufferView[InputBufferAddresses.keyEventFlagAddr] = 0;
        this.#inputBufferView[InputBufferAddresses.keyCodeAddr] = 0;
        this.#inputBufferView[InputBufferAddresses.keyStateAddr] = 0;

        releaseCyclicalLock(
            this.#inputBufferView,
            InputBufferAddresses.globalLockAddr
        );
    }

    getInputValue(addr: number) {
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
