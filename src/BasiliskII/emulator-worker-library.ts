import type {EmulatorLibraryDef} from "./emulator-common";
import {createLazyFile} from "./emulator-worker-lazy-file";

export function loadLibrary(def: EmulatorLibraryDef) {
    const paths = Object.keys(def).sort();
    for (const path of paths) {
        const {version, items, inline_data: inlineData} = def[path];
        for (const [item, itemSize] of Object.entries(items)) {
            const itemPath = `${path}/${item}`;

            // eslint-disable-next-line no-loop-func
            function createFile(parent: string, name: string): FS.FSNode {
                if (item in inlineData) {
                    const itemData = Uint8Array.from(
                        atob(inlineData[item]),
                        c => c.charCodeAt(0)
                    );
                    return FS.createDataFile(
                        parent,
                        name,
                        itemData,
                        true,
                        true,
                        true
                    );
                }
                const itemUrl = `${path}.zip?item=${encodeURIComponent(
                    item
                )}&v=${version}`;
                return createLazyFile(
                    parent,
                    name,
                    itemUrl,
                    itemSize,
                    true,
                    true
                );
            }

            // Write the DInfo struct for this folder in the parent's .finf
            // directory.
            if (item === "DInfo") {
                const pathPieces = path.split("/");
                const dirName = pathPieces.slice(-1)[0];
                pathPieces[pathPieces.length - 1] = ".finf";
                const dinfoDir = `/Shared/${pathPieces.join("/")}`;
                const {exists} = FS.analyzePath(dinfoDir);
                if (!exists) {
                    FS.mkdir(dinfoDir);
                }
                createFile(dinfoDir, dirName);
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
            createFile(itemDirPath, itemFileName);
        }
    }
}
