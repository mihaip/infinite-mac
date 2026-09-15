import JSZip from "jszip";
import {saveAs} from "file-saver";
import {
    type EmulatorWorkerDirectorExtractionDirectoryEntry,
    type EmulatorFileUpload,
    type EmulatorWorkerDirectorExtraction,
    type EmulatorWorkerDirectorExtractionEntry,
    isDiskImageFile,
} from "@/emulator/common/common";
import * as varz from "@/lib/varz";
import {buildAppleDouble, parseAppleDouble} from "@/emulator/ui/appledouble";
import {type OpenedArchive, openArchive} from "@/emulator/ui/archive";
import {type EmulatorFileLoadingProgress} from "@/emulator/ui/ui";

export async function uploadsFromFile(
    file: File,
    onProgress?: OnProgress
): Promise<EmulatorFileUpload[] | undefined> {
    const archive = await openArchive(file);
    if (!archive) {
        return undefined;
    }
    try {
        return (
            (await uploadsFromDirectoryExtractionFile(file, archive)) ??
            (await uploadsFromMacOSArchive(file, archive)) ??
            (await uploadsFromDiskImageArchive(archive, onProgress))
        );
    } finally {
        archive.close?.();
    }
}

async function uploadsFromDirectoryExtractionFile(
    file: File,
    archive: OpenedArchive
): Promise<EmulatorFileUpload[] | undefined> {
    if (archive.format !== "zip") {
        return undefined;
    }
    // Make sure it's a zip that we generated.
    if (
        !archive.entries.some(
            entry =>
                entry.name.startsWith(".finf") || entry.name.startsWith(".rsrc")
        )
    ) {
        return undefined;
    }
    const parentName = file.name.slice(0, -4);
    const files = archive.entries.filter(
        // Directories are implicitly created, and the parent-level finder
        // information is not worth the special-casing in path handling for
        // now.
        entry => !entry.isDirectory && entry.name !== "DInfo"
    );
    const fileBlobs = await Promise.all(files.map(entry => entry.contents()));
    return files.map((entry, i) => {
        const blob = fileBlobs[i];
        const url = URL.createObjectURL(blob);
        return {
            name: parentName + "/" + entry.name,
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
    file: File,
    archive: OpenedArchive
): Promise<EmulatorFileUpload[] | undefined> {
    if (archive.format !== "zip") {
        return undefined;
    }
    const appleDoubleFiles = archive.entries.filter(
        entry => !entry.isDirectory && entry.name.startsWith("__MACOSX")
    );
    // Not a macOS-created archive.
    if (!appleDoubleFiles.length) {
        return undefined;
    }
    const parentName = file.name.slice(0, -4);
    // Directories are implicitly created
    const files = archive.entries.filter(
        entry => !entry.isDirectory && !entry.name.startsWith("__MACOSX")
    );
    const prefix = files.every(entry => entry.name.startsWith(parentName))
        ? ""
        : parentName + "/";

    const fileBlobs = await Promise.all(files.map(entry => entry.contents()));
    const uploads = files.map((entry, i) => {
        const blob = fileBlobs[i];
        const url = URL.createObjectURL(blob);
        return {
            name: prefix + entry.name,
            url,
            size: blob.size,
        };
    });

    const appleDoubleBuffers = await Promise.all(
        appleDoubleFiles.map(async entry =>
            (await entry.contents()).arrayBuffer()
        )
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

/**
 * Extracts disk images from an otherwise ordinary archive. Returning only
 * disk images causes the existing upload path to mount them automatically.
 */
async function uploadsFromDiskImageArchive(
    archive: OpenedArchive,
    onProgress?: OnProgress
): Promise<EmulatorFileUpload[] | undefined> {
    const diskImageEntries = archive.entries.filter(
        entry =>
            !entry.isDirectory &&
            isDiskImageFile({
                name: entry.name,
                // A .bin entry's size is not known until it is expanded. Treat
                // it as a candidate here and validate its real size below.
                size: Number.MAX_SAFE_INTEGER,
            })
    );
    if (!diskImageEntries.length) {
        return undefined;
    }

    const diskImageName =
        diskImageEntries.length === 1
            ? diskImageEntries[0].name
            : `${diskImageEntries.length} disk images`;
    const entryProgress = diskImageEntries.map(() => 0);
    const reportDecompressionProgress = (index: number, fraction: number) => {
        entryProgress[index] = fraction;
        onProgress?.({
            operation: "Decompressing",
            name: diskImageName,
            fraction:
                entryProgress.reduce((total, value) => total + value, 0) /
                entryProgress.length,
        });
    };
    onProgress?.({
        operation: "Decompressing",
        name: diskImageName,
        fraction: 0,
    });
    const blobs = await Promise.all(
        diskImageEntries.map((entry, index) =>
            entry.contents(fraction =>
                reportDecompressionProgress(index, fraction)
            )
        )
    );
    const uploads = diskImageEntries
        .map((entry, i) => {
            const blob = blobs[i];
            const name = entry.name;
            if (!isDiskImageFile({name, size: blob.size})) {
                return undefined;
            }
            return {
                name,
                url: URL.createObjectURL(blob),
                size: blob.size,
            };
        })
        .filter(upload => upload !== undefined);
    if (!uploads.length) {
        onProgress?.({name: diskImageName, fraction: 1});
        return undefined;
    }

    onProgress?.({
        operation: "Preparing",
        name:
            uploads.length === 1
                ? `${uploads[0].name} for mounting`
                : `${uploads.length} disk images for mounting`,
        fraction: 1,
        linger: true,
    });
    varz.increment(`emulator_uploads:${archive.format}_disk_images`);
    return uploads;
}

type OnProgress = (progress: EmulatorFileLoadingProgress) => void;

function isDirectoryEntry(
    entry: EmulatorWorkerDirectorExtractionEntry
): entry is EmulatorWorkerDirectorExtractionDirectoryEntry {
    return Array.isArray(entry.contents);
}

function printedImageEntry(
    extraction: EmulatorWorkerDirectorExtraction
): {name: string; contents: Uint8Array} | undefined {
    if (
        !extraction.name.startsWith("Snow print ") ||
        !extraction.name.endsWith(".png") ||
        extraction.contents.length !== 1
    ) {
        return undefined;
    }
    const entry = extraction.contents[0];
    if (isDirectoryEntry(entry) || entry.name !== extraction.name) {
        return undefined;
    }
    return entry;
}

export async function handleDirectoryExtraction(
    extraction: EmulatorWorkerDirectorExtraction
): Promise<void> {
    const printedImage = printedImageEntry(extraction);
    if (printedImage) {
        saveAs(
            new Blob([printedImage.contents], {type: "image/png"}),
            printedImage.name
        );
        varz.increment("emulator_prints");
        return;
    }

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
