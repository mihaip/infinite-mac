import type {
    EmulatorWorkerDirectorExtraction,
    EmulatorWorkerDirectorExtractionEntry,
} from "./emulator-common";

export function initializeExtractor() {
    FS.mkdir(EXTRACTOR_DIRECTORY);
}

export function handleExtractionRequests() {
    // Give file system a chance to settle (e.g. if copying a folder in). We
    // can't use setTimeout to schedule an extraction in the future because we
    // don't have an event loop.
    const MAX_MTIME = Date.now() - 2000;

    for (const childName of FS.readdir(EXTRACTOR_DIRECTORY)) {
        if (childName.startsWith(".")) {
            continue;
        }
        const childPath = EXTRACTOR_DIRECTORY + "/" + childName;
        const {object: fsObject} = FS.analyzePath(childPath);
        if (FS.isDir(fsObject.mode) && !extractedDirectories.has(childPath)) {
            const stat = FS.stat(childPath);
            if (stat.mtime.getTime() < MAX_MTIME) {
                extractedDirectories.add(childPath);
                extractDirectory(childPath);
            }
        } else if (FS.isFile(fsObject.mode) && !extractedFiles.has(childPath)) {
            const stat = FS.stat(childPath);
            if (stat.mtime.getTime() < MAX_MTIME) {
                extractedFiles.add(childPath);
                extractFile(childPath);
            }
        }
    }
}

const EXTRACTOR_DIRECTORY = "/Shared/Uploads";

const extractedDirectories = new Set<string>();
const extractedFiles = new Set<string>();

function extractDirectory(dirPath: string) {
    const {name: dirName, parentPath: dirParentPath} = FS.analyzePath(dirPath);
    const arrayBuffers: ArrayBuffer[] = [];
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

    self.postMessage(
        {type: "emulator_extract_directory", extraction},
        arrayBuffers
    );
}

function extractFile(filePath: string) {
    const {name: fileName, parentPath: fileParentPath} =
        FS.analyzePath(filePath);
    const arrayBuffers: ArrayBuffer[] = [];
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
