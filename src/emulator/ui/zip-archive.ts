import JSZip from "jszip";
import {type ArchiveEntry, type ArchiveReader} from "@/emulator/ui/archive";

class ZipArchiveEntry implements ArchiveEntry {
    readonly name: string;
    readonly isDirectory: boolean;
    readonly #entry: JSZip.JSZipObject;

    constructor(entry: JSZip.JSZipObject) {
        this.#entry = entry;
        this.name = entry.name;
        this.isDirectory = entry.dir;
    }

    contents(onProgress?: (fraction: number) => void): Promise<Blob> {
        return this.#entry.async("blob", metadata =>
            onProgress?.(metadata.percent / 100)
        );
    }
}

export const zipArchiveReader: ArchiveReader = {
    supports(file: File): boolean {
        return file.name.toLowerCase().endsWith(".zip");
    },

    async open(file: File) {
        const zip = await JSZip.loadAsync(file);
        return {
            format: "zip",
            entries: Object.values(zip.files).map(
                entry => new ZipArchiveEntry(entry)
            ),
        };
    },
};
