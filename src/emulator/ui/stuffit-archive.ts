import {
    type ArchiveEntry,
    type ArchiveReader,
    type OpenedArchive,
} from "@/emulator/ui/archive";
import {
    openStuffItArchive,
    type StuffItArchive,
    type StuffItEntry,
} from "@/stuffit/ui/ui";
import {MAX_STUFFIT_ARCHIVE_SIZE} from "@/stuffit/common/common";

export const stuffItArchiveReader: ArchiveReader = {
    supports(file: File): boolean {
        if (file.size > MAX_STUFFIT_ARCHIVE_SIZE) {
            return false;
        }
        return /\.(?:sit|sea)_*(?:\.bin_*)?$/i.test(file.name);
    },

    async open(file: File) {
        try {
            return new OpenedStuffItArchive(await openStuffItArchive(file));
        } catch (error) {
            // We only make a best-effort to decompress .sea archives - some
            // have a normal StuffIt archive in the data fork and just work,
            // other are a proprietary format.
            if (/\.sea_*(?:\.bin_*)?$/i.test(file.name)) {
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
        const contents = await this.#entry.contents();
        onProgress?.(1);
        return contents;
    }
}
