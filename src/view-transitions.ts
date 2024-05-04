import {type PlaceholderDiskDef, type SystemDiskDef} from "./disks";

export function startViewTransition(
    updateCallback: () => Promise<void> | void
) {
    console.log("startViewTransition");
    if ("startViewTransition" in document) {
        document.startViewTransition(updateCallback);
    } else {
        updateCallback();
    }
}

export function viewTransitionNameForDisk(
    disk: SystemDiskDef | PlaceholderDiskDef
) {
    const pieces = [
        "disk",
        disk.displayName,
        disk.displaySubtitle,
        ...disk.releaseDate,
    ];
    return pieces.join("-").replace(/[^a-zA-Z0-9]/g, "-");
}
