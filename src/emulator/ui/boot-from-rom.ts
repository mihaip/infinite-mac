import {type EmulatorKeyboardEvent} from "@/emulator/common/common";
import {JS_CODE_TO_ADB_KEYCODE} from "@/emulator/common/key-codes";

export class BootFromROMHelper {
    #sendKey: (event: EmulatorKeyboardEvent) => void;
    #showKeys?: (show: boolean) => void;
    #releaseTimeout?: number;
    #repeatInterval?: number;

    constructor(
        sendKey: (event: EmulatorKeyboardEvent) => void,
        showKeys?: (show: boolean) => void
    ) {
        this.#sendKey = sendKey;
        this.#showKeys = showKeys;
    }

    start() {
        if (this.#releaseTimeout !== undefined) {
            return;
        }
        this.#sendKeys("keydown");
        this.#showKeys?.(true);
        // Snow's ADB reset clears queued key events, so repeat the held keys
        // until keyboard initialization has finished.
        this.#repeatInterval = window.setInterval(
            () => this.#sendKeys("keydown"),
            50
        );
        // Release before Finder checks Command-Option for rebuilding the desktop.
        this.#releaseTimeout = window.setTimeout(() => this.stop(), 2000);
    }

    stop() {
        if (this.#releaseTimeout === undefined) {
            return;
        }
        window.clearInterval(this.#repeatInterval);
        this.#repeatInterval = undefined;
        window.clearTimeout(this.#releaseTimeout);
        this.#releaseTimeout = undefined;
        this.#sendKeys("keyup");
        this.#showKeys?.(false);
    }

    #sendKeys(type: "keydown" | "keyup") {
        for (const code of ["MetaLeft", "AltLeft", "KeyX", "KeyO"]) {
            this.#sendKey({type, keyCode: JS_CODE_TO_ADB_KEYCODE[code]});
        }
    }
}
