import type {
    EmulatorWorkerDirectorExtraction,
    EmulatorWorkerDirectorExtractionEntry,
} from "./emulator-common";

export function extractDirectory(dirPath: string) {
    const {
        exists: dirExists,
        name: dirName,
        object: dirFsObject,
    } = FS.analyzePath(dirPath);
    if (!dirExists) {
        console.error(`${dirPath} does not exist`);
        return;
    }
    if (!FS.isDir(dirFsObject.mode)) {
        console.error(`${dirPath} is not a directory`);
        return;
    }

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

    self.postMessage(
        {type: "emulator_extract_directory", extraction},
        arrayBuffers
    );
}
