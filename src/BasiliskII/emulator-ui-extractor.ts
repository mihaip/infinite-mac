import JSZip from "jszip";
import {saveAs} from "file-saver";
import type {
    EmulatorLibraryManifest,
    EmulatorWorkerDirectorExtraction,
    EmulatorWorkerDirectorExtractionEntry,
} from "./emulator-common";

enum FinderFlags {
    kIsOnDesk = 0x0001,
    kColor = 0x000e,
    kIsShared = 0x0040,
    kHasBeenInited = 0x0100,
    kHasCustomIcon = 0x0400,
    kIsStationery = 0x0800,
    kNameLocked = 0x1000,
    kHasBundle = 0x2000,
    kIsInvisible = 0x4000,
    kIsAlias = 0x8000,
}

export async function handleDirectoryExtraction(
    extraction: EmulatorWorkerDirectorExtraction
) {
    const zip = new JSZip();
    const manifest: EmulatorLibraryManifest = {version: 0, items: []};

    function addToZip(
        path: string,
        zip: JSZip,
        entries: EmulatorWorkerDirectorExtractionEntry[]
    ) {
        for (const entry of entries) {
            if (Array.isArray(entry.contents)) {
                addToZip(
                    path + "/" + entry.name,
                    zip.folder(entry.name)!,
                    entry.contents
                );
            } else {
                const {contents} = entry;
                if (path.endsWith(".finf")) {
                    const fInfoView = new DataView(contents.buffer);
                    let flags = fInfoView.getUint16(8);
                    // Clear the kHasBeenInited flag so that applications
                    // are registered (and thus their icons are set correctly
                    // based on BNDL resources).
                    if (flags & FinderFlags.kHasBeenInited) {
                        flags &= ~FinderFlags.kHasBeenInited;
                        fInfoView.setUint16(8, flags);
                        // If we clear kHasBeenInited then the location is
                        // ignored unless we position it in a "magic rectangle"
                        // (see https://web.archive.org/web/20080514070617/http://developer.apple.com/technotes/tb/tb_42.html)
                        const x = fInfoView.getInt16(10);
                        const y = fInfoView.getInt16(12);
                        if (x > 0 && y > 0) {
                            fInfoView.setInt16(10, x - 20000);
                            fInfoView.setInt16(12, y - 20000);
                        }
                    }
                } else if (entry.name === "DInfo") {
                    // Clear location so that the Finder positions things
                    // automatically for us.
                    const dInfoView = new DataView(contents.buffer);
                    dInfoView.setInt16(10, -1); // x
                    dInfoView.setInt16(12, -1); // y
                }
                zip.file(entry.name, contents);
                manifest.items.push(path + "/" + entry.name);
            }
        }
    }

    addToZip("", zip, extraction.contents);

    const zipBlob = await zip.generateAsync({
        compression: "DEFLATE",
        compressionOptions: {level: 9},
        type: "blob",
    });
    const zipName = extraction.name + ".zip";

    saveAs(zipBlob, zipName);

    // Use a content hash as the version, so that we can generate new URLs
    // as the archive contents change.
    const zipDigest = await crypto.subtle.digest(
        "SHA-1",
        await zipBlob.arrayBuffer()
    );
    manifest.version = new DataView(zipDigest).getInt32(0);

    const manifestBlob = new Blob([JSON.stringify(manifest, undefined, 4)]);
    const manifestName = extraction.name + ".json";

    saveAs(manifestBlob, manifestName);
}
