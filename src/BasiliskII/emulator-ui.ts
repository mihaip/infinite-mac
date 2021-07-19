import {EmulatorWorkerConfig} from "./emulator-common";
import Worker from "worker-loader!./emulator-worker";
import {EmulatorAudio} from "./emulator-ui-audio";
import {EmulatorInput} from "./emulator-ui-input";
import {EmulatorVideo} from "./emulator-ui-video";

export type EmulatorConfig = {
    screenWidth: number;
    screenHeight: number;
    screenCanvas: HTMLCanvasElement;
    basiliskPrefsPath: string;
    romPath: string;
    disk1Path: string;
    disk2Path: string;
};

export class Emulator {
    #config: EmulatorConfig;
    #worker: Worker;

    #screenCanvasContext: CanvasRenderingContext2D;
    #screenImageData: ImageData;

    #video: EmulatorVideo;
    #input: EmulatorInput;
    #audio: EmulatorAudio;
    #startedAudio: boolean = false;

    constructor(config: EmulatorConfig) {
        this.#config = config;
        this.#worker = new Worker();
        const {screenCanvas: canvas, screenWidth, screenHeight} = this.#config;

        this.#screenCanvasContext = canvas.getContext("2d", {
            desynchronized: true,
        })!;
        this.#screenImageData = this.#screenCanvasContext.createImageData(
            screenWidth,
            screenHeight
        );

        this.#video = new EmulatorVideo(config);
        this.#input = new EmulatorInput();
        this.#audio = new EmulatorAudio();
    }

    start() {
        const {screenCanvas: canvas} = this.#config;
        canvas.addEventListener("mousemove", this.#handleMouseMove);
        canvas.addEventListener("mousedown", this.#handleMouseDown);
        canvas.addEventListener("mouseup", this.#handleMouseUp);
        window.addEventListener("keydown", this.#handleKeyDown);
        window.addEventListener("keyup", this.#handleKeyUp);

        document.addEventListener(
            "visibilitychange",
            this.#handleVisibilityChange
        );

        this.#worker.addEventListener("message", this.#handleWorkerMessage);

        const config: EmulatorWorkerConfig = {
            autoloadFiles: {
                "MacOS753": this.#config.disk1Path,
                "Games.img": this.#config.disk2Path,
                "Quadra-650.rom": this.#config.romPath,
                "prefs": this.#config.basiliskPrefsPath,
            },
            arguments: ["--config", "prefs"],

            video: this.#video.workerConfig(),
            input: this.#input.workerConfig(),
            audio: this.#audio.workerConfig(),
        };
        this.#worker.postMessage(config);
    }

    stop() {
        const {screenCanvas: canvas} = this.#config;
        canvas.removeEventListener("mousemove", this.#handleMouseMove);
        canvas.removeEventListener("mousedown", this.#handleMouseDown);
        canvas.removeEventListener("mouseup", this.#handleMouseUp);
        window.removeEventListener("keydown", this.#handleKeyDown);
        window.removeEventListener("keyup", this.#handleKeyUp);

        document.removeEventListener(
            "visibilitychange",
            this.#handleVisibilityChange
        );

        this.#worker.removeEventListener("message", this.#handleWorkerMessage);

        this.#worker.postMessage({
            // TODO
        });
    }

    #handleMouseMove = (event: MouseEvent) => {
        this.#input.handleInput({
            type: "mousemove",
            dx: event.offsetX,
            dy: event.offsetY,
        });
    };

    #handleMouseDown = (event: MouseEvent) => {
        if (!this.#startedAudio) {
            this.#audio.start();
            this.#startedAudio = true;
        }
        this.#input.handleInput({type: "mousedown"});
    };

    #handleMouseUp = (event: MouseEvent) => {
        this.#input.handleInput({type: "mouseup"});
    };

    #handleKeyDown = (event: KeyboardEvent) => {
        this.#input.handleInput({type: "keydown", keyCode: event.keyCode});
    };

    #handleKeyUp = (event: KeyboardEvent) => {
        this.#input.handleInput({type: "keyup", keyCode: event.keyCode});
    };

    #handleWorkerMessage = (e: MessageEvent) => {
        if (
            e.data.type === "emulator_ready" ||
            e.data.type === "emulator_loading"
        ) {
            document.body.className =
                e.data.type === "emulator_ready" ? "" : "loading";

            /* TODO: progress
            const progressElement =
                basiliskConfig.progressElement ||
                document.getElementById("progress");
            if (progressElement) {
                if (e.data.type === "emulator_loading") {
                    progressElement.value = Math.max(
                        10,
                        e.data.completion * 100
                    );
                    progressElement.max = 100;
                    progressElement.hidden = false;
                } else {
                    progressElement.value = null;
                    progressElement.max = null;
                    progressElement.hidden = true;
                }
            }
            */
        } else if (e.data.type === "emulator_blit") {
            this.#drawScreen();
        }
    };

    #handleVisibilityChange = () => {
        this.#drawScreen();
    };

    #drawScreen() {
        if (document.hidden) {
            return;
        }
        this.#video.putImageData(this.#screenImageData);
        this.#screenCanvasContext.putImageData(this.#screenImageData, 0, 0);
    }
}
