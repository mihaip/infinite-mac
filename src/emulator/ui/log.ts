export class EmulatorLog {
    append(message: string) {
        this.#messages = [
            ...this.#messages,
            {id: this.#nextMessageId++, message},
        ];
        for (const listener of this.#listeners) {
            listener();
        }
    }

    getSnapshot = (): readonly EmulatorLogMessage[] => this.#messages;

    subscribe = (listener: () => void) => {
        this.#listeners.add(listener);
        return () => {
            this.#listeners.delete(listener);
        };
    };

    #messages: readonly EmulatorLogMessage[] = [];
    #nextMessageId = 0;
    #listeners = new Set<() => void>();
}

export type EmulatorLogMessage = {
    readonly id: number;
    readonly message: string;
};
