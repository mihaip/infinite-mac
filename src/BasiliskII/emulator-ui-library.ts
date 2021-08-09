import type {EmulatorLibraryDef} from "./emulator-common";

const FILES = {
    "Games": ["Maelstrom", "Marathon"],
    "Tools": ["ResEdit"],
};

export async function loadLibrary(): Promise<EmulatorLibraryDef> {
    const paths = [];
    const manifestFetches = [];
    for (const [directory, items] of Object.entries(FILES)) {
        for (const item of items) {
            const path = `/Library/${directory}/${item}`;
            paths.push(path);
            const manifestPath = `${path}.json`;
            manifestFetches.push(
                fetch(manifestPath).then(
                    response => response.json() as Promise<string[]>
                )
            );
        }
    }

    const manifests = await Promise.all(manifestFetches);
    const result: EmulatorLibraryDef = {};
    for (let i = 0; i < paths.length; i++) {
        result[paths[i]] = manifests[i];
    }
    return result;
}
