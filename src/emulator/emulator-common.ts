export type EmulatorType = "BasiliskII" | "SheepShaver" | "Mini vMac";

export type EmulatorSubtype = "128K" | "512Ke" | "Plus" | "SE" | "II";

export type EmulatorCpu =
    | "68000"
    | "68020"
    | "68030"
    | "68040"
    | "601"
    | "603"
    | "604"
    | "G3";

export function emulatorHandlesDiskImages(type: EmulatorType): boolean {
    return type === "Mini vMac";
}

export function emulatorSupportsSpeedSetting(type: EmulatorType): boolean {
    return type === "Mini vMac";
}

export function emulatorSupportsAppleTalk(type: EmulatorType): boolean {
    return type === "BasiliskII" || type === "SheepShaver";
}

export function emulatorCpuId(
    type: EmulatorType,
    cpu: EmulatorCpu
): number | undefined {
    if (type !== "BasiliskII") {
        return undefined;
    }
    switch (cpu) {
        case "68020":
            return 2;
        case "68030":
            return 3;
        case "68040":
            return 4;
        default:
            return undefined;
    }
}

export function emulatorModelId(
    type: EmulatorType,
    gestaltID: number
): number | undefined {
    if (type !== "BasiliskII") {
        return undefined;
    }
    return gestaltID - 6;
}

// -2 is a special value meaning the default that Mini vMac was built with,
// other values are what it uses in CONTROLM.h for speeds.
export type EmulatorSpeed = -2 | 0 | 1 | 2 | 3 | 4 | 5 | -1;

export const EMULATOR_SPEEDS = new Map<EmulatorSpeed, string>([
    [-2, "Default"],
    [0, "1x"],
    [1, "2x"],
    [2, "4x"],
    [3, "8x"],
    [4, "16x"],
    [5, "32x"],
    [-1, "All Out"],
]);

export const InputBufferAddresses = {
    globalLockAddr: 0,
    mousePositionFlagAddr: 1,
    mousePositionXAddr: 2,
    mousePositionYAddr: 3,
    mouseButtonStateAddr: 4,
    keyEventFlagAddr: 5,
    keyCodeAddr: 6,
    keyStateAddr: 7,
    stopFlagAddr: 8,
    ethernetInterruptFlagAddr: 9,
    audioContextRunningFlagAddr: 10,
    speedFlagAddr: 11,
    speedAddr: 12,
};

export type EmulatorMouseEvent =
    | {type: "mousemove"; x: number; y: number}
    | {type: "mousedown"}
    | {type: "mouseup"};
export type EmulatorTouchEvent = {type: "touchstart"; x: number; y: number};
export type EmulatorKeyboardEvent = {
    type: "keydown" | "keyup";
    keyCode: number;
};
export type EmulatorStopEvent = {
    type: "stop";
};

export type EmulatorStartEvent = {
    type: "start";
};

export type EmulatorEthernetInterruptEvent = {
    type: "ethernet-interrupt";
};

export type EmulatorAudioContextRunningEvent = {
    type: "audio-context-running";
};

export type EmulatorSetSpeedEvent = {
    type: "set-speed";
    speed: EmulatorSpeed;
};

export type EmulatorInputEvent =
    | EmulatorMouseEvent
    | EmulatorTouchEvent
    | EmulatorKeyboardEvent
    | EmulatorStopEvent
    | EmulatorStartEvent
    | EmulatorEthernetInterruptEvent
    | EmulatorAudioContextRunningEvent
    | EmulatorSetSpeedEvent;

export enum LockStates {
    READY_FOR_UI_THREAD,
    UI_THREAD_LOCK,
    READY_FOR_EMUL_THREAD,
    EMUL_THREAD_LOCK,
}

export type EmulatorChunkedFileSpec = {
    name: string;
    baseUrl: string;
    totalSize: number;
    chunks: string[];
    chunkSize: number;
    prefetchChunks: number[];
};

export function generateChunkUrl(
    spec: EmulatorChunkedFileSpec,
    chunk: number
): string {
    // Includ the chunk number in the URL so that we can easily generate the
    // next chunk URL. By having it in the hash we should still allow chunks
    // that have the same content hash still be an HTTP cache hit.
    return `${spec.baseUrl}/${spec.chunks[chunk]}.chunk#${chunk}`;
}

export function generateNextChunkUrl(
    url: string,
    specs: EmulatorChunkedFileSpec[]
): string {
    const match = url.match(/.*\/([0-9a-f]+)\.chunk#(\d+)$/);
    if (!match) {
        throw new Error(`Could not parse chunk URL ${url}`);
    }
    const [chunkSignature, chunkStr] = match.slice(1);
    const chunk = parseInt(chunkStr, 10);
    const spec = specs.find(spec => spec.chunks[chunk] === chunkSignature);
    if (!spec) {
        throw new Error(`Could not find spec that served ${url}`);
    }
    return generateChunkUrl(spec, chunk + 1);
}

export type EmulatorWorkerConfig = {
    jsUrl: string;
    wasmUrl: string;
    disks: EmulatorChunkedFileSpec[];
    diskImages: EmulatorDiskImage[];
    autoloadFiles: {[name: string]: ArrayBuffer};
    persistedData?: EmulatorWorkerDirectorExtraction;
    arguments: string[];
    video: EmulatorWorkerVideoConfig;
    input: EmulatorWorkerInputConfig;
    audio: EmulatorWorkerAudioConfig;
    files: EmulatorWorkerFilesConfig;
    ethernet: EmulatorWorkerEthernetConfig;
    clipboard: EmulatorWorkerClipboardConfig;
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

export type EmulatorWorkerVideoBlitRect = {
    top: number;
    left: number;
    bottom: number;
    right: number;
};
export type EmulatorWorkerSharedMemoryVideoBlit = {
    type: "shared-memory";
    rect?: EmulatorWorkerVideoBlitRect;
};

export type EmulatorWorkerFallbackVideoBlit = {
    type: "fallback";
    data: Uint8Array;
    rect?: EmulatorWorkerVideoBlitRect;
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
    audioBuffer: SharedArrayBuffer;
};

export type EmulatorWorkerFallbackAudioConfig = {type: "fallback"};

export type EmulatorAudioProcessorOptions = {
    sampleSize: number;
    debug: boolean;
    config: EmulatorWorkerAudioConfig;
};

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

export type EmulatorWorkerEthernetConfig =
    | EmulatorWorkerSharedMemoryEthernetConfig
    | EmulatorWorkerFallbackEthernetConfig;

export type EmulatorWorkerSharedMemoryEthernetConfig = {
    type: "shared-memory";
    receiveBuffer: SharedArrayBuffer;
};

export type EmulatorWorkerFallbackEthernetConfig = {
    type: "fallback";
};

export type EmulatorWorkerClipboardConfig =
    | EmulatorWorkerSharedMemoryClipboardConfig
    | EmulatorWorkerFallbackClipboardConfig;

export type EmulatorWorkerSharedMemoryClipboardConfig = {
    type: "shared-memory";
    clipboardBuffer: SharedArrayBuffer;
    clipboardBufferSize: number;
};

export type EmulatorClipboardData = {
    text?: string;
};

export type EmulatorWorkerFallbackClipboardConfig = {
    type: "fallback";
};

export type EmulatorFileUpload = {name: string; url: string; size: number};

export type EmulatorDiskImage = EmulatorFileUpload;

export type EmulatorFallbackCommand =
    | EmulatorFallbackInputCommand
    | EmulatorFallbackUploadFileCommand
    | EmulatorFallbackEthernetReceiveCommand
    | EmlatorFallbackSetClipboardDataCommand;

export type EmulatorFallbackInputCommand = {
    type: "input";
    event: EmulatorInputEvent;
};

export type EmulatorFallbackUploadFileCommand = {
    type: "upload_file";
    upload: EmulatorFileUpload;
};

export type EmulatorFallbackEthernetReceiveCommand = {
    type: "ethernet_receive";
    // Needs to be a plain array (as opposed to Uint8Array) to be
    // JSON-serializable.
    packetArray: number[];
};

export type EmlatorFallbackSetClipboardDataCommand = {
    type: "set_clipboard_data";
    data: EmulatorClipboardData;
};

export function updateInputBufferWithEvents(
    inputEvents: EmulatorInputEvent[],
    inputBufferView: Int32Array
): EmulatorInputEvent[] {
    let hasMousePosition = false;
    let mousePositionX = 0;
    let mousePositionY = 0;
    let mouseButtonState = -1;
    let hasKeyEvent = false;
    let keyCode = -1;
    let keyState = -1;
    let hasStop = false;
    let hasStart = false;
    let hasEthernetInterrupt = false;
    let hasAudioContextRunning = false;
    let hasSpeeed = false;
    let speed = -2;
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
                hasMousePosition = true;
                mousePositionX = inputEvent.x;
                mousePositionY = inputEvent.y;
                remainingEvents.push({type: "mousedown"});
                break;
            case "mousemove":
                if (hasMousePosition) {
                    break;
                }
                hasMousePosition = true;
                mousePositionX = inputEvent.x;
                mousePositionY = inputEvent.y;
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
            case "stop":
                hasStop = true;
                break;
            case "start":
                hasStart = true;
                break;
            case "ethernet-interrupt":
                hasEthernetInterrupt = true;
                break;
            case "audio-context-running":
                hasAudioContextRunning = true;
                break;
            case "set-speed":
                hasSpeeed = true;
                speed = inputEvent.speed;
        }
    }
    if (hasMousePosition) {
        inputBufferView[InputBufferAddresses.mousePositionFlagAddr] = 1;
        inputBufferView[InputBufferAddresses.mousePositionXAddr] =
            mousePositionX;
        inputBufferView[InputBufferAddresses.mousePositionYAddr] =
            mousePositionY;
    }
    inputBufferView[InputBufferAddresses.mouseButtonStateAddr] =
        mouseButtonState;
    if (hasKeyEvent) {
        inputBufferView[InputBufferAddresses.keyEventFlagAddr] = 1;
        inputBufferView[InputBufferAddresses.keyCodeAddr] = keyCode;
        inputBufferView[InputBufferAddresses.keyStateAddr] = keyState;
    }
    if (hasStop) {
        inputBufferView[InputBufferAddresses.stopFlagAddr] = 1;
    }
    if (hasStart) {
        inputBufferView[InputBufferAddresses.stopFlagAddr] = 0;
    }
    inputBufferView[InputBufferAddresses.ethernetInterruptFlagAddr] =
        hasEthernetInterrupt ? 1 : 0;
    if (hasAudioContextRunning) {
        inputBufferView[InputBufferAddresses.audioContextRunningFlagAddr] = 1;
    }
    if (hasSpeeed) {
        inputBufferView[InputBufferAddresses.speedFlagAddr] = 1;
        inputBufferView[InputBufferAddresses.speedAddr] = speed;
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

export function isDiskImageFile(name: string): boolean {
    return (
        name.endsWith(".iso") ||
        name.endsWith(".dsk") ||
        name.endsWith(".img") ||
        name.endsWith(".toast") ||
        name.endsWith(".cdr") ||
        name.endsWith(".smi")
    );
}

export function ethernetMacAddressToString(mac: Uint8Array) {
    return Array.from(mac)
        .map(b => b.toString(16).padStart(2, "0"))
        .join(":");
}

export function ethernetMacAddressFromString(mac: string) {
    return new Uint8Array(mac.split(":").map(s => parseInt(s, 16)));
}

export const ETHERNET_PING_HEADER = [112, 105, 110, 103, 80, 73, 78, 71]; // pingPING
export const ETHERNET_PING_PAYLOAD_LENGTH = ETHERNET_PING_HEADER.length + 4;
export const ETHERNET_PING_PACKET_LENGTH =
    6 + 6 + 2 + ETHERNET_PING_PAYLOAD_LENGTH;
export const ETHERNET_PONG_HEADER = [112, 105, 110, 103, 80, 79, 78, 71, 33]; // pingPONG!
export const ETHERNET_PONG_PAYLOAD_LENGTH = ETHERNET_PONG_HEADER.length + 4;
export const ETHERNET_PONG_PACKET_LENGTH =
    6 + 6 + 2 + ETHERNET_PONG_PAYLOAD_LENGTH;
