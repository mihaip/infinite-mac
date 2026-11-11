export class EmulatorLog {
    append(message: string) {
        // Keep the most recent 1,000 messages.
        this.#messages = [...this.#messages.slice(-999), message];
        for (const listener of this.#listeners) {
            listener();
        }
    }

    getSnapshot = (): readonly string[] => this.#messages;

    subscribe = (listener: () => void) => {
        this.#listeners.add(listener);
        return () => {
            this.#listeners.delete(listener);
        };
    };

    #messages: readonly string[] = [];
    #listeners = new Set<() => void>();
}
