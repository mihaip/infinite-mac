import {useCallback, useEffect, useMemo, useRef} from "react";
import {type Disk} from "@/monkey/disks";
import {type EmbedControlEvent} from "@/embed-types";
import {sleep} from "@/monkey/util";
import {
    type ComputerAction,
    type Computer,
    type ComputerMouseButton,
} from "@/monkey/Computer";

export function useComputer(
    disk: Disk,
    iframeRef: React.RefObject<HTMLIFrameElement>
): Computer {
    const [displayWidth, displayHeight] = disk.screenSize;
    const screenContentsRef = useRef<Uint8ClampedArray | null>(null);
    useEffect(() => {
        const messageListener = (event: MessageEvent) => {
            if (event.data.type === "emulator_screen") {
                screenContentsRef.current = event.data.data;
            }
        };
        window.addEventListener("message", messageListener);
        return () => {
            window.removeEventListener("message", messageListener);
        };
    }, [iframeRef]);

    const [scratchCanvas, scratchContext] = useMemo(() => {
        const canvas = document.createElement("canvas");
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        return [canvas, canvas.getContext("2d")!] as const;
    }, [displayWidth, displayHeight]);

    const currentScreenContents = useCallback(() => {
        if (!screenContentsRef.current) {
            return null;
        }
        scratchContext.putImageData(
            new ImageData(
                screenContentsRef.current,
                displayWidth,
                displayHeight
            ),
            0,
            0
        );
        return scratchCanvas.toDataURL("image/png");
    }, [displayWidth, displayHeight, scratchContext, scratchCanvas]);

    const handleAction = useCallback(
        async (action: ComputerAction, signal?: AbortSignal) => {
            signal?.throwIfAborted();
            if (!iframeRef.current) {
                console.warn("No iframe reference available to handle action");
                return;
            }

            const pressedKeys = new Set<string>();
            const pressedButtons = new Set<ComputerMouseButton>();
            async function pause(ms: number) {
                await sleep(ms, signal);
            }

            function sendEvent(event: EmbedControlEvent) {
                iframeRef.current?.contentWindow?.postMessage(event, "*");
            }

            function sendMouseMove(x: number, y: number) {
                sendEvent({
                    type: "emulator_mouse_move",
                    x,
                    y,
                    deltaX: 0,
                    deltaY: 0,
                });
            }

            function toButtonNumber(button: ComputerMouseButton): number {
                switch (button) {
                    case "left":
                        return 0;
                    case "wheel":
                        return 1;
                    case "right":
                        return 2;
                    default:
                        console.warn("Unknown mouse button:", button);
                        return 0; // Default to left button
                }
            }

            function sendMouseDown(button: ComputerMouseButton = "left") {
                pressedButtons.add(button);
                sendEvent({
                    type: "emulator_mouse_down",
                    button: toButtonNumber(button),
                });
            }

            function sendMouseUp(button: ComputerMouseButton = "left") {
                pressedButtons.delete(button);
                sendEvent({
                    type: "emulator_mouse_up",
                    button: toButtonNumber(button),
                });
            }
            async function sendMouseClick(
                button: ComputerMouseButton = "left"
            ) {
                sendMouseDown(button);
                await pause(100); // Simulate a short delay for the click
                sendMouseUp(button);
            }

            function sendKeyDown(code: string) {
                pressedKeys.add(code);
                sendEvent({type: "emulator_key_down", code});
            }
            function sendKeyUp(code: string) {
                pressedKeys.delete(code);
                sendEvent({type: "emulator_key_up", code});
            }
            async function sendKeyPress(code: string) {
                sendKeyDown(code);
                await pause(50); // Simulate a short delay for the key press
                sendKeyUp(code);
            }

            const modifierCodes = (action.modifiers ?? [])
                .map(key => KEYPRESS_MAP[key.toUpperCase()])
                .filter(Boolean);
            for (const code of modifierCodes) {
                sendKeyDown(code);
            }
            try {
                console.log("Handling action:", action);
                switch (action.type) {
                    case "mouse_down":
                        sendMouseDown(action.button);
                        await pause(100);
                        break;
                    case "mouse_up":
                        sendMouseUp(action.button);
                        await pause(100);
                        break;
                    case "click":
                        if (action.x !== undefined && action.y !== undefined) {
                            sendMouseMove(action.x, action.y);
                        }
                        await pause(100);
                        await sendMouseClick(action.button);
                        break;
                    case "double_click":
                        if (action.x !== undefined && action.y !== undefined) {
                            sendMouseMove(action.x, action.y);
                        }
                        await pause(100);
                        await sendMouseClick();
                        await pause(100); // Simulate a short delay before the second click
                        await sendMouseClick();
                        break;
                    case "triple_click":
                        if (action.x !== undefined && action.y !== undefined) {
                            sendMouseMove(action.x, action.y);
                        }
                        await pause(100);
                        await sendMouseClick();
                        await pause(100); // Simulate a short delay before the second click
                        await sendMouseClick();
                        await pause(100); // Simulate a short delay before the third click
                        await sendMouseClick();
                        break;
                    case "drag": {
                        const path = Array.from(action.path);
                        const start = path.shift();
                        if (!start) {
                            console.warn("Drag action has no start point");
                            return;
                        }
                        sendMouseMove(start.x, start.y);
                        await pause(100);
                        sendMouseDown();
                        await pause(250);
                        for (const point of path) {
                            sendMouseMove(point.x, point.y);
                            await pause(250); // Simulate a short delay between moves
                        }
                        sendMouseUp();
                        break;
                    }
                    case "move":
                        sendMouseMove(action.x, action.y);
                        break;
                    case "scroll":
                        if (action.x !== undefined && action.y !== undefined) {
                            sendMouseMove(action.x, action.y);
                        }
                        if (action.scroll_x !== 0) {
                            await sendKeyPress(
                                action.scroll_x < 0 ? "ArrowLeft" : "ArrowRight"
                            );
                        }
                        if (action.scroll_y !== 0) {
                            await sendKeyPress(
                                action.scroll_y < 0 ? "ArrowUp" : "ArrowDown"
                            );
                        }
                        break;
                    case "type":
                        for (const char of action.text) {
                            if (char in SHIFT_MAP) {
                                const code = SHIFT_MAP[char];
                                sendKeyDown("ShiftLeft");
                                await sendKeyPress(code);
                                sendKeyUp("ShiftLeft");
                            } else if (char in CHAR_MAP) {
                                const code = CHAR_MAP[char];
                                await sendKeyPress(code);
                            } else {
                                console.warn(
                                    "Unknown character:",
                                    char,
                                    char.charCodeAt(0)
                                );
                            }
                        }
                        break;
                    case "keypress": {
                        const codes = action.keys
                            .map(key => KEYPRESS_MAP[key.toUpperCase()])
                            .filter(Boolean);
                        for (let i = 0; i < (action.repeat ?? 1); i++) {
                            for (const code of codes) {
                                sendKeyDown(code);
                                await pause(10);
                            }
                            await pause(action.durationMs ?? 100);
                            for (const code of [...codes].reverse()) {
                                sendKeyUp(code);
                                await pause(10);
                            }
                        }
                        break;
                    }

                    case "screenshot":
                        // No action needed, the screenshot is always sent
                        break;
                    case "wait":
                        await pause(action.durationMs ?? 100);
                }
            } finally {
                // Stop can interrupt typing, a long wait, or a held key.
                if (signal?.aborted) {
                    for (const code of pressedKeys) {
                        sendKeyUp(code);
                    }
                    for (const button of pressedButtons) {
                        sendMouseUp(button);
                    }
                }
                for (const code of [...modifierCodes].reverse()) {
                    sendKeyUp(code);
                }
            }
        },
        [iframeRef]
    );

    return useMemo(() => {
        return {
            displayWidth,
            displayHeight,
            currentScreenContents,
            handleAction,
            instructions: disk.instructions,
        };
    }, [
        disk.instructions,
        displayWidth,
        displayHeight,
        currentScreenContents,
        handleAction,
    ]);
}

const SHIFT_MAP: {[char: string]: string} = {
    "A": "KeyA",
    "B": "KeyB",
    "C": "KeyC",
    "D": "KeyD",
    "E": "KeyE",
    "F": "KeyF",
    "G": "KeyG",
    "H": "KeyH",
    "I": "KeyI",
    "J": "KeyJ",
    "K": "KeyK",
    "L": "KeyL",
    "M": "KeyM",
    "N": "KeyN",
    "O": "KeyO",
    "P": "KeyP",
    "Q": "KeyQ",
    "R": "KeyR",
    "S": "KeyS",
    "T": "KeyT",
    "U": "KeyU",
    "V": "KeyV",
    "W": "KeyW",
    "X": "KeyX",
    "Y": "KeyY",
    "Z": "KeyZ",
    "!": "Digit1",
    "@": "Digit2",
    "#": "Digit3",
    "$": "Digit4",
    "%": "Digit5",
    "^": "Digit6",
    "&": "Digit7",
    "*": "Digit8",
    "(": "Digit9",
    ")": "Digit0",
    "_": "Minus",
    "+": "Equal",
    "{": "BracketLeft",
    "}": "BracketRight",
    "|": "Backslash",
    ":": "Semicolon",
    '"': "Quote",
    "<": "Comma",
    ">": "Period",
    "?": "Slash",
    "~": "Backquote",
};

const CHAR_MAP: {[char: string]: string} = {
    "a": "KeyA",
    "b": "KeyB",
    "c": "KeyC",
    "d": "KeyD",
    "e": "KeyE",
    "f": "KeyF",
    "g": "KeyG",
    "h": "KeyH",
    "i": "KeyI",
    "j": "KeyJ",
    "k": "KeyK",
    "l": "KeyL",
    "m": "KeyM",
    "n": "KeyN",
    "o": "KeyO",
    "p": "KeyP",
    "q": "KeyQ",
    "r": "KeyR",
    "s": "KeyS",
    "t": "KeyT",
    "u": "KeyU",
    "v": "KeyV",
    "w": "KeyW",
    "x": "KeyX",
    "y": "KeyY",
    "z": "KeyZ",
    "1": "Digit1",
    "2": "Digit2",
    "3": "Digit3",
    "4": "Digit4",
    "5": "Digit5",
    "6": "Digit6",
    "7": "Digit7",
    "8": "Digit8",
    "9": "Digit9",
    "0": "Digit0",
    "-": "Minus",
    "=": "Equal",
    "[": "BracketLeft",
    "]": "BracketRight",
    "\\": "Backslash",
    ";": "Semicolon",
    "'": "Quote",
    ",": "Comma",
    ".": "Period",
    "/": "Slash",
    "`": "Backquote",
    " ": "Space",
    "\n": "Enter",
    "\r": "Enter",
    "\t": "Tab",
};

const KEYPRESS_MAP: {[key: string]: string} = {
    "CMD": "MetaLeft",
    "COMMAND": "MetaLeft",
    "META": "MetaLeft",
    "SUPER": "MetaLeft",
    "CONTROL": "ControlLeft",
    "OPTION": "AltLeft",
    "RETURN": "Enter",
    "ENTER": "Enter",
    "ESC": "Escape",
    "ESCAPE": "Escape",
    "TAB": "Tab",
    "SPACE": "Space",
    "BACKSPACE": "Backspace",
    "DELETE": "Delete",
    "UP": "ArrowUp",
    "DOWN": "ArrowDown",
    "LEFT": "ArrowLeft",
    "RIGHT": "ArrowRight",
    "ARROWUP": "ArrowUp",
    "ARROWDOWN": "ArrowDown",
    "ARROWLEFT": "ArrowLeft",
    "ARROWRIGHT": "ArrowRight",
    "HOME": "Home",
    "END": "End",
    "PAGEUP": "PageUp",
    "PAGEDOWN": "PageDown",
    "PAGE_UP": "PageUp",
    "PAGE_DOWN": "PageDown",
    "PRIOR": "PageUp",
    "NEXT": "PageDown",
    "F1": "F1",
    "F2": "F2",
    "F3": "F3",
    "F4": "F4",
    "F5": "F5",
    "F6": "F6",
    "F7": "F7",
    "F8": "F8",
    "F9": "F9",
    "F10": "F10",
    "F11": "F11",
    "F12": "F12",
    "CTRL": "ControlLeft",
    "SHIFT": "ShiftLeft",
    "ALT": "AltLeft",
    "A": "KeyA",
    "B": "KeyB",
    "C": "KeyC",
    "D": "KeyD",
    "E": "KeyE",
    "F": "KeyF",
    "G": "KeyG",
    "H": "KeyH",
    "I": "KeyI",
    "J": "KeyJ",
    "K": "KeyK",
    "L": "KeyL",
    "M": "KeyM",
    "N": "KeyN",
    "O": "KeyO",
    "P": "KeyP",
    "Q": "KeyQ",
    "R": "KeyR",
    "S": "KeyS",
    "T": "KeyT",
    "U": "KeyU",
    "V": "KeyV",
    "W": "KeyW",
    "X": "KeyX",
    "Y": "KeyY",
    "Z": "KeyZ",
    "1": "Digit1",
    "2": "Digit2",
    "3": "Digit3",
    "4": "Digit4",
    "5": "Digit5",
    "6": "Digit6",
    "7": "Digit7",
    "8": "Digit8",
    "9": "Digit9",
    "0": "Digit0",
};
