import {zipArchiveReader} from "@/emulator/ui/zip-archive";
import {stuffItArchiveReader} from "@/emulator/ui/stuffit-archive";

export interface ArchiveEntry {
    readonly name: string;
    readonly isDirectory: boolean;

    contents(onProgress?: (fraction: number) => void): Promise<Blob>;
}

export interface OpenedArchive {
    readonly format: string;
    readonly entries: readonly ArchiveEntry[];
    close?(): void;
}

export interface ArchiveReader {
    supports(file: File): boolean;
    open(file: File): Promise<OpenedArchive | undefined>;
}

const archiveReaders: readonly ArchiveReader[] = [
    zipArchiveReader,
    stuffItArchiveReader,
];

export async function openArchive(
    file: File
): Promise<OpenedArchive | undefined> {
    for (const reader of archiveReaders) {
        if (!reader.supports(file)) {
            continue;
        }
        try {
            const archive = await reader.open(file);
            return archive;
        } catch (err) {
            console.warn(
                "Error opening archive file, not using archive reader",
                file,
                err
            );
        }
    }
    return undefined;
}
