import {
    INSPECTOR_GRACE_MS,
    INSPECTOR_PREVIEW_COUNT,
    type ResourceDetail,
    type ResourceFile,
    type ResourceInfo,
    type ResourceSnapshot,
} from "../../common/inspector";
import {type GuestMemoryReader} from "./memory";
import {type HFSPathResolver} from "./hfs-paths";

const MAX_MAPS = 64;
const MAX_RESOURCES = 20000;
const MAX_RESOURCE_BYTES = 256 * 1024;
const MAX_CACHE_BYTES = 8 * 1024 * 1024;

type CapturedData = {
    data: Uint8Array;
    size: number;
    capturedAt: number;
    cached?: boolean;
};

// Short-lived loader observations, reconciled against the next validated map
// walk. Never infer a file identity from a loader callback alone.
export class ResourceLoadHints {
    #data = new Map<string, CapturedData>();
    #bytes = 0;
    record(
        memory: GuestMemoryReader,
        type: number,
        id: number,
        handle: number,
        reference: number,
        now: number
    ) {
        handle = memory.normalize(handle);
        reference = memory.normalize(reference);
        if (
            memory.i16(reference) !== id ||
            memory.pointer(reference + 8) !== handle
        )
            return;
        const block = memory.handle(handle);
        if (!block) return;
        const key = `${reference}:${handle}:${type >>> 0}:${id}`;
        const length = Math.min(block.size, MAX_RESOURCE_BYTES);
        const previous = this.#data.get(key);
        // Bound both allocation and work between normal snapshots.
        if (
            (!previous && this.#data.size >= 256) ||
            this.#bytes - (previous?.data.length ?? 0) + length > 1024 * 1024
        )
            return;
        const data = memory.bytes(block.address, length).slice();
        this.#bytes += length - (previous?.data.length ?? 0);
        this.#data.set(key, {
            data,
            size: block.size,
            capturedAt: now,
            cached: true,
        });
    }
    get(
        reference: number,
        handle: number,
        type: string,
        id: number,
        now: number
    ) {
        let code = 0;
        for (const char of type) code = (code << 8) | char.charCodeAt(0);
        const hint = this.#data.get(
            `${reference}:${handle}:${code >>> 0}:${id}`
        );
        return hint && now - hint.capturedAt <= 1000 ? hint : undefined;
    }
}
type ParsedFile = {
    identity: string;
    file: ResourceFile;
    data: Map<string, CapturedData>;
};

// Pure map walking, separate from transport/history so corrupt-memory fixtures
// exercise the same reader as the live emulator.
export function readResourceMaps(
    memory: GuestMemoryReader,
    now: number,
    hints?: ResourceLoadHints
): ParsedFile[] {
    let mapHandle = memory.pointer(0xa50); // TopMapHndl
    if (!mapHandle) throw new Error("Waiting for the Resource Manager");
    const systemHandle = memory.pointer(0xa54);
    const currentRef = memory.i16(0xa5a);
    const applicationRef = memory.i16(0x900);
    const applicationName = memory.pstring(0x910, 31);
    const files: ParsedFile[] = [];
    const visited = new Set<number>();
    let resourceCount = 0;
    let capturedBytes = 0;
    while (mapHandle) {
        if (visited.has(mapHandle) || visited.size >= MAX_MAPS)
            throw new Error("Resource map chain is cyclic or too long");
        visited.add(mapHandle);
        const block = memory.handle(mapHandle);
        if (!block || block.size < 30)
            throw new Error("Resource map is not resident");
        const {address: base, size} = block;
        const inMap = (offset: number, length: number) => {
            if (offset < 0 || length < 0 || offset + length > size)
                throw new Error("Resource map offset is out of bounds");
            return base + offset;
        };
        const nextHandle = memory.pointer(base + 16);
        const refNum = memory.i16(base + 20);
        const typeOffset = memory.u16(base + 24);
        const nameOffset = memory.u16(base + 26);
        const typeBase = inMap(typeOffset, 2);
        const count = (memory.u16(typeBase) + 1) & 0xffff;
        if (count > 2048) throw new Error("Resource type count is too large");
        inMap(typeOffset + 2, count * 8);
        const system = mapHandle === systemHandle;
        const location = resourceFileLocation(memory, refNum);
        const name =
            location?.name ??
            (system
                ? "System"
                : refNum === applicationRef
                  ? applicationName || "Application"
                  : `Resource file ${refNum}`);
        const identity = `${mapHandle}:${refNum}:${name}`;
        const file: ResourceFile = {
            key: "",
            name,
            ...location,
            refNum,
            system,
            current: refNum === currentRef,
            lastSeen: now,
            types: [],
        };
        const data = new Map<string, CapturedData>();
        for (let t = 0; t < count; t++) {
            const entry = typeBase + 2 + t * 8;
            const type = String.fromCharCode(...memory.bytes(entry, 4));
            const numResources = (memory.u16(entry + 4) + 1) & 0xffff;
            resourceCount += numResources;
            if (resourceCount > MAX_RESOURCES)
                throw new Error("Resource count is too large");
            const refOffset = typeOffset + memory.u16(entry + 6);
            inMap(refOffset, numResources * 12);
            const resources: ResourceInfo[] = [];
            for (let r = 0; r < numResources; r++) {
                const reference = base + refOffset + r * 12;
                const id = memory.i16(reference);
                const resourceNameOffset = memory.u16(reference + 2);
                let resourceName: string | undefined;
                if (resourceNameOffset !== 0xffff) {
                    const nameAddr = inMap(nameOffset + resourceNameOffset, 1);
                    inMap(
                        nameOffset + resourceNameOffset + 1,
                        memory.u8(nameAddr)
                    );
                    resourceName = memory.pstring(nameAddr);
                    if (resourceName.length === 0) resourceName = undefined;
                }
                const key = `${type}:${id}`;
                const resource: ResourceInfo = {
                    key,
                    id,
                    name: resourceName,
                    attributes: memory.u8(reference + 4),
                    resident: false,
                };
                const handle = memory.pointer(reference + 8);
                if (handle) {
                    try {
                        resource.resident = memory.pointer(handle) !== 0;
                        const resourceBlock = memory.handle(handle);
                        if (resourceBlock) {
                            resource.size = resourceBlock.size;
                            const length = Math.min(
                                resourceBlock.size,
                                MAX_RESOURCE_BYTES
                            );
                            if (capturedBytes + length <= MAX_CACHE_BYTES) {
                                data.set(key, {
                                    data: memory
                                        .bytes(resourceBlock.address, length)
                                        .slice(),
                                    size: resourceBlock.size,
                                    capturedAt: now,
                                });
                                capturedBytes += length;
                            } else
                                resource.unavailable =
                                    "Capture memory limit reached";
                        }
                    } catch {
                        resource.unavailable =
                            "Data is outside a valid captured heap block (possibly ROM)";
                    }
                }
                const hint = hints?.get(reference, handle, type, id, now);
                if (
                    hint &&
                    !data.has(key) &&
                    capturedBytes + hint.data.length <= MAX_CACHE_BYTES
                ) {
                    data.set(key, hint);
                    resource.size = hint.size;
                    capturedBytes += hint.data.length;
                }
                resources.push(resource);
            }
            file.types.push({type, resources});
        }
        // Include the catalog shape in identity to detect reuse of a map handle
        // and file reference number. Contents can change without changing IDs.
        files.push({
            identity: `${identity}:${file.types.map(t => `${t.type}=${t.resources.map(r => r.id).join(",")}`).join(";")}`,
            file,
            data,
        });
        mapHandle = nextHandle;
    }
    return files;
}

function resourceFileLocation(
    memory: GuestMemoryReader,
    refNum: number
): {name: string; volumeName?: string; parentID?: number} | undefined {
    // System 7 HFS FCBs: refNum is a byte offset into the FCB table.
    try {
        const recordLength = memory.u16(0x3f6);
        const table = memory.pointer(0x34e);
        if (
            recordLength < 94 ||
            refNum < 2 ||
            (refNum - 2) % recordLength ||
            !table
        )
            return;
        const tableLength = memory.u16(table);
        if (refNum + recordLength > tableLength) return;
        const base = table + refNum;
        const name = memory.pstring(base + 62, 31);
        const volume = memory.pointer(base + 20);
        const volumeName = volume ? memory.pstring(volume + 44, 27) : "";
        if (!name) return;
        return volumeName
            ? {name, volumeName, parentID: memory.u32(base + 58)}
            : {name};
    } catch {
        return undefined;
    }
}

export class ResourceInspector {
    constructor(
        private generation = 0,
        private pathResolver?: HFSPathResolver
    ) {}
    #nextFileId = 0;
    #files = new Map<string, ResourceFile>();
    #data = new Map<string, CapturedData>();
    #snapshot?: ResourceSnapshot;

    capture(
        memory: GuestMemoryReader,
        resourceKey?: string,
        now = Date.now(),
        previewKeys: string[] = [],
        hints?: ResourceLoadHints
    ): ResourceSnapshot {
        const parsed = readResourceMaps(memory, now, hints);
        // Commit only after the whole map chain validates. A snapshot may land
        // inside a Resource Manager operation even at an instruction boundary.
        const present = new Set(parsed.map(p => p.identity));
        for (const [identity, file] of this.#files) {
            // A long pause must not change the identity of a still-open file.
            if (present.has(identity)) continue;
            if (now - file.lastSeen > INSPECTOR_GRACE_MS)
                this.#files.delete(identity);
            else
                this.#files.set(identity, {
                    ...file,
                    recent: true,
                    current: false,
                });
        }
        for (const p of parsed) {
            const location = p.file as ResourceFile & {
                volumeName?: string;
                parentID?: number;
            };
            if (location.volumeName && location.parentID !== undefined) {
                Object.assign(
                    p.file,
                    this.pathResolver?.resolve(
                        location.volumeName,
                        location.parentID,
                        p.file.name
                    )
                );
                delete location.volumeName;
                delete location.parentID;
            }
            const old = this.#files.get(p.identity);
            p.file.key =
                old?.key ?? `file-${this.generation}-${++this.#nextFileId}`;
            for (const t of p.file.types)
                for (const r of t.resources) {
                    const localKey = r.key;
                    r.key = `${p.file.key}/${localKey}`;
                    const captured = p.data.get(localKey);
                    if (captured) this.#data.set(r.key, captured);
                }
            this.#files.set(p.identity, p.file);
        }
        // Bound history in both time and bytes, including files from other
        // process contexts. Evict older observations first.
        let bytes = 0;
        const entries = [...this.#data].sort(
            (a, b) => b[1].capturedAt - a[1].capturedAt
        );
        for (const [key, data] of entries) {
            bytes += data.data.length;
            if (
                now - data.capturedAt > INSPECTOR_GRACE_MS ||
                bytes > MAX_CACHE_BYTES
            )
                this.#data.delete(key);
        }
        while (this.#files.size > MAX_MAPS)
            this.#files.delete(this.#files.keys().next().value!);
        const files = [...this.#files.values()]
            .map(file => ({
                ...file,
                types: file.types.map(type => ({
                    ...type,
                    resources: type.resources.map(resource => {
                        const data = this.#data.get(resource.key);
                        return {
                            ...resource,
                            resident: !file.recent && resource.resident,
                            cached:
                                !!data &&
                                (!resource.resident || data.capturedAt !== now),
                            size: resource.size ?? data?.size,
                        };
                    }),
                })),
            }))
            .sort(
                (a, b) =>
                    Number(!!a.recent) - Number(!!b.recent) ||
                    a.name.localeCompare(b.name)
            );
        this.#snapshot = {
            files,
            processName: memory.pstring(0x910, 31),
            pointerBits: memory.pointerBits,
            capturedAt: now,
        };
        return this.snapshot(resourceKey, previewKeys)!;
    }

    // Serve selections from the last capture without reading guest memory or
    // aging the cache. Paused inspection can explore all previously seen data.
    snapshot(
        resourceKey?: string,
        previewKeys: string[] = []
    ): ResourceSnapshot | undefined {
        if (!this.#snapshot) return undefined;
        const now = this.#snapshot.capturedAt;
        const detailFor = (key: string): ResourceDetail | undefined => {
            const captured = this.#data.get(key);
            const maskKey = key.replace(
                /\/(icl[48]|ics[48]):/,
                (_, type: string) =>
                    `/${type.startsWith("icl") ? "ICN#" : "ics#"}:`
            );
            const mask =
                maskKey !== key && maskKey
                    ? this.#data.get(maskKey)
                    : undefined;
            return captured
                ? {
                      key,
                      ...captured,
                      cached: captured.cached ?? captured.capturedAt !== now,
                      mask:
                          mask?.capturedAt === captured.capturedAt
                              ? mask.data
                              : undefined,
                  }
                : undefined;
        };
        // Only the visible grid is sent. Patterns and compiled color icons need
        // room for embedded PixMaps and color tables; fixed icons need 1 KiB.
        // Slice rather than subarray so structured cloning cannot copy a large
        // underlying resource buffer along with its small thumbnail view.
        const previews = previewKeys
            .slice(0, INSPECTOR_PREVIEW_COUNT)
            .flatMap(key => {
                const detail = detailFor(key);
                return detail
                    ? [
                          {
                              ...detail,
                              data: detail.data.slice(
                                  0,
                                  /\/(ppat|PAT#|cicn):/.test(key)
                                      ? 16 * 1024
                                      : 1024
                              ),
                              mask: detail.mask?.slice(0, 256),
                          },
                      ]
                    : [];
            });
        return {
            ...this.#snapshot,
            detail: resourceKey ? detailFor(resourceKey) : undefined,
            previews,
        };
    }
}
