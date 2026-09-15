import {type StuffItArchive as WasmStuffItArchive} from "@/stuffit/generated/stuffit";
import wasmUrl from "@/stuffit/generated/stuffit.wasm?url";

const MAX_ARCHIVE_SIZE = 100 * 1024 * 1024;

export async function openStuffItArchive(
    data: Uint8Array
): Promise<StuffItArchive> {
    if (data.byteLength > MAX_ARCHIVE_SIZE) {
        throw new Error(
            "StuffIt archives larger than 100 MB are not supported."
        );
    }
    modulePromise ??= loadStuffItModule();
    const module = await modulePromise;
    return new StuffItArchive(new module.StuffItArchive(data));
}

let modulePromise: ReturnType<typeof loadStuffItModule> | undefined;

async function loadStuffItModule() {
    const module = await import("@/stuffit/generated/stuffit.js");
    await module.default({module_or_path: wasmUrl});
    return module;
}

export class StuffItEntry {
    readonly name: string;
    readonly isDirectory: boolean;
    readonly #archive: WasmStuffItArchive;
    readonly #index: number;

    constructor(archive: WasmStuffItArchive, index: number) {
        this.#archive = archive;
        this.#index = index;
        this.name = archive.entryName(index);
        this.isDirectory = archive.entryIsDirectory(index);
    }

    contents(): Uint8Array {
        return this.#archive.entryContents(this.#index);
    }
}

export class StuffItArchive {
    readonly entries: readonly StuffItEntry[];
    #archive: WasmStuffItArchive | undefined;

    constructor(archive: WasmStuffItArchive) {
        this.#archive = archive;
        this.entries = Array.from(
            {length: archive.entryCount},
            (_, index) => new StuffItEntry(archive, index)
        );
    }

    close(): void {
        if (this.#archive) {
            this.#archive.free();
            this.#archive = undefined;
        }
    }
}
