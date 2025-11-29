import {
    type EmulatorWorkerDirectorExtraction,
    type EmulatorWorkerDirectorExtractionEntry,
} from "@/emulator/common/common";

export function initializeExtractor() {
    FS.mkdir(EXTRACTOR_DIRECTORY);
}

export function handleExtractionRequests() {
    // Give file system a chance to settle (e.g. if copying a folder in). We
    // can't use setTimeout to schedule an extraction in the future because we
    // don't have an event loop.
    const SEEN_CUTOFF_TIME = Date.now() - 2000;

    for (const childName of FS.readdir(EXTRACTOR_DIRECTORY)) {
        if (childName.startsWith(".")) {
            continue;
        }
        const childPath = EXTRACTOR_DIRECTORY + "/" + childName;
        if (extractedPaths.has(childPath)) {
            continue;
        }
        const seenTime = seenTimes.get(childPath);
        if (seenTime === undefined) {
            seenTimes.set(childPath, Date.now());
            continue;
        } else if (seenTime >= SEEN_CUTOFF_TIME) {
            continue;
        }

        const {object: fsObject} = FS.analyzePath(childPath);
        if (FS.isDir(fsObject.mode)) {
            extractedPaths.add(childPath);
            extractDirectory(childPath);
        } else if (FS.isFile(fsObject.mode)) {
            extractedPaths.add(childPath);
            extractFile(childPath);
        }
    }
}

const EXTRACTOR_DIRECTORY = "/Shared/Uploads";

const seenTimes = new Map<string, number>();
const extractedPaths = new Set<string>();

export function prepareDirectoryExtraction(
    dirPath: string
): [EmulatorWorkerDirectorExtraction, ArrayBufferLike[]] {
    const {name: dirName, parentPath: dirParentPath} = FS.analyzePath(dirPath);
    const arrayBuffers: ArrayBufferLike[] = [];
    const extraction: EmulatorWorkerDirectorExtraction = {
        name: dirName,
        contents: [],
    };

    function extract(
        dirPath: string,
        entries: EmulatorWorkerDirectorExtractionEntry[]
    ) {
        for (const childName of FS.readdir(dirPath)) {
            if (childName === "." || childName === "..") {
                continue;
            }
            const childPath = dirPath + "/" + childName;
            const {object: fsObject} = FS.analyzePath(childPath);
            if (FS.isDir(fsObject.mode)) {
                const dirEntry: EmulatorWorkerDirectorExtractionEntry = {
                    name: childName,
                    contents: [],
                };
                entries.push(dirEntry);
                extract(childPath, dirEntry.contents);
            } else {
                const fileContents = FS.readFile(childPath, {
                    encoding: "binary",
                });
                entries.push({
                    name: childName,
                    contents: fileContents,
                });
                arrayBuffers.push(fileContents.buffer);
            }
        }
    }

    extract(dirPath, extraction.contents);

    // Preserve information about the folder itself (e.g. location on screen
    // and custom icon bit). The Finder stores this in a DInfo struct, but
    // Basilisk puts it the finf directory.
    const dInfoPath = `${dirParentPath}/.finf/${dirName}`;
    const {exists: dInfoExists} = FS.analyzePath(dInfoPath);
    if (dInfoExists) {
        extraction.contents.push({
            name: "DInfo",
            contents: FS.readFile(dInfoPath, {
                encoding: "binary",
            }),
        });
    }

    return [extraction, arrayBuffers];
}

function extractDirectory(dirPath: string) {
    const [extraction, arrayBuffers] = prepareDirectoryExtraction(dirPath);

    self.postMessage(
        {type: "emulator_extract_directory", extraction},
        arrayBuffers
    );
}

function extractFile(filePath: string) {
    const {name: fileName, parentPath: fileParentPath} =
        FS.analyzePath(filePath);
    const arrayBuffers: ArrayBufferLike[] = [];
    const extraction: EmulatorWorkerDirectorExtraction = {
        name: fileName,
        contents: [],
    };

    function extract(
        filePath: string,
        entries: EmulatorWorkerDirectorExtractionEntry[]
    ) {
        const fileContents = FS.readFile(filePath, {
            encoding: "binary",
        });
        entries.push({
            name: fileName,
            contents: fileContents,
        });
        arrayBuffers.push(fileContents.buffer);
    }

    extract(filePath, extraction.contents);
    function extractParentDir(dirName: string) {
        const dirPath = `${fileParentPath}/${dirName}/${fileName}`;
        if (FS.analyzePath(dirPath).exists) {
            const dirEntry: EmulatorWorkerDirectorExtractionEntry = {
                name: dirName,
                contents: [],
            };
            extraction.contents.push(dirEntry);
            extract(dirPath, dirEntry.contents);
        }
    }

    extractParentDir(".rsrc");
    extractParentDir(".finf");

    self.postMessage(
        {type: "emulator_extract_directory", extraction},
        arrayBuffers
    );
}
