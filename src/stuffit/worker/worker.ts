import {
    MAX_STUFFIT_ARCHIVE_SIZE,
    type StuffItWorkerRequest,
    type StuffItWorkerResponse,
} from "@/stuffit/common/common";
import init, {StuffItArchive} from "@/stuffit/generated/stuffit.js";
import wasmUrl from "@/stuffit/generated/stuffit.wasm?url";

let archive: StuffItArchive | undefined;

addEventListener("message", (event: MessageEvent<StuffItWorkerRequest>) => {
    void handleRequest(event.data);
});

async function handleRequest(request: StuffItWorkerRequest) {
    const {id} = request;
    try {
        switch (request.type) {
            case "open": {
                if (archive) {
                    throw new Error("A StuffIt archive is already open.");
                }
                if (request.file.size > MAX_STUFFIT_ARCHIVE_SIZE) {
                    throw new Error(
                        "StuffIt archives larger than 700 MB are not supported."
                    );
                }
                const [data] = await Promise.all([
                    request.file.arrayBuffer(),
                    init({module_or_path: wasmUrl}),
                ]);
                const openedArchive = new StuffItArchive(new Uint8Array(data));
                archive = openedArchive;
                respond({
                    type: "opened",
                    id,
                    entries: Array.from(
                        {length: openedArchive.entryCount},
                        (_, i) => ({
                            name: openedArchive.entryName(i),
                            isDirectory: openedArchive.entryIsDirectory(i),
                        })
                    ),
                });
                break;
            }
            case "contents": {
                if (!archive) {
                    throw new Error("The StuffIt archive is not open.");
                }
                // wasm-bindgen copies the result out of Wasm memory. Build
                // the Blob here too, so neither operation blocks the UI.
                const contents = archive.entryContents(
                    request.index
                ) as Uint8Array<ArrayBuffer>;
                respond({type: "contents", id, contents: new Blob([contents])});
                break;
            }
        }
    } catch (error) {
        respond({
            type: "error",
            id,
            message: error instanceof Error ? error.message : String(error),
        });
    }
}

function respond(response: StuffItWorkerResponse) {
    postMessage(response);
}
