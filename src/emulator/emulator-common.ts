import {
    type EmulatorSpeed,
    type EmulatorSubtype,
    type EmulatorType,
} from "./emulator-common-emulators";

export const InputBufferAddresses = {
    globalLockAddr: 0,

    mousePositionFlagAddr: 1,
    mousePositionXAddr: 2,
    mousePositionYAddr: 3,
    mouseButtonStateAddr: 4,
    mouseButton2StateAddr: 16,
    mouseDeltaXAddr: 13,
    mouseDeltaYAddr: 14,

    keyEventFlagAddr: 5,
    keyCodeAddr: 6,
    keyStateAddr: 7,
    keyModifiersAddr: 15,

    stopFlagAddr: 8,
    ethernetInterruptFlagAddr: 9,
    audioContextRunningFlagAddr: 10,

    speedFlagAddr: 11,
    speedAddr: 12,

    useMouseDeltasFlagAddr: 17,
    useMouseDeltasAddr: 18,
};

export type EmulatorMouseEvent =
    | {type: "mousemove"; x: number; y: number; deltaX: number; deltaY: number}
    | {type: "mousedown"; button: number}
    | {type: "mouseup"; button: number};
export type EmulatorKeyboardEvent = {
    type: "keydown" | "keyup";
    keyCode: number;
    modifiers?: number;
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

export type EmulatorSetUseMouseDeltas = {
    type: "set-use-mouse-deltas";
    useMouseDeltas: boolean;
};

export type EmulatorInputEvent =
    | EmulatorMouseEvent
    | EmulatorKeyboardEvent
    | EmulatorStopEvent
    | EmulatorStartEvent
    | EmulatorEthernetInterruptEvent
    | EmulatorAudioContextRunningEvent
    | EmulatorSetSpeedEvent
    | EmulatorSetUseMouseDeltas;

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
    persistent?: boolean;
    isFloppy?: boolean;
};

export function generateChunkUrl(
    spec: Pick<EmulatorChunkedFileSpec, "baseUrl" | "chunks">,
    chunk: number
): string {
    // Include the chunk number in the URL so that we can easily generate the
    // next chunk URL. By having it in the hash we should still allow chunks
    // that have the same content hash (but are at different numbers) to still
    // be an HTTP cache hit.
    return `${spec.baseUrl}/${spec.chunks[chunk]}.chunk#${chunk}`;
}

export function generateNextChunkUrl(
    url: string,
    specs: EmulatorChunkedFileSpec[]
): string | undefined {
    const match = url.match(/.*\/([0-9a-f]+)\.chunk#(\d+)$/);
    if (!match) {
        console.warn(`Could not parse chunk URL ${url}`);
        return undefined;
    }
    const [chunkSignature, chunkStr] = match.slice(1);
    const chunkIndex = parseInt(chunkStr, 10);
    const spec = specs.find(spec => spec.chunks[chunkIndex] === chunkSignature);
    if (!spec) {
        console.warn(`Could not find spec that served ${url}`);
        return undefined;
    }
    if (chunkIndex + 1 >= spec.chunks.length) {
        return undefined;
    }
    const nextChunkSignature = spec.chunks[chunkIndex + 1];
    if (!nextChunkSignature) {
        // Zero-ed out chunk, we don't need to load it.
        return undefined;
    }
    return generateChunkUrl(spec, chunkIndex + 1);
}

export type EmulatorWorkerConfig = {
    emulatorType: EmulatorType;
    emulatorSubtype?: EmulatorSubtype;
    wasm: ArrayBuffer;
    disks: EmulatorChunkedFileSpec[];
    delayedDisks?: EmulatorChunkedFileSpec[];
    diskFiles: EmulatorDiskFile[];
    deviceImageHeader: ArrayBuffer;
    cdroms: EmulatorCDROM[];
    usePlaceholderDisks: boolean;
    autoloadFiles: {[name: string]: ArrayBuffer};
    arguments: string[];
    video: EmulatorWorkerVideoConfig;
    input: EmulatorWorkerInputConfig;
    audio: EmulatorWorkerAudioConfig;
    files: EmulatorWorkerFilesConfig;
    ethernet: EmulatorWorkerEthernetConfig;
    clipboard: EmulatorWorkerClipboardConfig;
    dateOffset: number;
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
    cdroms: EmulatorCDROM[];
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

export type EmulatorDiskFile = EmulatorFileUpload & {
    isCDROM: boolean;
};

export type EmulatorFallbackCommand =
    | EmulatorFallbackInputCommand
    | EmulatorFallbackUploadFileCommand
    | EmulatorFallbackLoadCDROMCommand
    | EmulatorFallbackEthernetReceiveCommand
    | EmulatorFallbackSetClipboardDataCommand;

export type EmulatorFallbackInputCommand = {
    type: "input";
    event: EmulatorInputEvent;
};

export type EmulatorFallbackUploadFileCommand = {
    type: "upload_file";
    upload: EmulatorFileUpload;
};

export type EmulatorFallbackLoadCDROMCommand = {
    type: "load_cdrom";
    cdrom: EmulatorCDROM;
};

export type EmulatorFallbackEthernetReceiveCommand = {
    type: "ethernet_receive";
    // Needs to be a plain array (as opposed to Uint8Array) to be
    // JSON-serializable.
    packetArray: number[];
};

export type EmulatorFallbackSetClipboardDataCommand = {
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
    let mouseDeltaX = 0;
    let mouseDeltaY = 0;
    let mouseButtonState = -1;
    let mouseButton2State = -1;
    let hasKeyEvent = false;
    let keyCode = -1;
    let keyState = -1;
    let keyModifiers = 0;
    let hasStop = false;
    let hasStart = false;
    let hasEthernetInterrupt = false;
    let hasAudioContextRunning = false;
    // currently only one key event can be sent per sync
    // TODO: better key handling code
    const remainingEvents: EmulatorInputEvent[] = [];
    for (const inputEvent of inputEvents) {
        switch (inputEvent.type) {
            case "mousemove":
                if (hasMousePosition) {
                    break;
                }
                hasMousePosition = true;
                mousePositionX = inputEvent.x;
                mousePositionY = inputEvent.y;
                mouseDeltaX = inputEvent.deltaX;
                mouseDeltaY = inputEvent.deltaY;
                break;
            case "mousedown":
            case "mouseup":
                if (inputEvent.button === 2) {
                    mouseButton2State = inputEvent.type === "mousedown" ? 1 : 0;
                } else {
                    mouseButtonState = inputEvent.type === "mousedown" ? 1 : 0;
                }
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
                keyModifiers = inputEvent.modifiers ?? 0;
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
                inputBufferView[InputBufferAddresses.speedFlagAddr] = 1;
                inputBufferView[InputBufferAddresses.speedAddr] =
                    inputEvent.speed;
                break;
            case "set-use-mouse-deltas":
                inputBufferView[
                    InputBufferAddresses.useMouseDeltasFlagAddr
                ] = 1;
                inputBufferView[InputBufferAddresses.useMouseDeltasAddr] =
                    inputEvent.useMouseDeltas ? 1 : 0;
        }
    }
    if (hasMousePosition) {
        inputBufferView[InputBufferAddresses.mousePositionFlagAddr] = 1;
        inputBufferView[InputBufferAddresses.mousePositionXAddr] =
            mousePositionX;
        inputBufferView[InputBufferAddresses.mousePositionYAddr] =
            mousePositionY;
        inputBufferView[InputBufferAddresses.mouseDeltaXAddr] = mouseDeltaX;
        inputBufferView[InputBufferAddresses.mouseDeltaYAddr] = mouseDeltaY;
    }
    inputBufferView[InputBufferAddresses.mouseButtonStateAddr] =
        mouseButtonState;
    inputBufferView[InputBufferAddresses.mouseButton2StateAddr] =
        mouseButton2State;
    if (hasKeyEvent) {
        inputBufferView[InputBufferAddresses.keyEventFlagAddr] = 1;
        inputBufferView[InputBufferAddresses.keyCodeAddr] = keyCode;
        inputBufferView[InputBufferAddresses.keyStateAddr] = keyState;
        inputBufferView[InputBufferAddresses.keyModifiersAddr] = keyModifiers;
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

export const diskImageExtensions = [
    ".iso",
    ".hda",
    ".dsk",
    ".img",
    ".image",
    ".toast",
    ".cdr",
    ".smi",
];

export function isDiskImageFile(name: string): boolean {
    name = name.toLowerCase();
    return diskImageExtensions.some(ext => name.endsWith(ext));
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

export type EmulatorCDROM = {
    name: string;
    srcUrl: string;
    fileSize: number;
    coverImageHash?: string;
    coverImageSize?: [width: number, height: number];
    coverImageType?: "square" | "round"; // Default is round
    mode?: "MODE1/2352"; // TODO: other modes
    platform?: "Macintosh" | "NeXT";
    fetchClientSide?: boolean;
};

export type EmulatorCDROMLibrary = {[path: string]: EmulatorCDROM};
