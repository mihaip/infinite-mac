export const InputBufferAddresses = {
    globalLockAddr: 0,
    mouseMoveFlagAddr: 1,
    mouseMoveXDeltaAddr: 2,
    mouseMoveYDeltaAddr: 3,
    mouseButtonStateAddr: 4,
    keyEventFlagAddr: 5,
    keyCodeAddr: 6,
    keyStateAddr: 7,
};

export const enum LockStates {
    READY_FOR_UI_THREAD,
    UI_THREAD_LOCK,
    READY_FOR_EMUL_THREAD,
    EMUL_THREAD_LOCK,
}
