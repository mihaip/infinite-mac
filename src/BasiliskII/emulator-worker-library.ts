import type {EmulatorLibraryDef} from "./emulator-common";

export function loadLibrary(def: EmulatorLibraryDef) {
    for (const [path, contents] of Object.entries(def)) {
        const {version, items} = contents;
        for (const item of items) {
            const itemPath = path + item;
            const itemUrl = `${path}.zip?item=${encodeURIComponent(
                item
            )}&v=${version}`;
            // Write the DInfo struct for this folder in the parent's .finf
            // directory.
            if (item === "/DInfo") {
                const pathPieces = path.split("/");
                const dirName = pathPieces.slice(-1)[0];
                pathPieces[pathPieces.length - 1] = ".finf";
                const dinfoDir = `/Shared/${pathPieces.join("/")}`;
                const {exists} = FS.analyzePath(dinfoDir);
                if (!exists) {
                    FS.mkdir(dinfoDir);
                }
                FS.createLazyFile(dinfoDir, dirName, itemUrl, true, true);
                continue;
            }
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
            FS.createLazyFile(itemDirPath, itemFileName, itemUrl, true, true);
        }
    }
}
