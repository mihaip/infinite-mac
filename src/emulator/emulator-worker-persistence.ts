import {
    type EmulatorWorkerDirectorExtraction,
    type EmulatorWorkerDirectorExtractionEntry,
} from "./emulator-common";

export function restorePersistedData(
    dirPath: string,
    extraction: EmulatorWorkerDirectorExtraction
) {
    function restore(
        parentDirPath: string,
        entries: EmulatorWorkerDirectorExtractionEntry[]
    ) {
        for (const entry of entries) {
            if (Array.isArray(entry.contents)) {
                const childDirPath = `${parentDirPath}/${entry.name}`;
                FS.mkdir(childDirPath);
                restore(childDirPath, entry.contents);
            } else {
                let entryParentDirPath = parentDirPath;
                let entryName = entry.name;
                if (entryName === "DInfo") {
                    // Write the DInfo struct for this folder in the parent's .finf
                    // directory.
                    entryName = extraction.name;
                    entryParentDirPath = `${
                        FS.analyzePath(dirPath).parentPath
                    }/.finf`;
                    if (!FS.analyzePath(entryParentDirPath).exists) {
                        FS.mkdir(entryParentDirPath);
                    }
                }
                FS.createDataFile(
                    entryParentDirPath,
                    entryName,
                    entry.contents,
                    true,
                    true,
                    true
                );
            }
        }
    }

    restore(dirPath, extraction.contents);
}
