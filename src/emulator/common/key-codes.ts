/**
 * Mapping of JavaScript/DOM key codes to ADB key codes. These are sent to
 * the emulator who then turns them into ADB key events. The
 *
 * ADB values are generally from the Events.h header in the Carbon SDK (those
 * with constant comments). However, the arrow and right-hand side modifiers
 * end up being different for the Apple Extended Keyboard II keyboard that
 * Basilisk II ends up emulating. See https://github.com/tmk/tmk_keyboard/blob/d29213ff3d59707db722b161adf24aeac34e56fb/converter/adb_usb/unimap_common.h#L25-L59
 * for a more visual description of the layout and key codes.
 */
export const JS_CODE_TO_ADB_KEYCODE: {[code: string]: number} = {
    // Keys on an ANSI-standard US keyboard.
    "KeyA": 0x00, // VK_ANSI_A
    "KeyS": 0x01, // VK_ANSI_S
    "KeyD": 0x02, // VK_ANSI_D
    "KeyF": 0x03, // VK_ANSI_F
    "KeyH": 0x04, // VK_ANSI_H
    "KeyG": 0x05, // VK_ANSI_G
    "KeyZ": 0x06, // VK_ANSI_Z
    "KeyX": 0x07, // VK_ANSI_X
    "KeyC": 0x08, // VK_ANSI_C
    "KeyV": 0x09, // VK_ANSI_V
    "KeyB": 0x0b, // VK_ANSI_B
    "KeyQ": 0x0c, // VK_ANSI_Q
    "KeyW": 0x0d, // VK_ANSI_W
    "KeyE": 0x0e, // VK_ANSI_E
    "KeyR": 0x0f, // VK_ANSI_R
    "KeyY": 0x10, // VK_ANSI_Y
    "KeyT": 0x11, // VK_ANSI_T
    "Digit1": 0x12, // VK_ANSI_1
    "Digit2": 0x13, // VK_ANSI_2
    "Digit3": 0x14, // VK_ANSI_3
    "Digit4": 0x15, // VK_ANSI_4
    "Digit6": 0x16, // VK_ANSI_6
    "Digit5": 0x17, // VK_ANSI_5
    "Equal": 0x18, // kVK_ANSI_Equal
    "Digit9": 0x19, // VK_ANSI_9
    "Digit7": 0x1a, // VK_ANSI_7
    "Minus": 0x1b, // kVK_ANSI_Minus
    "Digit8": 0x1c, // VK_ANSI_8
    "Digit0": 0x1d, // VK_ANSI_0
    "BracketRight": 0x1e, // kVK_ANSI_RightBracket
    "KeyO": 0x1f, // VK_ANSI_O
    "KeyU": 0x20, // VK_ANSI_U
    "BracketLeft": 0x21, // kVK_ANSI_LeftBracket
    "KeyI": 0x22, // VK_ANSI_I
    "KeyP": 0x23, // VK_ANSI_P
    "KeyL": 0x25, // VK_ANSI_L
    "KeyJ": 0x26, // VK_ANSI_J
    "Quote": 0x27, // kVK_ANSI_Quote
    "KeyK": 0x28, // VK_ANSI_K
    "Semicolon": 0x29, // kVK_ANSI_Semicolon
    "Backslash": 0x2a, // kVK_ANSI_Backslash
    "Comma": 0x2b, // kVK_ANSI_Comma
    "Slash": 0x2c, // kVK_ANSI_Slash
    "KeyN": 0x2d, // VK_ANSI_N
    "KeyM": 0x2e, // VK_ANSI_M
    "Period": 0x2f, // kVK_ANSI_Period
    "Backquote": 0x32, // kVK_ANSI_Grave
    "NumpadDecimal": 0x41, // kVK_ANSI_KeypadDecimal
    "NumpadMultiply": 0x43, // kVK_ANSI_KeypadMultiply
    "NumpadAdd": 0x45, // kVK_ANSI_KeypadPlus
    "NumLock": 0x47, // kVK_ANSI_KeypadClear
    "NumpadDivide": 0x4b, // kVK_ANSI_KeypadDivide
    "NumpadEnter": 0x4c, // kVK_ANSI_KeypadEnter
    "NumpadMinus": 0x4e, // kVK_ANSI_KeypadMinus
    "NumpadEqual": 0x51, // kVK_ANSI_KeypadEquals
    "Numpad0": 0x52, // kVK_ANSI_Keypad0
    "Numpad1": 0x53, // kVK_ANSI_Keypad1
    "Numpad2": 0x54, // kVK_ANSI_Keypad2
    "Numpad3": 0x55, // kVK_ANSI_Keypad3
    "Numpad4": 0x56, // kVK_ANSI_Keypad4
    "Numpad5": 0x57, // kVK_ANSI_Keypad5
    "Numpad6": 0x58, // kVK_ANSI_Keypad6
    "Numpad7": 0x59, // kVK_ANSI_Keypad7
    "Numpad8": 0x5b, // kVK_ANSI_Keypad8
    "Numpad9": 0x5c, // kVK_ANSI_Keypad9
    "Enter": 0x24, // kVK_Return
    "Tab": 0x30, // kVK_Tab
    "Space": 0x31, // kVK_Space
    "Backspace": 0x33, // kVK_Delete
    "Escape": 0x35, // kVK_Escape
    "MetaLeft": 0x37, // kVK_Command
    "OSLeft": 0x37, // kVK_Command
    "ShiftLeft": 0x38, // kVK_Shift
    "CapsLock": 0x39, // kVK_CapsLock
    "AltLeft": 0x3a, // kVK_Option
    "ControlLeft": 0x36,
    "MetaRight": 0x37,
    "OSRight": 0x37,
    "ShiftRight": 0x7b,
    "AltRight": 0x7c,
    "ControlRight": 0x7d,
    "Fn": 0x72,
    "F17": 0x40, // kVK_F17
    "AudioVolumeUp": 0x48, // kVK_VolumeUp
    "AudioVolumeDown": 0x49, // kVK_VolumeDown
    "AudioVolumeMute": 0x4a, // kVK_Mute
    "F18": 0x4f, // kVK_F18
    "F19": 0x50, // kVK_F19
    "F20": 0x5a, // kVK_F20
    "F5": 0x60, // kVK_F5
    "F6": 0x61, // kVK_F6
    "F7": 0x62, // kVK_F7
    "F3": 0x63, // kVK_F3
    "F8": 0x64, // kVK_F8
    "F9": 0x65, // kVK_F9
    "F11": 0x67, // kVK_F11
    "F13": 0x69, // kVK_F13
    "F16": 0x6a, // kVK_F16
    "F14": 0x6b, // kVK_F14
    "F10": 0x6d, // kVK_F10
    "F12": 0x6f, // kVK_F12
    "F15": 0x71, // kVK_F15
    "Help": 0x72, // kVK_Help
    "Home": 0x73, // kVK_Home
    "PageUp": 0x74, // kVK_PageUp
    "Delete": 0x75, // kVK_ForwardDelete
    "F4": 0x76, // kVK_F4
    "End": 0x77, // kVK_End
    "F2": 0x78, // kVK_F2
    "PageDown": 0x79, // kVK_PageDown
    "F1": 0x7a, // kVK_F1
    "ArrowLeft": 0x3b,
    "ArrowRight": 0x3c,
    "ArrowDown": 0x3d,
    "ArrowUp": 0x3e,
    "Power": 0x7f,
};

// Overrides the subset of JS_CODE_TO_ADB_KEYCODE that have different mappings
// in Mini vMac
export const JS_CODE_TO_MINI_VMAC_KEYCODE: {[code: string]: number} = {
    "ArrowLeft": 0x7b, // MKC_Left
    "ArrowRight": 0x7c, // MKC_Right
    "ArrowDown": 0x7d, // MKC_Down
    "ArrowUp": 0x7e, // MKC_Up

    "ShiftRight": 0x38, // MKC_Shift -- no right shift key,
    "AltRight": 0x3a, // MKC_Option -- no right option key,

    // Control is not on the Mac Plus keyboard, but Mini vMac does have a keycode
    // for it.
    "ControlLeft": 0x3b, // MKC_Control
    "ControlRight": 0x3b, // MKC_Control
};

/**
 * Mapping of JavaScript/DOM key codes to NeXT key codes (see keymap.c in the
 * Previous emulator).
 */
export const JS_CODE_TO_NEXT_KEYCODE: {[code: string]: number} = {
    "KeyA": 0x39, // NEXTKEY_A
    "KeyS": 0x3a, // NEXTKEY_S
    "KeyD": 0x3b, // NEXTKEY_D
    "KeyF": 0x3c, // NEXTKEY_F
    "KeyH": 0x40, // NEXTKEY_H
    "KeyG": 0x3d, // NEXTKEY_G
    "KeyZ": 0x31, // NEXTKEY_Z
    "KeyX": 0x32, // NEXTKEY_X
    "KeyC": 0x33, // NEXTKEY_C
    "KeyV": 0x34, // NEXTKEY_V
    "KeyB": 0x35, // NEXTKEY_B
    "KeyQ": 0x42, // NEXTKEY_Q
    "KeyW": 0x43, // NEXTKEY_W
    "KeyE": 0x44, // NEXTKEY_E
    "KeyR": 0x45, // NEXTKEY_R
    "KeyY": 0x47, // NEXTKEY_Y
    "KeyT": 0x48, // NEXTKEY_T
    "Digit1": 0x4a, // NEXTKEY_1
    "Digit2": 0x4b, // NEXTKEY_2
    "Digit3": 0x4c, // NEXTKEY_3
    "Digit4": 0x4d, // NEXTKEY_4
    "Digit6": 0x4f, // NEXTKEY_6
    "Digit5": 0x50, // NEXTKEY_5
    "Equal": 0x1c, // NEXTKEY_EQUALS
    "Digit9": 0x1f, // NEXTKEY_9
    "Digit7": 0x4e, // // NEXTKEY_7
    "Minus": 0x1d, // NEXTKEY_MINUS
    "Digit8": 0x1e, // NEXTKEY_8
    "Digit0": 0x20, // NEXTKEY_0
    "BracketRight": 0x04, // NEXTKEY_CLOSEBRACKET
    "KeyO": 0x07, // NEXTKEY_o
    "KeyU": 0x46, // NEXTKEY_0
    "BracketLeft": 0x05, // NEXTKEY_OPENBRACKET
    "KeyI": 0x06, // NEXTKEY_I
    "KeyP": 0x08, // NEXTKEY_P
    "KeyL": 0x2d, // NEXTKEY_L
    "KeyJ": 0x3f, // NEXTKEY_J
    "Quote": 0x2b, // NEXTKEY_QUOTE
    "KeyK": 0x3e, // NEXTKEY_K
    "Semicolon": 0x2c, // NEXTKEY_SEMICOLON
    "Backslash": 0x03, // NEXTKEY_BACKSLASH
    "Comma": 0x2e, // NEXTKEY_COMMA
    "Slash": 0x30, // NEXTKEY_SLASH
    "KeyN": 0x37, // NEXTKEY_N
    "KeyM": 0x36, // NEXTKEY_M
    "Period": 0x2f, // NEXTKEY_PERIOD
    "Backquote": 0x26, // NEXTKEY_BACKQUOTE
    "NumpadDecimal": 0x0c, // NEXTKEY_KEYPAD_PERIOD
    "NumpadMultiply": 0x25, // NEXTKEY_KEYPAD_MULTIPLY
    "NumpadAdd": 0x15, // NEXTKEY_KEYPAD_PLUS
    "NumLock": 0x26, // NEXTKEY_BACKQUOTE
    "NumpadDivide": 0x28, // NEXTKEY_KEYPAD_DIVIDE
    "NumpadEnter": 0x0d, // NEXTKEY_KEYPAD_ENTER
    "NumpadMinus": 0x24, // NEXTKEY_KEYPAD_MINUS
    "NumpadEqual": 0x27, // NEXTKEY_KEYPAD_EQUALS
    "Numpad0": 0x0b, // NEXTKEY_KEYPAD_0
    "Numpad1": 0x11, // NEXTKEY_KEYPAD_1
    "Numpad2": 0x17, // NEXTKEY_KEYPAD_2
    "Numpad3": 0x14, // NEXTKEY_KEYPAD_3
    "Numpad4": 0x12, // NEXTKEY_KEYPAD_4
    "Numpad5": 0x18, // NEXTKEY_KEYPAD_5
    "Numpad6": 0x13, // NEXTKEY_KEYPAD_6
    "Numpad7": 0x21, // NEXTKEY_KEYPAD_7
    "Numpad8": 0x22, // NEXTKEY_KEYPAD_8
    "Numpad9": 0x23, // NEXTKEY_KEYPAD_9
    "Enter": 0x2a, // NEXTKEY_RETURN
    "Tab": 0x0, // NEXTKEY_TAB
    "Space": 0x38, // NEXTKEY_SPACE
    "Backspace": 0x1b, // NEXTKEY_DELETE
    "Escape": 0x49, // NEXTKEY_ESC
    "AudioVolumeUp": 0x1a, // NEXTKEY_VOLUME_UP
    "AudioVolumeDown": 0x02, // NEXTKEY_VOLUME_DOWN
    "F5": 0x02, // NEXTKEY_VOLUME_DOWN
    "F6": 0x1a, // NEXTKEY_VOLUME_UP
    "F10": 0x58, // NEXTKEY_POWER
    "Home": 0x1a, // NEXTKEY_VOLUME_UP
    "PageUp": 0x19, // NEXTKEY_BRIGHTNESS_UP
    "Delete": 0x58, // NEXTKEY_POWER
    "F2": 0x19, // NEXTKEY_BRIGHTNESS_UP,
    "PageDown": 0x01, // NEXTKEY_BRGHTNESS_DOWN
    "F1": 0x01, // NEXTKEY_BRGHTNESS_DOWN
    "ArrowLeft": 0x09, // NEXTKEY_LEFT_ARROW
    "ArrowRight": 0x10, // NEXTKEY_RIGHT_ARROW
    "ArrowDown": 0x0f, // NEXTKEY_DOWN_ARROW
    "ArrowUp": 0x16, // NEXTKEY_UP_ARROW
    "End": 0x02, // NEXTKEY_VOLUME_DOWN
    "Power": 0x58, // NEXTKEY_POWER

    // Modifiers are sent as separate flags
    "MetaLeft": 0x00,
    "OSLeft": 0x00,
    "ShiftLeft": 0x00,
    "CapsLock": 0x00,
    "AltLeft": 0x00,
    "ControlLeft": 0x00,
    "MetaRight": 0x00,
    "OSRight": 0x00,
    "ShiftRight": 0x00,
    "AltRight": 0x00,
    "ControlRight": 0x00,
    "Fn": 0x00,

    // Unmapped keys (NEXTKEY_NONE)
    "F3": 0x0,
    "F4": 0x0,
    "F7": 0x0,
    "F8": 0x0,
    "F9": 0x0,
    "F11": 0x0,
    "F12": 0x0,
    "F13": 0x0,
    "F15": 0x0,
    "F16": 0x0,
    "F14": 0x0,
    "F17": 0x00,
    "F18": 0x0,
    "F19": 0x0,
    "F20": 0x0,
    "AudioVolumeMute": 0x0,
    "Help": 0x0,
};
