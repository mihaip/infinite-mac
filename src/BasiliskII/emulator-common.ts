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
    inputBuffer: SharedArrayBuffer;
    inputBufferSize: number;
    screenBuffer: SharedArrayBuffer;
    screenBufferSize: number;
    videoModeBuffer: SharedArrayBuffer;
    videoModeBufferSize: number;
    screenWidth: number;
    screenHeight: number;
    audio: EmulatorWorkerAudioConfig;
};

export type EmulatorWorkerAudioConfig = {
    audioDataBuffer: SharedArrayBuffer;
    audioDataBufferSize: number;
    audioBlockBufferSize: number;
    audioBlockChunkSize: number;
};
