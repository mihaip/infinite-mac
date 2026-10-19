export const MAX_STUFFIT_ARCHIVE_SIZE = 700 * 1024 * 1024;

export interface StuffItEntryInfo {
    readonly name: string;
    readonly isDirectory: boolean;
}

export type StuffItWorkerCommand =
    | {type: "open"; file: File}
    | {type: "contents"; index: number};

export type StuffItWorkerRequest = StuffItWorkerCommand & {id: number};

export type StuffItWorkerResponse = (
    | {type: "opened"; entries: readonly StuffItEntryInfo[]}
    | {type: "contents"; contents: Blob}
    | {type: "error"; message: string}
) & {id: number};
