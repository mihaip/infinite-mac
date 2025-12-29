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
};

type KeyDef = {
    code: string;
    label: string;
    shiftLabel?: string;
    special?: boolean;
};

type ModifierKey = "MetaLeft" | "AltLeft" | "ControlLeft" | "ShiftLeft";

type MacKeyboardKeyProps = {
    label: string | React.ReactNode;
    onTouchStart: (e: React.TouchEvent) => void;
    className?: string;
    active?: boolean;
    special?: boolean;
};

function MacKeyboardKey({
    label,
    onTouchStart,
    className,
    active,
    special,
}: MacKeyboardKeyProps) {
    return (
        <button
            className={classNames("MacKeyboard-Key", className, {
                "MacKeyboard-Key-Active": active,
                "MacKeyboard-Key-Special": special,
            })}
            onTouchStart={onTouchStart}>
            <span className="MacKeyboard-Key-Label">{label}</span>
        </button>
    );
}

const LETTER_KEYS: KeyDef[][] = [
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
];

const NUMBER_KEYS: KeyDef[][] = [
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
];

export function MacKeyboard({
    bezelStyle,
    onKeyDown,
    onKeyUp,
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

    const handleKeyTouchStart = useCallback(
        (e: React.TouchEvent, code: string) => {
            e.preventDefault();
            handleKeyPress(code);
        },
        [handleKeyPress]
    );

    const handleModifierTouchStart = useCallback(
        (e: React.TouchEvent, modifier: ModifierKey) => {
            e.preventDefault();
            handleModifierToggle(modifier);
        },
        [handleModifierToggle]
    );

    const handleToggleNumbers = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        setShowNumbers(prev => !prev);
    }, []);

    const keyboardClassName = classNames(
        "MacKeyboard",
        `MacKeyboard-${bezelStyle}`
    );

    const keyRows = showNumbers ? NUMBER_KEYS : LETTER_KEYS;

    const keyboardElement = (
        <div className={keyboardClassName}>
            {/* Modifier row */}
            <div className="MacKeyboard-Row MacKeyboard-ModifierRow">
                <MacKeyboardKey
                    label="control"
                    className="MacKeyboard-Modifier"
                    active={activeModifiers.has("ControlLeft")}
                    onTouchStart={e =>
                        handleModifierTouchStart(e, "ControlLeft")
                    }
                />
                <MacKeyboardKey
                    label="option"
                    className="MacKeyboard-Modifier"
                    active={activeModifiers.has("AltLeft")}
                    onTouchStart={e => handleModifierTouchStart(e, "AltLeft")}
                />
                <MacKeyboardKey
                    label="⌘"
                    className="MacKeyboard-Modifier"
                    active={activeModifiers.has("MetaLeft")}
                    onTouchStart={e => handleModifierTouchStart(e, "MetaLeft")}
                />
                <MacKeyboardKey
                    label="shift"
                    className="MacKeyboard-Modifier"
                    active={activeModifiers.has("ShiftLeft")}
                    onTouchStart={e => handleModifierTouchStart(e, "ShiftLeft")}
                />
                <MacKeyboardKey
                    label="Done"
                    onTouchStart={e => setIsKeyboardVisible(false)}
                    className="MacKeyboard-Modifier"
                    special
                />
            </div>

            {/* Letter/Number rows */}
            {keyRows.map((row, rowIndex) => (
                <div className="MacKeyboard-Row" key={rowIndex}>
                    {row.map(({code, label, shiftLabel, special}) => {
                        const isShiftActive = activeModifiers.has("ShiftLeft");
                        const displayLabel =
                            showNumbers && isShiftActive && shiftLabel
                                ? shiftLabel
                                : label;
                        return (
                            <MacKeyboardKey
                                key={code}
                                label={displayLabel}
                                active={activeKeysRef.current.has(code)}
                                onTouchStart={e => handleKeyTouchStart(e, code)}
                                special={special}
                            />
                        );
                    })}
                </div>
            ))}

            {/* Bottom row */}
            <div className="MacKeyboard-Row MacKeyboard-BottomRow">
                <MacKeyboardKey
                    label={showNumbers ? "ABC" : "123"}
                    special
                    onTouchStart={handleToggleNumbers}
                />
                <MacKeyboardKey
                    label="space"
                    className="MacKeyboard-Space"
                    onTouchStart={e => handleKeyTouchStart(e, "Space")}
                />
                <MacKeyboardKey
                    label="return"
                    special
                    onTouchStart={e => handleKeyTouchStart(e, "Enter")}
                />
            </div>
        </div>
    );

    return createPortal(keyboardElement, document.body);
}
