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
export type EmulatorTouchEvent = {type: "touchstart"; dx: number; dy: number};
export type EmulatorKeyboardEvent = {
    type: "keydown" | "keyup";
    keyCode: number;
};

export type EmulatorInputEvent =
    | EmulatorMouseEvent
    | EmulatorTouchEvent
    | EmulatorKeyboardEvent;

export enum LockStates {
    READY_FOR_UI_THREAD,
    UI_THREAD_LOCK,
    READY_FOR_EMUL_THREAD,
    EMUL_THREAD_LOCK,
}

export type EmulatorChunkedFileSpec = {
    baseUrl: string;
    totalSize: number;
    chunkCount: number;
    chunkSize: number;
    version: string;
    prefetchChunks: number[];
};

export function generateChunkUrl(
    spec: EmulatorChunkedFileSpec,
    chunk: number
): string {
    return `${spec.baseUrl}.${chunk}.br?v=${spec.version}`;
}

export type EmulatorWorkerConfig = {
    jsUrl: string;
    wasmUrl: string;
    disk: EmulatorChunkedFileSpec;
    autoloadFiles: {[name: string]: ArrayBuffer};
    arguments: string[];
    video: EmulatorWorkerVideoConfig;
    input: EmulatorWorkerInputConfig;
    audio: EmulatorWorkerAudioConfig;
    files: EmulatorWorkerFilesConfig;
    enableExtractor: boolean;
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

export type EmulatorWorkerFilesConfig =
    | EmulatorWorkerSharedMemoryFilesConfig
    | EmulatorWorkerFallbackFilesConfig;

export type EmulatorWorkerSharedMemoryFilesConfig = {
    type: "shared-memory";
    filesBuffer: SharedArrayBuffer;
    filesBufferSize: number;
};

export type EmulatorFileActions = {
    uploads: EmulatorFileUpload[];
};

export type EmulatorWorkerFallbackFilesConfig = {
    type: "fallback";
};

export type EmulatorFileUpload = {name: string; url: string; size: number};

export type EmulatorFallbackCommand =
    | EmulatorFallbackInputCommand
    | EmulatorFallbackUploadFileCommand;

export type EmulatorFallbackInputCommand = {
    type: "input";
    event: EmulatorInputEvent;
};

export type EmulatorFallbackUploadFileCommand = {
    type: "upload_file";
    upload: EmulatorFileUpload;
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
    const remainingEvents: EmulatorInputEvent[] = [];
    for (const inputEvent of inputEvents) {
        switch (inputEvent.type) {
            case "touchstart":
                // We need to make sure that the mouse is first moved to the
                // current location and then we send the mousedown, otherwise
                // the Mac thinks that the mouse was moved with the button down,
                // and interprets it as a drag.
                hasMouseMove = true;
                mouseMoveX += inputEvent.dx;
                mouseMoveY += inputEvent.dy;
                remainingEvents.push({type: "mousedown"});
                break;
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
                    remainingEvents.push(inputEvent);
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
    return remainingEvents;
}
export type EmulatorWorkerDirectorExtractionEntry =
    | {
          name: string;
          contents: Uint8Array;
      }
    | {name: string; contents: EmulatorWorkerDirectorExtractionEntry[]};

export type EmulatorWorkerDirectorExtraction = {
    name: string;
    contents: EmulatorWorkerDirectorExtractionEntry[];
};
