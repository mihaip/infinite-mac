import {parse, serialize} from "cookie";
import {type Dispatch, type SetStateAction, useEffect, useState} from "react";
import {iso} from "@/lib/iso";

/**
 * Variant of usePersistentState that persists state in cookies, so that it
 * can also be retrieved in server-side rendering environments.
 */
export function useIsoPersistentState<T>(
    defaultValue: T,
    key: string,
    onValueChange?: () => void
): [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState(() => {
        try {
            const cookieSource = iso().cookie.get();
            if (!cookieSource) {
                return defaultValue;
            }
            const parsedCookies = parse(cookieSource);
            const cookieValue = parsedCookies[key];
            if (cookieValue === undefined) {
                return defaultValue;
            }
            return JSON.parse(cookieValue) as T;
        } catch (err) {
            console.warn("Could not parse persistent state", err);
            return defaultValue;
        }
    });

    useEffect(() => {
        const persistedValue = JSON.stringify(value);
        if (persistedValue !== undefined) {
            const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
            try {
                const serializedCookie = serialize(key, persistedValue, {
                    expires,
                    path: "/",
                    sameSite: "lax",
                });
                iso().cookie.set(serializedCookie);
            } catch (err) {
                console.warn("Could not persist state to cookies", err);
            }
        } else {
            console.warn("Could not serialize persistent state", value);
        }
        onValueChange?.();
    }, [key, value, onValueChange]);
    return [value, setValue];
}
