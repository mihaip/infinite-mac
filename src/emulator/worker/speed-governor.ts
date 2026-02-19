import {type EmulatorSpeed} from "@/emulator/common/emulators";

const ERROR_SMOOTHING_FACTOR = 0.1;
const SPEED_SMOOTHING_FACTOR = 0.001;

export class EmulatorWorkerSpeedGovernor {
    #lastInstructionCount = 0;
    #lastTime = performance.now();
    readonly #targetIPS: number; // Target instructions per second
    #targetIPMS: number; // Target instructions per millisecond, adjusted by the speed setting
    #emaErrorMs = 0; // Exponential moving average of how far we are the actual execution time.
    #currentIPMS = 0; // Exponential moving average of the instructions per millisecond that are running.

    constructor(targetIPS: number) {
        this.#targetIPS = targetIPS;
        this.#targetIPMS = targetIPS / 1000;
    }

    setSpeed(speed: EmulatorSpeed): void {
        // Use Mini vMac's speed options (-2 is default, -1 is "all out").
        this.#targetIPMS =
            speed === -2 || speed === -1
                ? 0
                : (this.#targetIPS / 1000) * Math.pow(2, speed);
        this.#emaErrorMs = 0;
    }

    get currentIPMS(): number {
        return this.#currentIPMS;
    }

    update(instructionCount: number): number {
        const deltaInstructions =
            instructionCount < this.#lastInstructionCount
                ? instructionCount // instructionCount was reset
                : instructionCount - this.#lastInstructionCount;
        this.#lastInstructionCount = instructionCount;

        const now = performance.now();
        const deltaMs = Math.max(now - this.#lastTime, 1e-3);
        this.#lastTime = now;

        const ipms = deltaInstructions / deltaMs;
        this.#currentIPMS =
            this.#currentIPMS * (1 - SPEED_SMOOTHING_FACTOR) +
            ipms * SPEED_SMOOTHING_FACTOR;

        if (this.#targetIPMS === 0) {
            return 0;
        }
        const wantDeltaMs = deltaInstructions / this.#targetIPMS;
        const errorMs = wantDeltaMs - deltaMs;

        this.#emaErrorMs =
            ERROR_SMOOTHING_FACTOR * errorMs +
            (1 - ERROR_SMOOTHING_FACTOR) * this.#emaErrorMs;
        return Math.max(this.#emaErrorMs, 0);
    }
}
