import type {Dispatch, SetStateAction} from "react";
import {useState, useEffect} from "react";

export function usePersistentState<T>(
    defaultValue: T,
    key: string,
    onValueChange: () => void
): [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState(() => {
        const persistedValue = window.localStorage.getItem(key);
        try {
            return persistedValue !== null
                ? JSON.parse(persistedValue)
                : defaultValue;
        } catch {
            console.warn("Could not parse persistent state", persistedValue);
            return defaultValue;
        }
    });
    useEffect(() => {
        const persistedValue = JSON.stringify(value);
        if (persistedValue !== undefined) {
            window.sessionStorage.setItem(key, persistedValue);
        } else {
            console.warn("Could not serialize persistent state", value);
        }
        onValueChange();
    }, [key, value, onValueChange]);
    return [value, setValue];
}
