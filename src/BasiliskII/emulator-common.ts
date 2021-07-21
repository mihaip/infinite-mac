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

export type EmulatorWorkerVideoBlit =
    | EmulatorWorkerSharedMemoryVideoBlit
    | EmulatorWorkerFallbackVideoBlit;

export type EmulatorWorkerSharedMemoryVideoBlit = {
    type: "shared-memory";
};

export type EmulatorWorkerFallbackVideoBlit = {
    type: "fallback";
    data: Uint8Array;
    width: number;
    height: number;
    depth: number;
    usingPalette: number;
};

export type EmulatorWorkerInputConfig =
    | EmulatorWorkerSharedMemoryInputConfig
    | EmulatorWorkerFallbackInputConfig;

export type EmulatorWorkerSharedMemoryInputConfig = {
    type: "shared-memory";
    inputBuffer: SharedArrayBuffer;
    inputBufferSize: number;
};

export type EmulatorWorkerFallbackInputConfig = {
    type: "fallback";
    inputBufferSize: number;
};

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

export type EmulatorFallbackCommand = EmulatorFallbackInputCommand;

export type EmulatorFallbackInputCommand = {
    type: "input";
    event: EmulatorInputEvent;
};

export function updateInputBufferWithEvents(
    inputEvents: EmulatorInputEvent[],
    inputBufferView: Int32Array
): EmulatorInputEvent[] {
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
    for (const inputEvent of inputEvents) {
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
    if (hasMouseMove) {
        inputBufferView[InputBufferAddresses.mouseMoveFlagAddr] = 1;
        inputBufferView[InputBufferAddresses.mouseMoveXDeltaAddr] = mouseMoveX;
        inputBufferView[InputBufferAddresses.mouseMoveYDeltaAddr] = mouseMoveY;
    }
    inputBufferView[InputBufferAddresses.mouseButtonStateAddr] =
        mouseButtonState;
    if (hasKeyEvent) {
        inputBufferView[InputBufferAddresses.keyEventFlagAddr] = 1;
        inputBufferView[InputBufferAddresses.keyCodeAddr] = keyCode;
        inputBufferView[InputBufferAddresses.keyStateAddr] = keyState;
    }
    return remainingKeyEvents;
}
