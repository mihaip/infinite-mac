import JSZip from "jszip";
import {saveAs} from "file-saver";
import type {
    EmulatorFileUpload,
    EmulatorWorkerDirectorExtraction,
    EmulatorWorkerDirectorExtractionEntry,
} from "./emulator-common";
import * as varz from "../varz";

export async function uploadsFromDirectoryExtractionFile(
    file: File
): Promise<EmulatorFileUpload[] | undefined> {
    if (!file.name.endsWith(".zip")) {
        return undefined;
    }
    const zip = await JSZip.loadAsync(file);
    // Make sure it's a zip that we generated.
    if (
        !Object.keys(zip.files).some(
            name => name.startsWith(".finf") || name.startsWith(".rsrc")
        )
    ) {
        return undefined;
    }
    const parentName = file.name.slice(0, -4);
    const files = Object.values(zip.files).filter(
        // Directories are implicitly created, and the parent-level finder
        // information is not worth the special-casing in path handling for
        // now.
        f => !f.dir && f.name !== "DInfo"
    );
    const fileBlobs = await Promise.all(files.map(f => f.async("blob")));
    return files.map((f, i) => {
        const blob = fileBlobs[i];
        const url = URL.createObjectURL(blob);
        return {
            name: parentName + "/" + f.name,
            url,
            size: blob.size,
        };
    });
}

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
    varz.increment("emulator_extractions");
}
