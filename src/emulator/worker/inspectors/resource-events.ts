import {
    type ResourceFile,
    type ResourceLoadEvent,
} from "../../common/inspector";
import {type GuestMemoryReader} from "./memory";
import {readResourceMaps} from "./resources";
import {type HFSPathResolver} from "./hfs-paths";

export type LoadedResource = {type: number; id: number; reference: number};

// One immutable capture per source file/type/ID for this emulator session.
// Seen identities outlive both the map cache and UI event-buffer eviction.
export class ResourceEventCapture {
    #nextId = 0;
    #seen = new Set<string>();
    // When a map is absent, only the validated allocation and executing process
    // are known. Do not merge unrelated unknown resources solely by type/ID.
    #unattributed = new Set<string>();
    #wasSeen = (file: ResourceFile, type: string, id: number) =>
        this.#seen.has(resourceIdentity(file.key, type, id));
    #maps = new Map<
        number,
        {identity: string; bytes: Uint8Array; handles: Map<number, string>}
    >();
    #mapBytes = 0;
    constructor(private paths?: HFSPathResolver) {}

    capture(
        memory: GuestMemoryReader,
        source: string,
        now = Date.now(),
        loadedHandle?: number,
        pc?: number,
        loaded?: LoadedResource
    ): ResourceLoadEvent[] {
        // Capture all bytes now. Never reconstruct an old event from live RAM.
        let parsed: ReturnType<typeof readResourceMaps>;
        try {
            parsed = readResourceMaps(
                memory,
                now,
                undefined,
                true,
                loaded && {
                    reference: memory.normalize(loaded.reference),
                    type: resourceTypeName(loaded.type),
                    id: loaded.id,
                },
                loadedHandle
                    ? undefined
                    : (handle, base, size, identity) => {
                          const prior = this.#maps.get(handle);
                          if (
                              !prior ||
                              prior.identity !== identity ||
                              prior.bytes.length !== size
                          )
                              return false;
                          const bytes = memory.bytes(base, size);
                          for (let i = 0; i < size; i++)
                              if (bytes[i] !== prior.bytes[i]) return false;
                          // Master pointers and heap headers live outside the map.
                          // Checking them catches purge/reload and block reuse even
                          // when the resource reference entries have not changed.
                          for (const [handle, signature] of prior.handles)
                              if (handleSignature(memory, handle) !== signature)
                                  return false;
                          return true;
                      },
                this.#wasSeen
            );
            if (
                loaded &&
                !parsed.some(p =>
                    [...p.references].some(
                        ([key, reference]) =>
                            reference === memory.normalize(loaded.reference) &&
                            (p.data.has(key) ||
                                this.#seen.has(
                                    resourceIdentity(
                                        p.file.key,
                                        resourceTypeName(loaded.type),
                                        loaded.id
                                    )
                                ))
                    )
                )
            ) {
                // Invalid/ROM-backed loader handles should not hide other
                // resources that the conservative scan could still capture.
                parsed = readResourceMaps(
                    memory,
                    now,
                    undefined,
                    true,
                    undefined,
                    undefined,
                    this.#wasSeen
                );
            }
        } catch (error) {
            if (!loaded) throw error;
            // A loader can run while the map chain is in transition. Preserve
            // the verified handle anyway, with explicitly unknown provenance.
            parsed = [];
        }
        const events: ResourceLoadEvent[] = [];
        let processName = "";
        try {
            processName = memory.pstring(0x910, 31);
        } catch {
            /* Unknown application. */
        }
        for (const p of parsed) {
            const location = p.file as typeof p.file & {
                volumeName?: string;
                parentID?: number;
            };
            let resolvedPath = false;
            for (const t of p.file.types)
                for (const resource of t.resources) {
                    const data = p.data.get(resource.key);
                    const handle = p.handles.get(resource.key) ?? 0;
                    if (!data) continue;
                    const direct =
                        loadedHandle !== undefined &&
                        handle === memory.normalize(loadedHandle) &&
                        (!loaded ||
                            p.references.get(resource.key) ===
                                memory.normalize(loaded.reference));
                    const identity = resourceIdentity(
                        p.file.key,
                        t.type,
                        resource.id
                    );
                    if (this.#seen.has(identity)) continue;
                    if (
                        !resolvedPath &&
                        location.volumeName &&
                        location.parentID !== undefined
                    ) {
                        Object.assign(
                            p.file,
                            this.paths?.resolve(
                                location.volumeName,
                                location.parentID,
                                p.file.name
                            )
                        );
                        resolvedPath = true;
                    }
                    const id = ++this.#nextId;
                    const key = `event-${id}`;
                    const {types: _, ...file} = p.file;
                    const maskType = t.type.startsWith("icl")
                        ? "ICN#"
                        : t.type.startsWith("ics")
                          ? "ics#"
                          : undefined;
                    events.push({
                        id,
                        capturedAt: now,
                        kind: direct ? "load" : "observed",
                        source,
                        processName,
                        pointerBits: memory.pointerBits,
                        pc,
                        file,
                        type: t.type,
                        resource: {
                            ...resource,
                            key,
                            resident: false,
                            cached: true,
                        },
                        detail: {
                            key,
                            data: data.data.slice(),
                            size: data.size,
                            capturedAt: now,
                            cached: true,
                            mask: maskType
                                ? captureMask(
                                      memory,
                                      p.references.get(
                                          `${maskType}:${resource.id}`
                                      )
                                  )
                                : undefined,
                        },
                    });
                    // Failed reads never reserve an identity. Only remember it
                    // after the event owns its immutable bytes.
                    this.#seen.add(identity);
                }
            if (!loaded) {
                const block = memory.handle(p.mapHandle)!;
                const bytes = memory.bytes(block.address, block.size).slice();
                this.#mapBytes -=
                    this.#maps.get(p.mapHandle)?.bytes.length ?? 0;
                this.#maps.delete(p.mapHandle);
                this.#maps.set(p.mapHandle, {
                    identity: `${p.mapHandle}:${p.file.refNum}:${p.file.name}:${location.volumeName ?? ""}:${location.parentID ?? ""}`,
                    bytes,
                    handles: new Map(
                        // Only uncaptured resources need residency monitoring.
                        // Reloading an already captured handle is irrelevant.
                        [...p.handles]
                            .filter(
                                ([key, handle]) => handle && !p.data.has(key)
                            )
                            .map(([, h]) => [h, handleSignature(memory, h)])
                    ),
                });
                this.#mapBytes += bytes.length;
            }
        }
        try {
            if (
                loadedHandle &&
                loaded &&
                !parsed.some(
                    p =>
                        p.references.get(
                            `${resourceTypeName(loaded.type)}:${loaded.id}`
                        ) === memory.normalize(loaded.reference) &&
                        this.#wasSeen(
                            p.file,
                            resourceTypeName(loaded.type),
                            loaded.id
                        )
                )
            ) {
                const reference = memory.normalize(loaded.reference);
                if (
                    memory.pointer(reference + 8) ===
                        memory.normalize(loadedHandle) &&
                    memory.i16(reference) === loaded.id
                ) {
                    const identity = JSON.stringify([
                        processName,
                        reference,
                        memory.normalize(loadedHandle),
                        loaded.type >>> 0,
                        loaded.id,
                        handleSignature(memory, loadedHandle),
                    ]);
                    // Avoid even the borrowed payload read on repeat callbacks.
                    const block = this.#unattributed.has(identity)
                        ? undefined
                        : memory.handle(loadedHandle);
                    if (block) {
                        const id = ++this.#nextId;
                        const key = `event-${id}`;
                        const type = resourceTypeName(loaded.type);
                        events.push({
                            id,
                            capturedAt: now,
                            kind: "load",
                            source,
                            processName,
                            pointerBits: memory.pointerBits,
                            pc,
                            file: {
                                key: "unattributed",
                                name: "Source unavailable",
                                refNum: 0,
                                system: false,
                                current: false,
                                lastSeen: now,
                            },
                            type,
                            resource: {
                                key,
                                id: loaded.id,
                                attributes: memory.u8(reference + 4),
                                resident: false,
                                cached: true,
                                size: block.size,
                            },
                            detail: {
                                key,
                                data: memory
                                    .bytes(block.address, block.size)
                                    .slice(),
                                size: block.size,
                                capturedAt: now,
                                cached: true,
                            },
                        });
                        this.#unattributed.add(identity);
                    }
                }
            }
        } catch {
            // Invalid or ROM-backed loader handles must not discard other
            // valid resources discovered in this same observation.
        }
        while (this.#maps.size > 1024 || this.#mapBytes > 8 * 1024 * 1024) {
            const key = this.#maps.keys().next().value!;
            this.#mapBytes -= this.#maps.get(key)!.bytes.length;
            this.#maps.delete(key);
        }
        return events;
    }
}

function resourceIdentity(fileKey: string, type: string, id: number) {
    return JSON.stringify([fileKey, type, id]);
}

function captureMask(memory: GuestMemoryReader, reference?: number) {
    if (reference === undefined) return;
    try {
        const block = memory.handle(memory.pointer(reference + 8));
        if (block) return memory.bytes(block.address, block.size).slice();
    } catch {
        // The color resource is useful even when its mask is unavailable.
    }
}

function handleSignature(memory: GuestMemoryReader, handle: number) {
    try {
        const address = memory.pointer(handle);
        if (!address) return "purged";
        const header = address - (memory.pointerBits === 24 ? 8 : 12);
        return `${address}:${memory.u32(header)}:${memory.u32(header + 4)}`;
    } catch {
        return "unavailable";
    }
}

function resourceTypeName(type: number) {
    return String.fromCharCode(
        ...[24, 16, 8, 0].map(shift => (type >>> shift) & 255)
    );
}

export function resourceCallName(source: number) {
    if (source === 0x7f0) return "Resource loader";
    const names: Record<number, string> = {
        0xa999: "UpdateResFile",
        0xa9ab: "AddResource",
        0xa9ad: "RemoveResource",
        0xa9b0: "WriteResource",
        0xa985: "Alert",
        0xa986: "StopAlert",
        0xa987: "NoteAlert",
        0xa988: "CautionAlert",
        0xaa46: "GetNewCWindow",
        0xa80c: "RGetResource",
        0xa822: "ResourceDispatch",
        0xaa0c: "GetPixPat",
        0xaa1b: "GetCCursor",
        0xa997: "OpenResFile",
        0xa998: "UseResFile",
        0xa99a: "CloseResFile",
        0xa99b: "SetResLoad",
        0xa99c: "CountResources",
        0xa99d: "GetIndResource",
        0xa9a0: "GetResource",
        0xa9a1: "GetNamedResource",
        0xa9a2: "LoadResource",
        0xa9a3: "ReleaseResource",
        0xa992: "DetachResource",
        0xa81f: "Get1Resource",
        0xa80d: "Count1Resources",
        0xa80e: "Get1IndResource",
        0xa820: "Get1NamedResource",
        0xa9c4: "OpenRFPerm",
        0xa81a: "HOpenResFile",
        0xa9bc: "GetPicture",
        0xa9bd: "GetNewWindow",
        0xa9be: "GetNewControl",
        0xa9bf: "GetMenu",
        0xa9c0: "GetNewMBar",
        0xa97c: "GetNewDialog",
        0xa9bb: "GetIcon",
        0xaa1e: "GetCIcon",
        0xa9b8: "GetPattern",
        0xa9b9: "GetCursor",
        0xa9ba: "GetString",
    };
    return names[source & 0xfbff] ?? `Trap $${source.toString(16)}`;
}
