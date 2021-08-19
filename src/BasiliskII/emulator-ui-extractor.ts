import JSZip from "jszip";
import {saveAs} from "file-saver";
import type {
    EmulatorWorkerDirectorExtraction,
    EmulatorWorkerDirectorExtractionEntry,
} from "./emulator-common";
import {DInfoFields, FinderFlags, FInfoFields} from "./emulator-finder";

export async function handleDirectoryExtraction(
    extraction: EmulatorWorkerDirectorExtraction
) {
    const zip = new JSZip();

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
                    let flags = fInfoView.getUint16(FInfoFields.fdFlags);
                    // Clear the kHasBeenInited flag so that applications
                    // are registered (and thus their icons are set correctly
                    // based on BNDL resources).
                    if (flags & FinderFlags.kHasBeenInited) {
                        flags &= ~FinderFlags.kHasBeenInited;
                        fInfoView.setUint16(FInfoFields.fdFlags, flags);
                        // If we clear kHasBeenInited then the location is
                        // ignored unless we position it in a "magic rectangle"
                        // (see https://web.archive.org/web/20080514070617/http://developer.apple.com/technotes/tb/tb_42.html)
                        const x = fInfoView.getInt16(FInfoFields.fdLocation);
                        const y = fInfoView.getInt16(
                            FInfoFields.fdLocation + 2
                        );
                        if (x > 0 && y > 0) {
                            fInfoView.setInt16(
                                FInfoFields.fdLocation,
                                x - 20000
                            );
                            fInfoView.setInt16(
                                FInfoFields.fdLocation + 2,
                                y - 20000
                            );
                        }
                    }
                } else if (entry.name === "DInfo") {
                    // Clear location so that the Finder positions things
                    // automatically for us.
                    const dInfoView = new DataView(contents.buffer);
                    dInfoView.setInt16(DInfoFields.frLocation, -1); // x
                    dInfoView.setInt16(DInfoFields.frLocation + 2, -1); // y
                }
                zip.file(entry.name, contents);
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
}
