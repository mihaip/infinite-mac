import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useRef,
    useMemo,
} from "react";
import {createPortal} from "react-dom";
import "./MacKeyboard.css";
import classNames from "classnames";

type MacKeyboardContextType = {
    isKeyboardVisible: boolean;
    setIsKeyboardVisible: (visible: boolean) => void;
};

const MacKeyboardContext = createContext<MacKeyboardContextType | null>(null);

export function MacKeyboardProvider({children}: {children: React.ReactNode}) {
    const [isVisible, setIsVisible] = useState(false);

    const value = useMemo(
        () => ({
            isKeyboardVisible: isVisible,
            setIsKeyboardVisible: setIsVisible,
        }),
        [isVisible, setIsVisible]
    );

    return (
        <MacKeyboardContext.Provider value={value}>
            {children}
        </MacKeyboardContext.Provider>
    );
}

export function useMacKeyboard() {
    const context = useContext(MacKeyboardContext);
    if (!context) {
        throw new Error(
            "useMacKeyboard must be used within MacKeyboardProvider"
        );
    }
    return context;
}

// Keyboard component
export type MacKeyboardProps = {
    bezelStyle: "Beige" | "Platinum" | "Pinstripes" | "NeXT";
    onKeyDown: (code: string) => void;
    onKeyUp: (code: string) => void;
    fullSize?: boolean;
};

type KeyDef = {
    code: string;
    label:
        | React.ReactNode
        | ((state: {showNumbers: boolean}) => React.ReactNode);
    shiftLabel?: string;
    special?: boolean;
    flex?: number;
    className?: string;
    action?: "toggle_numbers" | "hide_keyboard";
};

const ModifierKeys = [
    "MetaLeft",
    "MetaRight",
    "AltLeft",
    "AltRight",
    "ControlLeft",
    "ControlRight",
    "ShiftLeft",
    "ShiftRight",
    "CapsLock",
];

type ModifierKey = (typeof ModifierKeys)[number];

function isModifierKey(code: string): code is ModifierKey {
    return ModifierKeys.includes(code);
}

type MacKeyboardKeyProps = {
    label: React.ReactNode;
    onPointerDown: (e: React.PointerEvent) => void;
    active?: boolean;
    special?: boolean;
    modifier?: boolean;
    flex?: number;
    className?: string;
};

function MacKeyboardKey({
    label,
    onPointerDown,
    active,
    special,
    modifier,
    flex = 1,
    className,
}: MacKeyboardKeyProps) {
    return (
        <button
            className={classNames("MacKeyboard-Key", className, {
                "MacKeyboard-Key-Active": active,
                "MacKeyboard-Key-Special": special,
                "MacKeyboard-Key-Modifier": modifier,
            })}
            onPointerDown={onPointerDown}
            style={{flex}}>
            <span className="MacKeyboard-Key-Label">{label}</span>
        </button>
    );
}

const MOBILE_TOP_ROW_KEYS: KeyDef[] = [
    {code: "ControlLeft", label: "control"},
    {code: "AltLeft", label: "option"},
    {code: "MetaLeft", label: "⌘"},
    {code: "ShiftLeft", label: "shift"},
    {code: "Power", label: "◁", special: true},
    {code: "Done", label: "Done", special: true, action: "hide_keyboard"},
];

const MOBILE_BOTTOM_ROW_KEYS: KeyDef[] = [
    {
        code: "ToggleNumbers",
        label: state => (state.showNumbers ? "ABC" : "123"),
        special: true,
        flex: 1.5,
        action: "toggle_numbers",
    },
    {code: "Space", label: "space", flex: 4},
    {code: "Enter", label: "return", special: true, flex: 1.5},
];

const MOBILE_LETTER_KEYS: KeyDef[][] = [
    MOBILE_TOP_ROW_KEYS,
    [
        {code: "KeyQ", label: "Q"},
        {code: "KeyW", label: "W"},
        {code: "KeyE", label: "E"},
        {code: "KeyR", label: "R"},
        {code: "KeyT", label: "T"},
        {code: "KeyY", label: "Y"},
        {code: "KeyU", label: "U"},
        {code: "KeyI", label: "I"},
        {code: "KeyO", label: "O"},
        {code: "KeyP", label: "P"},
    ],
    [
        {code: "KeyA", label: "A"},
        {code: "KeyS", label: "S"},
        {code: "KeyD", label: "D"},
        {code: "KeyF", label: "F"},
        {code: "KeyG", label: "G"},
        {code: "KeyH", label: "H"},
        {code: "KeyJ", label: "J"},
        {code: "KeyK", label: "K"},
        {code: "KeyL", label: "L"},
    ],
    [
        {code: "KeyZ", label: "Z"},
        {code: "KeyX", label: "X"},
        {code: "KeyC", label: "C"},
        {code: "KeyV", label: "V"},
        {code: "KeyB", label: "B"},
        {code: "KeyN", label: "N"},
        {code: "KeyM", label: "M"},
        {code: "Backspace", label: "⌫", special: true},
    ],
    MOBILE_BOTTOM_ROW_KEYS,
];

const MOBILE_NUMBER_KEYS: KeyDef[][] = [
    MOBILE_TOP_ROW_KEYS,
    [
        {code: "Digit1", label: "1", shiftLabel: "!"},
        {code: "Digit2", label: "2", shiftLabel: "@"},
        {code: "Digit3", label: "3", shiftLabel: "#"},
        {code: "Digit4", label: "4", shiftLabel: "$"},
        {code: "Digit5", label: "5", shiftLabel: "%"},
        {code: "Digit6", label: "6", shiftLabel: "^"},
        {code: "Digit7", label: "7", shiftLabel: "&"},
        {code: "Digit8", label: "8", shiftLabel: "*"},
        {code: "Digit9", label: "9", shiftLabel: "("},
        {code: "Digit0", label: "0", shiftLabel: ")"},
    ],
    [
        {code: "Minus", label: "-", shiftLabel: "_"},
        {code: "Slash", label: "/", shiftLabel: "?"},
        {code: "Quote", label: "'", shiftLabel: '"'},
        {code: "Semicolon", label: ";", shiftLabel: ":"},
        {code: "BracketLeft", label: "[", shiftLabel: "{"},
        {code: "BracketRight", label: "]", shiftLabel: "}"},
        {code: "Backslash", label: "\\", shiftLabel: "|"},
        {code: "Equal", label: "=", shiftLabel: "+"},
        {code: "Comma", label: ",", shiftLabel: "<"},
    ],
    [
        {code: "Escape", label: "Esc"},
        {code: "Backquote", label: "`", shiftLabel: "~"},
        {code: "Period", label: ".", shiftLabel: ">"},
        {code: "ArrowLeft", label: "◀", special: true},
        {code: "ArrowRight", label: "▶", special: true},
        {code: "ArrowUp", label: "▲", special: true},
        {code: "ArrowDown", label: "▼", special: true},
        {code: "Backspace", label: "⌫", special: true},
    ],
    MOBILE_BOTTOM_ROW_KEYS,
];

const COMMAND_LABEL = (
    <>
        <span></span> <span>⌘</span>
    </>
);

const FULL_SIZE_KEYS: KeyDef[][] = [
    [
        {code: "Escape", label: "esc", special: true},
        ...new Array(12).fill(0).map((_, i) => ({
            code: `F${i + 1}`,
            label: `F${i + 1}`,
            special: true,
        })),
        {code: "Power", label: "◁"},
        {code: "Done", label: "Done", special: true, action: "hide_keyboard"},
    ],
    [
        {code: "Backquote", label: "`", shiftLabel: "~"},
        {code: "Digit1", label: "1", shiftLabel: "!"},
        {code: "Digit2", label: "2", shiftLabel: "@"},
        {code: "Digit3", label: "3", shiftLabel: "#"},
        {code: "Digit4", label: "4", shiftLabel: "$"},
        {code: "Digit5", label: "5", shiftLabel: "%"},
        {code: "Digit6", label: "6", shiftLabel: "^"},
        {code: "Digit7", label: "7", shiftLabel: "&"},
        {code: "Digit8", label: "8", shiftLabel: "*"},
        {code: "Digit9", label: "9", shiftLabel: "("},
        {code: "Digit0", label: "0", shiftLabel: ")"},
        {code: "Minus", label: "-", shiftLabel: "_"},
        {code: "Equal", label: "=", shiftLabel: "+"},
        {code: "Backspace", label: "delete", special: true, flex: 1.5},
    ],
    [
        {code: "Tab", label: "tab", special: true, flex: 1.3},
        {code: "KeyQ", label: "Q"},
        {code: "KeyW", label: "W"},
        {code: "KeyE", label: "E"},
        {code: "KeyR", label: "R"},
        {code: "KeyT", label: "T"},
        {code: "KeyY", label: "Y"},
        {code: "KeyU", label: "U"},
        {code: "KeyI", label: "I"},
        {code: "KeyO", label: "O"},
        {code: "KeyP", label: "P"},
        {code: "BracketLeft", label: "[", shiftLabel: "{"},
        {code: "BracketRight", label: "]", shiftLabel: "}"},
        {
            code: "Backslash",
            label: "\\",
            shiftLabel: "|",
            flex: 1.5,
            // Backslash and pipe look weird with italicized
            className: "MacKeyboard-Key-Normal",
        },
    ],
    [
        {
            code: "CapsLock",
            label: (
                <>
                    caps
                    <br />
                    lock
                </>
            ),
            special: true,
            flex: 1.5,
        },
        {code: "KeyA", label: "A"},
        {code: "KeyS", label: "S"},
        {code: "KeyD", label: "D"},
        {code: "KeyF", label: "F"},
        {code: "KeyG", label: "G"},
        {code: "KeyH", label: "H"},
        {code: "KeyJ", label: "J"},
        {code: "KeyK", label: "K"},
        {code: "KeyL", label: "L"},
        {code: "Semicolon", label: ";", shiftLabel: ":"},
        {code: "Quote", label: "'", shiftLabel: '"'},
        {code: "Enter", label: "return", special: true, flex: 2.3},
    ],
    [
        {code: "ShiftLeft", label: "shift", special: true, flex: 2.3},
        {code: "KeyZ", label: "Z"},
        {code: "KeyX", label: "X"},
        {code: "KeyC", label: "C"},
        {code: "KeyV", label: "V"},
        {code: "KeyB", label: "B"},
        {code: "KeyN", label: "N"},
        {code: "KeyM", label: "M"},
        {code: "Comma", label: ",", shiftLabel: "<"},
        {code: "Period", label: ".", shiftLabel: ">"},
        {code: "Slash", label: "/", shiftLabel: "?"},
        {code: "ShiftRight", label: "shift", special: true, flex: 2.7},
    ],
    [
        {code: "ControlLeft", label: "control", special: true, flex: 1.5},
        {code: "AltLeft", label: "option", special: true, flex: 1.3},
        {
            code: "MetaLeft",
            label: COMMAND_LABEL,
            special: true,
            flex: 1.5,
            className: "MacKeyboard-Key-Command",
        },
        {code: "Space", label: "", flex: 6},
        {
            code: "MetaRight",
            label: COMMAND_LABEL,
            special: true,
            flex: 1.5,
            className: "MacKeyboard-Key-Command",
        },
        {code: "AltRight", label: "option", special: true, flex: 1.3},
        {code: "ControlRight", label: "control", special: true, flex: 1.5},
        // Arrow symbols are not italicized on the Apple Extended Keyboard
        {code: "ArrowLeft", label: "⇠", className: "MacKeyboard-Key-Normal"},
        {code: "ArrowUp", label: "⇡", className: "MacKeyboard-Key-Normal"},
        {code: "ArrowDown", label: "⇣", className: "MacKeyboard-Key-Normal"},
        {code: "ArrowRight", label: "⇢", className: "MacKeyboard-Key-Normal"},
    ],
];

export function MacKeyboard({
    bezelStyle,
    onKeyDown,
    onKeyUp,
    fullSize = false,
}: MacKeyboardProps) {
    const [activeModifiers, setActiveModifiers] = useState<Set<ModifierKey>>(
        new Set()
    );
    const [showNumbers, setShowNumbers] = useState(false);
    const activeKeysRef = useRef<Set<string>>(new Set());
    const {setIsKeyboardVisible} = useMacKeyboard();

    const handleKeyPress = useCallback(
        (code: string) => {
            // Prevent duplicate key events
            if (activeKeysRef.current.has(code)) {
                return;
            }
            activeKeysRef.current.add(code);
            onKeyDown(code);

            // Auto-release non-modifier keys after a short delay
            setTimeout(() => {
                if (activeKeysRef.current.has(code)) {
                    activeKeysRef.current.delete(code);
                    onKeyUp(code);
                }
            }, 100);
        },
        [onKeyDown, onKeyUp]
    );

    const handleModifierToggle = useCallback(
        (modifier: ModifierKey) => {
            setActiveModifiers(prev => {
                const next = new Set(prev);
                if (next.has(modifier)) {
                    next.delete(modifier);
                    onKeyUp(modifier);
                } else {
                    next.add(modifier);
                    onKeyDown(modifier);
                }
                return next;
            });
        },
        [onKeyDown, onKeyUp]
    );

    const keyboardClassName = classNames(
        "MacKeyboard",
        `MacKeyboard-${bezelStyle}`,
        {"MacKeyboard-FullSize": fullSize, "MacKeyboard-Mobile": !fullSize}
    );

    const keyRows = fullSize
        ? FULL_SIZE_KEYS
        : showNumbers
          ? MOBILE_NUMBER_KEYS
          : MOBILE_LETTER_KEYS;

    const isShiftActive =
        activeModifiers.has("ShiftLeft") || activeModifiers.has("ShiftRight");

    const renderKey = (keyDef: KeyDef) => {
        const {code, label, shiftLabel, action} = keyDef;

        const displayLabel =
            typeof label === "function"
                ? label({showNumbers})
                : isShiftActive && shiftLabel
                  ? shiftLabel
                  : label;

        let handler: () => void;
        if (action === "toggle_numbers") {
            handler = () => setShowNumbers(prev => !prev);
        } else if (action === "hide_keyboard") {
            handler = setIsKeyboardVisible.bind(null, false);
        } else if (isModifierKey(code)) {
            handler = handleModifierToggle.bind(null, code);
        } else {
            handler = handleKeyPress.bind(null, code);
        }

        const active = isModifierKey(code)
            ? activeModifiers.has(code)
            : undefined;

        return (
            <MacKeyboardKey
                key={code}
                label={displayLabel}
                active={active}
                onPointerDown={e => {
                    e.preventDefault();
                    handler();
                }}
                special={keyDef.special}
                modifier={isModifierKey(code)}
                flex={keyDef.flex}
                className={keyDef.className}
            />
        );
    };

    const keyboardElement = (
        <div className={keyboardClassName}>
            {keyRows.map((row, rowIndex) => {
                return (
                    <div className="MacKeyboard-Row" key={rowIndex}>
                        {row.map(renderKey)}
                    </div>
                );
            })}
        </div>
    );

    return createPortal(keyboardElement, document.body);
}
