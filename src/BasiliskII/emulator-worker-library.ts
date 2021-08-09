import type {EmulatorLibraryDef} from "./emulator-common";

export function loadLibrary(def: EmulatorLibraryDef) {
    for (const [path, items] of Object.entries(def)) {
        for (const item of items) {
            const itemPath = path + item;
            const itemPathPieces = itemPath.split("/");
            const itemFileName = itemPathPieces.slice(-1)[0];
            let itemDirPath = "/Shared";
            for (const itemDir of itemPathPieces.slice(0, -1)) {
                itemDirPath += "/" + itemDir;
                const {exists} = FS.analyzePath(itemDirPath);
                if (!exists) {
                    FS.mkdir(itemDirPath);
                }
            }
            FS.createLazyFile(
                itemDirPath,
                itemFileName,
                `${path}.zip?item=${encodeURIComponent(item)}`,
                true,
                true
            );
        }
    }
}
