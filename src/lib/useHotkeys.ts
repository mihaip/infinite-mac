import {useRef, useEffect} from "react";

type Hotkey = {
    code: string;
    // Primary shortcut modifier: Command on Mac, Control elsewhere.
    modKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
    handler: () => void;
};
export function useHotkeys(hotkeys: Hotkey[], enabled = true) {
    const hotkeysRef = useRef(hotkeys);
    hotkeysRef.current = hotkeys;

    useEffect(() => {
        if (!enabled) {
            return;
        }
        const isMac = navigator.platform.startsWith("Mac");
        const consumedCodes = new Set<string>();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (consumedCodes.has(event.code)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            if (event.defaultPrevented) {
                return;
            }
            const {target} = event;
            if (
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                (target instanceof HTMLElement && target.isContentEditable) ||
                (target instanceof Element && target.closest(".Dialog"))
            ) {
                return;
            }
            const hotkey = hotkeysRef.current.find(
                ({
                    code,
                    modKey = false,
                    metaKey = false,
                    shiftKey = false,
                    ctrlKey = false,
                    altKey = false,
                }) =>
                    event.code === code &&
                    event.metaKey ===
                        (metaKey === true || (modKey === true && isMac)) &&
                    event.shiftKey === shiftKey &&
                    event.ctrlKey ===
                        (ctrlKey === true || (modKey === true && !isMac)) &&
                    event.altKey === altKey
            );
            if (!hotkey) {
                return;
            }
            // The emulator also listens on window, so consume shortcuts before
            // it can forward their keys to the guest.
            event.preventDefault();
            event.stopImmediatePropagation();
            consumedCodes.add(event.code);
            if (!event.repeat) {
                hotkey.handler();
            }
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            if (consumedCodes.delete(event.code)) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
            // macOS may omit the keyup for a key pressed with Command.
            if (isMac && event.code.startsWith("Meta")) {
                consumedCodes.clear();
            }
        };
        const handleBlur = () => consumedCodes.clear();
        window.addEventListener("keydown", handleKeyDown, true);
        window.addEventListener("keyup", handleKeyUp, true);
        window.addEventListener("blur", handleBlur);
        return () => {
            window.removeEventListener("keydown", handleKeyDown, true);
            window.removeEventListener("keyup", handleKeyUp, true);
            window.removeEventListener("blur", handleBlur);
        };
    }, [enabled]);
}
