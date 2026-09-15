/* tslint:disable */
/* eslint-disable */

export class StuffItArchive {
    free(): void;
    [Symbol.dispose](): void;
    entryContents(index: number): Uint8Array;
    entryIsDirectory(index: number): boolean;
    entryName(index: number): string;
    constructor(data: Uint8Array);
    readonly entryCount: number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_stuffitarchive_free: (a: number, b: number) => void;
    readonly stuffitarchive_entryContents: (a: number, b: number, c: number) => void;
    readonly stuffitarchive_entryCount: (a: number) => number;
    readonly stuffitarchive_entryIsDirectory: (a: number, b: number, c: number) => void;
    readonly stuffitarchive_entryName: (a: number, b: number, c: number) => void;
    readonly stuffitarchive_new: (a: number, b: number, c: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export2: (a: number, b: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
