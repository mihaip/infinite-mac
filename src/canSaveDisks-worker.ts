const supported =
    typeof FileSystemFileHandle.prototype.createSyncAccessHandle ===
        "function" && typeof FileSystemSyncAccessHandle === "function";

postMessage(supported);
