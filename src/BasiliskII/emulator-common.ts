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

export type EmulatorMouseEvent =
    | {type: "mousemove"; dx: number; dy: number}
    | {type: "mousedown"}
    | {type: "mouseup"};
export type EmulatorKeyboardEvent = {
    type: "keydown" | "keyup";
    keyCode: number;
};

export type EmulatorInputEvent = EmulatorMouseEvent | EmulatorKeyboardEvent;

export enum LockStates {
    READY_FOR_UI_THREAD,
    UI_THREAD_LOCK,
    READY_FOR_EMUL_THREAD,
    EMUL_THREAD_LOCK,
}

export type EmulatorWorkerConfig = {
    autoloadFiles: {[name: string]: string};
    arguments: string[];
    video: EmulatorWorkerVideoConfig;
    input: EmulatorWorkerInputConfig;
    audio: EmulatorWorkerAudioConfig;
};

export type EmulatorWorkerVideoConfig =
    | EmulatorWorkerSharedMemoryVideoConfig
    | EmulatorWorkerFallbackVideoConfig;

export type EmulatorWorkerSharedMemoryVideoConfig = {
    type: "shared-memory";
    screenBuffer: SharedArrayBuffer;
    screenBufferSize: number;
    videoModeBuffer: SharedArrayBuffer;
    videoModeBufferSize: number;
    screenWidth: number;
    screenHeight: number;
};

export type EmulatorWorkerFallbackVideoConfig = {type: "fallback"};

export type EmulatorWorkerInputConfig =
    | EmulatorWorkerSharedMemoryInputConfig
    | EmulatorWorkerFallbackInputConfig;

export type EmulatorWorkerSharedMemoryInputConfig = {
    type: "shared-memory";
    inputBuffer: SharedArrayBuffer;
    inputBufferSize: number;
};

export type EmulatorWorkerFallbackInputConfig = {type: "fallback"};

export type EmulatorWorkerAudioConfig =
    | EmulatorWorkerSharedMemoryAudioConfig
    | EmulatorWorkerFallbackAudioConfig;

export type EmulatorWorkerSharedMemoryAudioConfig = {
    type: "shared-memory";
    audioDataBuffer: SharedArrayBuffer;
    audioDataBufferSize: number;
    audioBlockBufferSize: number;
    audioBlockChunkSize: number;
};

export type EmulatorWorkerFallbackAudioConfig = {type: "fallback"};
