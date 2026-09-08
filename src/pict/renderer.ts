import {decodePict, type PictBitmap} from "./decode";
import {type PictModule} from "./generated/pict";
import wasmUrl from "./generated/pict.wasm?url";

let module: Promise<PictModule> | undefined;
let previous: {bytes: Uint8Array; result: Promise<PictBitmap>} | undefined;

async function render(bytes: Uint8Array): Promise<PictBitmap> {
    if (bytes.length > 4 * 1024 * 1024)
        throw new Error("This picture is too large to preview.");
    module ??= import("./generated/pict.js").then(({default: create}) =>
        create({locateFile: () => wasmUrl})
    );
    return decodePict(await module, bytes);
}

export function renderPict(bytes: Uint8Array): Promise<PictBitmap> {
    // Captures replace byte arrays even when a resource is unchanged. Avoid
    // decoding the same picture twice per second; keep only one cached result.
    if (
        previous &&
        previous.bytes.length === bytes.length &&
        previous.bytes.every((value, index) => value === bytes[index])
    )
        return previous.result;
    const copy = bytes.slice();
    const result = render(copy);
    previous = {bytes: copy, result};
    return result;
}
