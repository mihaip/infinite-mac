import {
    type EmulatorStats,
    type EmulatorStatsUpdate,
} from "@/emulator/common/common";
import {useCallback, useSyncExternalStore} from "react";

export class EmulatorStatsStore {
    update(update: EmulatorStatsUpdate) {
        this.#snapshot = {...this.#snapshot, ...update};
        this.#notify();
    }

    clear() {
        this.#snapshot = {};
        this.#notify();
    }

    getSnapshot = () => this.#snapshot;

    hasStats = () => Object.keys(this.#snapshot).length > 0;

    subscribe = (listener: () => void) => {
        this.#listeners.add(listener);
        return () => {
            this.#listeners.delete(listener);
        };
    };

    #snapshot: Readonly<EmulatorStats> = {};
    #listeners = new Set<() => void>();

    #notify() {
        for (const listener of this.#listeners) {
            listener();
        }
    }
}

// Subscribe to availability without rerendering for changes to stats values.
export function useHasEmulatorStats(stats?: EmulatorStatsStore): boolean {
    return useSyncExternalStore(
        useCallback(
            (listener: () => void) => stats?.subscribe(listener) ?? (() => {}),
            [stats]
        ),
        () => stats?.hasStats() ?? false
    );
}
