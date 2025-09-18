import JSZip from "jszip";
import {saveAs} from "file-saver";
import {
    type EmulatorWorkerDirectorExtractionDirectoryEntry,
    type EmulatorFileUpload,
    type EmulatorWorkerDirectorExtraction,
    type EmulatorWorkerDirectorExtractionEntry,
} from "./emulator-common";
import * as varz from "../varz";
import {buildAppleDouble, parseAppleDouble} from "./emulator-ui-appledouble";

export async function uploadsFromFile(
    file: File
): Promise<EmulatorFileUpload[] | undefined> {
    return (
        (await uploadsFromDirectoryExtractionFile(file)) ??
        (await uploadsFromMacOSArchive(file))
    );
}

async function uploadsFromDirectoryExtractionFile(
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

/**
 * Special-cases .zips created by modern macOS, which persist extra information
 * (resource forks and Finder info metadata) in a parallel __MACOSX directory
 * structure using AppleDouble-encoded files.
 */
async function uploadsFromMacOSArchive(
    file: File
): Promise<EmulatorFileUpload[] | undefined> {
    if (!file.name.endsWith(".zip")) {
        return undefined;
    }
    const zip = await JSZip.loadAsync(file);
    const appleDoubleFiles = Object.values(zip.files).filter(
        f => !f.dir && f.name.startsWith("__MACOSX")
    );
    // Not a macOS-created archive.
    if (!appleDoubleFiles.length) {
        return undefined;
    }
    const parentName = file.name.slice(0, -4);
    // Directories are implicitly created
    const files = Object.values(zip.files).filter(
        f => !f.dir && !f.name.startsWith("__MACOSX")
    );
    const prefix = files.every(f => f.name.startsWith(parentName))
        ? ""
        : parentName + "/";

    const fileBlobs = await Promise.all(files.map(f => f.async("blob")));
    const uploads = files.map((f, i) => {
        const blob = fileBlobs[i];
        const url = URL.createObjectURL(blob);
        return {
            name: prefix + f.name,
            url,
            size: blob.size,
        };
    });

    const appleDoubleBuffers = await Promise.all(
        appleDoubleFiles.map(f => f.async("arraybuffer"))
    );
    for (let i = 0; i < appleDoubleFiles.length; i++) {
        const file = appleDoubleFiles[i];
        const buffer = appleDoubleBuffers[i];

        const path = file.name.split("/");
        path.shift(); // Drop the __MACOSX directory
        let name = path.pop()!;
        if (name.startsWith("._")) {
            name = name.substring(2);
        }
        const {resourceFork, metadata} = parseAppleDouble(buffer, name);
        if (resourceFork) {
            const url = URL.createObjectURL(resourceFork);
            uploads.push({
                name: prefix + [...path, ".rsrc", name].join("/"),
                url,
                size: resourceFork.size,
            });
        }
        if (metadata) {
            const url = URL.createObjectURL(metadata);
            uploads.push({
                name: prefix + [...path, ".finf", name].join("/"),
                url,
                size: metadata.size,
            });
        }
    }

    varz.increment("emulator_uploads:mac_os_archive");

    return uploads;
}

function isDirectoryEntry(
    entry: EmulatorWorkerDirectorExtractionEntry
): entry is EmulatorWorkerDirectorExtractionDirectoryEntry {
    return Array.isArray(entry.contents);
}

export async function handleDirectoryExtraction(
    extraction: EmulatorWorkerDirectorExtraction
): Promise<void> {
    const zip = new JSZip();
    const macosxRoot = zip.folder("__MACOSX")!;

    function addToZip(
        depth: number,
        zip: JSZip,
        macosxZip: JSZip,
        entries: EmulatorWorkerDirectorExtractionEntry[]
    ) {
        const rsrcByName = new Map<string, Uint8Array>();
        const finfByName = new Map<string, Uint8Array>();
        for (const entry of entries) {
            if (isDirectoryEntry(entry)) {
                if (entry.name === ".rsrc") {
                    for (const rsrcEntry of entry.contents) {
                        if (isDirectoryEntry(rsrcEntry)) {
                            console.warn(
                                "Encountered unexpected directory in .rsrc",
                                rsrcEntry
                            );
                        } else {
                            rsrcByName.set(rsrcEntry.name, rsrcEntry.contents);
                        }
                    }
                } else if (entry.name === ".finf") {
                    for (const finfEntry of entry.contents) {
                        if (isDirectoryEntry(finfEntry)) {
                            console.warn(
                                "Encountered unexpected directory in .finf",
                                finfEntry
                            );
                        } else {
                            finfByName.set(finfEntry.name, finfEntry.contents);
                        }
                    }
                } else {
                    addToZip(
                        depth + 1,
                        zip.folder(entry.name)!,
                        macosxRoot.folder(entry.name)!,
                        entry.contents
                    );
                }

                for (const name of new Set([
                    ...rsrcByName.keys(),
                    ...finfByName.keys(),
                ])) {
                    const content = buildAppleDouble(
                        finfByName.get(name),
                        rsrcByName.get(name)
                    )!;
                    macosxZip.file("._" + name, content);
                }
            } else if (entry.name === "DInfo") {
                if (depth === 0) {
                    const content = buildAppleDouble(
                        entry.contents,
                        undefined
                    )!;
                    macosxZip.file("._" + extraction.name, content);
                } else {
                    console.warn(
                        "Ignoring unexpected DInfo outside root",
                        entry
                    );
                }
            } else {
                zip.file(entry.name, entry.contents);
            }
        }
    }

    addToZip(0, zip, macosxRoot, extraction.contents);

    const zipBlob = await zip.generateAsync({
        compression: "DEFLATE",
        compressionOptions: {level: 9},
        type: "blob",
    });
    const zipName = extraction.name + ".zip";

    saveAs(zipBlob, zipName);
    varz.increment("emulator_extractions");
}

export async function handleDirectoryExtractionRaw(
    extraction: EmulatorWorkerDirectorExtraction
) {
    const zip = new JSZip();

    function addToZip(
        depth: number,
        zip: JSZip,
        entries: EmulatorWorkerDirectorExtractionEntry[]
    ) {
        for (const entry of entries) {
            if (isDirectoryEntry(entry)) {
                addToZip(depth + 1, zip.folder(entry.name)!, entry.contents);
            } else {
                zip.file(entry.name, entry.contents);
            }
        }
    }

    addToZip(0, zip, extraction.contents);

    const zipBlob = await zip.generateAsync({
        compression: "DEFLATE",
        compressionOptions: {level: 9},
        type: "blob",
    });
    const zipName = extraction.name + " (Raw).zip";

    saveAs(zipBlob, zipName);
}
