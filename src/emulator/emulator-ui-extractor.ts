import JSZip from "jszip";
import {saveAs} from "file-saver";
import {
    type EmulatorFileUpload,
    type EmulatorWorkerDirectorExtraction,
    type EmulatorWorkerDirectorExtractionEntry,
} from "./emulator-common";
import * as varz from "../varz";
import {fixArchiveFinderInfo} from "./emulator-finder";

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
    return uploads;
}

function parseAppleDouble(
    buffer: ArrayBuffer,
    name: string
): {
    resourceFork?: Blob;
    metadata?: Blob;
} {
    const data = new DataView(buffer);
    const magic = data.getUint32(0);
    if (magic !== 0x00051607) {
        throw new Error(`Invalid AppleDouble magic ${magic.toString(16)}`);
    }
    const version = data.getUint32(4);
    if (version !== 0x00020000) {
        throw new Error(`Invalid AppleDouble version ${version.toString(16)}`);
    }

    const entryCount = data.getUint16(24);
    let cursor = 26;
    let resourceFork;
    let metadata;
    for (let i = 0; i < entryCount; i++) {
        const entryID = data.getUint32(cursor);
        const offset = data.getUint32(cursor + 4);
        const length = data.getUint32(cursor + 8);
        switch (entryID) {
            case 2:
                resourceFork = new Blob([
                    buffer.slice(offset, offset + length),
                ]);
                break;
            case 9: {
                const metadataBuffer = buffer.slice(offset, offset + length);
                fixArchiveFinderInfo(metadataBuffer);
                metadata = new Blob([metadataBuffer]);
                break;
            }
            default:
                console.log(
                    `Ignoring unexpected entry ID ${entryID} found in ${name}`
                );
        }
        cursor += 12;
    }

    return {resourceFork, metadata};
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
