// Versioned, read-only inspector protocol. Commands travel through shared memory
// or the service worker because a running Wasm core occupies its worker's loop.
export const INSPECTOR_PROTOCOL_VERSION = 1;
export const INSPECTOR_GRACE_MS = 5 * 60 * 1000;
export const INSPECTOR_CONTROL_BYTES = 4096;
export const INSPECTOR_PREVIEW_COUNT = 64;

export type InspectorId = "resources";
export type InspectorControl = {
    version: 1;
    subscriptions: InspectorId[];
    paused?: boolean;
    resourceKey?: string;
    previewKeys?: string[];
};
export type InspectorWorkerConfig =
    | {type: "shared-memory"; control: SharedArrayBuffer}
    | {type: "fallback"};

export type ResourceInfo = {
    key: string;
    id: number;
    name?: string;
    attributes: number;
    resident: boolean;
    size?: number;
    unavailable?: string;
    cached?: boolean;
};
export type ResourceType = {type: string; resources: ResourceInfo[]};
export type ResourceFile = {
    key: string;
    name: string;
    path?: string;
    directory?: string;
    refNum: number;
    current: boolean;
    system: boolean;
    lastSeen: number;
    recent?: boolean;
    types: ResourceType[];
};
export type ResourceDetail = {
    key: string;
    data: Uint8Array;
    size: number;
    capturedAt: number;
    cached: boolean;
    mask?: Uint8Array;
};
export type ResourceSnapshot = {
    files: ResourceFile[];
    processName: string;
    pointerBits: 24 | 32;
    capturedAt: number;
    detail?: ResourceDetail;
    previews?: ResourceDetail[];
    warning?: string;
};
export type ResourceLoadEvent = {
    id: number;
    capturedAt: number;
    // "load" is a loader callback, not proof of a physical disk read. A
    // callback can return a resident handle. Both paths retain only the first
    // capture of a source file/type/ID in this emulator session.
    kind: "load" | "observed";
    source: string;
    processName: string;
    pointerBits: 24 | 32;
    pc?: number;
    file: Omit<ResourceFile, "types">;
    type: string;
    resource: ResourceInfo;
    detail: ResourceDetail;
};
export const RESOURCE_EVENT_LIMIT = 50_000;
export const RESOURCE_EVENT_BYTES = 256 * 1024 * 1024;

export type InspectorMessage =
    | {type: "inspector_events"; version: 1; events: ResourceLoadEvent[]}
    | {type: "inspector_capabilities"; version: 1; inspectors: InspectorId[]}
    | {
          type: "inspector_snapshot";
          version: 1;
          inspector: "resources";
          sequence: number;
          snapshot: ResourceSnapshot;
          paused?: boolean;
      }
    | {
          type: "inspector_error";
          version: 1;
          inspector: InspectorId;
          error: string;
      };

export type InspectorState = {
    supported: boolean;
    capturing: boolean;
    paused: boolean;
    sequence: number;
    snapshot?: ResourceSnapshot;
    error?: string;
    events?: ResourceLoadEvent[];
    droppedEvents?: number;
};

// A single writer publishes complete desired state, rather than a queue that
// can fill while the guest is paused. A sequence lock prevents torn JSON reads.
export function writeInspectorControl(
    buffer: SharedArrayBuffer,
    control: InspectorControl
) {
    const bytes = new TextEncoder().encode(JSON.stringify(control));
    if (bytes.length > buffer.byteLength - 8)
        throw new Error("Inspector control is too large");
    const header = new Int32Array(buffer, 0, 2);
    Atomics.add(header, 0, 1);
    new Uint8Array(buffer, 8).set(bytes);
    Atomics.store(header, 1, bytes.length);
    Atomics.add(header, 0, 1);
}

export function readInspectorControl(
    buffer: SharedArrayBuffer,
    previousSequence: number
) {
    const header = new Int32Array(buffer, 0, 2);
    const sequence = Atomics.load(header, 0);
    if (sequence === previousSequence || sequence % 2) return undefined;
    const length = Atomics.load(header, 1);
    if (length <= 0 || length > buffer.byteLength - 8) return undefined;
    const bytes = new Uint8Array(buffer, 8, length).slice();
    if (Atomics.load(header, 0) !== sequence) return undefined;
    const control = JSON.parse(
        new TextDecoder().decode(bytes)
    ) as InspectorControl;
    if (control.version !== 1 || !Array.isArray(control.subscriptions))
        return undefined;
    return {sequence, control};
}
