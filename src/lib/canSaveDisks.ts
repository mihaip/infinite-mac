import Worker from "@/lib/canSaveDisks-worker?worker&inline";

export function canSaveDisks() {
    if (!navigator.storage?.getDirectory) {
        return false;
    }
    if (typeof FileSystemFileHandle !== "function") {
        return false;
    }

    if (workerSyncFileSupport !== "unknown") {
        return workerSyncFileSupport === "supported";
    }
    function update(support: "supported" | "unsupported") {
        if (workerSyncFileSupport === "unsupported") {
            // Ignore updates if one mechanism determined that it's unsupported.
            return;
        }
        workerSyncFileSupport = support;
        localStorage["workerSyncFileSupport"] = support;
    }

    // We can't check for the presence of FileSystemSyncAccessHandle in the
    // main window, it's only available in workers. So we have to create a
    // temporary one to check, but we cache the result in localStorage so that
    // we can avoid doing this every time.
    if (!worker) {
        worker = new Worker();
        worker.addEventListener("message", e => {
            update(e.data ? "supported" : "unsupported");
            worker?.terminate();
        });
    }

    // In private contexts Safari exposes the storage API, but calls to it will
    // fail, check for that too.
    navigator.storage.getDirectory().catch(() => update("unsupported"));

    // Assume supported until we hear otherwise.
    return true;
}

let workerSyncFileSupport: "unknown" | "supported" | "unsupported" =
    typeof localStorage !== "undefined"
        ? (localStorage["workerSyncFileSupport"] ?? "unknown")
        : "unknown";

let worker: Worker | undefined;
