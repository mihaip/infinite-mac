import {
    type ArchiveEntry,
    type ArchiveReader,
    type OpenedArchive,
} from "@/emulator/ui/archive";
import {
    openStuffItArchive,
    type StuffItArchive,
    type StuffItEntry,
} from "@/stuffit/decode";

export const stuffItArchiveReader: ArchiveReader = {
    supports(file: File): boolean {
        const name = file.name.toLowerCase();
        return name.endsWith(".sit") || name.endsWith(".sea");
    },

    async open(file: File) {
        try {
            return new OpenedStuffItArchive(
                await openStuffItArchive(
                    new Uint8Array(await file.arrayBuffer())
                )
            );
        } catch (error) {
            // We only make a best-effort to decompress .sea archives - some
            // have a normal StuffIt archive in the data fork and just work,
            // other are a proprietary format.
            if (file.name.toLowerCase().endsWith(".sea")) {
                console.warn(
                    `Could not decode StuffIt self-extracting archive ${file.name}; passing it through unchanged.`,
                    error
                );
                return undefined;
            }
            throw error;
        }
    },
};

class OpenedStuffItArchive implements OpenedArchive {
    readonly format = "sit";
    readonly entries: readonly ArchiveEntry[];
    readonly #archive: StuffItArchive;

    constructor(archive: StuffItArchive) {
        this.#archive = archive;
        this.entries = archive.entries.map(
            entry => new StuffItArchiveEntry(entry)
        );
    }

    close(): void {
        this.#archive.close();
    }
}

class StuffItArchiveEntry implements ArchiveEntry {
    readonly name: string;
    readonly isDirectory: boolean;
    readonly #entry: StuffItEntry;

    constructor(entry: StuffItEntry) {
        this.#entry = entry;
        this.name = entry.name;
        this.isDirectory = entry.isDirectory;
    }

    async contents(onProgress?: (fraction: number) => void): Promise<Blob> {
        onProgress?.(0);
        // Give the UI a chance to display the progress before we block on
        // decompression.
        await new Promise<void>(resolve => {
            window.setTimeout(resolve, 0);
        });
        const contents = this.#entry.contents();
        onProgress?.(1);
        return new Blob([contents]);
    }
}
