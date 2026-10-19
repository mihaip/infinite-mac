import Worker from "@/stuffit/worker/worker?worker";
import {
    MAX_STUFFIT_ARCHIVE_SIZE,
    type StuffItEntryInfo,
    type StuffItWorkerCommand,
    type StuffItWorkerResponse,
} from "@/stuffit/common/common";

export async function openStuffItArchive(file: File): Promise<StuffItArchive> {
    if (file.size > MAX_STUFFIT_ARCHIVE_SIZE) {
        throw new Error(
            "StuffIt archives larger than 700 MB are not supported."
        );
    }
    const client = new StuffItWorkerClient();
    try {
        const response = await client.request({type: "open", file});
        if (response.type !== "opened") {
            throw new Error("Unexpected StuffIt worker response.");
        }
        return new StuffItArchive(client, response.entries);
    } catch (error) {
        client.close();
        throw error;
    }
}

export class StuffItArchive {
    readonly entries: readonly StuffItEntry[];
    readonly #client: StuffItWorkerClient;

    constructor(
        client: StuffItWorkerClient,
        entries: readonly StuffItEntryInfo[]
    ) {
        this.#client = client;
        this.entries = entries.map(
            (info, index) => new StuffItEntry(client, index, info)
        );
    }

    close(): void {
        this.#client.close();
    }
}

export class StuffItEntry {
    readonly name: string;
    readonly isDirectory: boolean;
    readonly #client: StuffItWorkerClient;
    readonly #index: number;

    constructor(
        client: StuffItWorkerClient,
        index: number,
        info: StuffItEntryInfo
    ) {
        this.#client = client;
        this.#index = index;
        this.name = info.name;
        this.isDirectory = info.isDirectory;
    }

    async contents(): Promise<Blob> {
        const response = await this.#client.request({
            type: "contents",
            index: this.#index,
        });
        if (response.type !== "contents") {
            throw new Error("Unexpected StuffIt worker response.");
        }
        return response.contents;
    }
}

class StuffItWorkerClient {
    #worker: Worker | undefined;
    #nextId = 0;
    readonly #pending = new Map<
        number,
        {
            resolve: (response: StuffItWorkerResponse) => void;
            reject: (error: Error) => void;
        }
    >();

    constructor() {
        const worker = new Worker();
        this.#worker = worker;
        worker.addEventListener(
            "message",
            (event: MessageEvent<StuffItWorkerResponse>) => {
                const response = event.data;
                const pending = this.#pending.get(response.id);
                if (!pending) {
                    return;
                }
                this.#pending.delete(response.id);
                if (response.type === "error") {
                    pending.reject(new Error(response.message));
                } else {
                    pending.resolve(response);
                }
            }
        );
        worker.addEventListener("error", event => {
            this.close(
                new Error(event.message || "The StuffIt worker failed.")
            );
        });
        worker.addEventListener("messageerror", () => {
            this.close(
                new Error("Could not read the StuffIt worker response.")
            );
        });
    }

    request(command: StuffItWorkerCommand): Promise<StuffItWorkerResponse> {
        return new Promise((resolve, reject) => {
            if (!this.#worker) {
                reject(new Error("The StuffIt archive is closed."));
                return;
            }
            const id = this.#nextId++;
            this.#pending.set(id, {resolve, reject});
            try {
                this.#worker.postMessage({...command, id});
            } catch (error) {
                this.#pending.delete(id);
                reject(error);
            }
        });
    }

    close(error = new Error("The StuffIt archive is closed.")): void {
        this.#worker?.terminate();
        this.#worker = undefined;
        for (const pending of this.#pending.values()) {
            pending.reject(error);
        }
        this.#pending.clear();
    }
}
