export class EmulatorTrackpadController {
    #delegate: EmulatorTrackpadControllerDelegate;
    #pointerDown = false;

    #pointerDownStartTime = 0;
    #pointerDownX = 0;
    #pointerDownY = 0;
    #previousMoveTime = 0;
    #pointerDownIsMove = false;

    #dragTimeout = 0;
    #pointerDownIsDrag = false;

    constructor(delegate: EmulatorTrackpadControllerDelegate) {
        this.#delegate = delegate;
    }

    handlePointerDown(event: PointerEvent) {
        if (event.target && "setPointerCapture" in event.target) {
            (event.target as Element).setPointerCapture(event.pointerId);
        }
        this.#pointerDown = true;
        this.#pointerDownIsMove = false;
        this.#pointerDownStartTime = event.timeStamp;
        this.#pointerDownX = event.clientX;
        this.#pointerDownY = event.clientY;
    }

    handlePointerUp(event: PointerEvent) {
        this.#pointerDown = false;
        if (this.#pointerDownIsDrag) {
            if (!this.#pointerDownIsMove) {
                this.#pointerDownIsDrag = false;
                this.#delegate.trackpadButtonUp(0);
            }
        } else if (!this.#pointerDownIsMove) {
            const pointerDownTime =
                event.timeStamp - this.#pointerDownStartTime;
            if (pointerDownTime < MOVE_TIME_THRESHOLD) {
                if (this.#dragTimeout) {
                    // We got another pointer down and up before we had released
                    // the button from the previous one. This is a double-click,
                    // send the rest of the events to the delegate.
                    window.clearTimeout(this.#dragTimeout);
                    this.#dragTimeout = 0;
                    this.#delegate.trackpadButtonUp(0);
                    window.setTimeout(
                        () => this.#delegate.trackpadButtonDown(0),
                        33
                    );
                    window.setTimeout(
                        () => this.#delegate.trackpadButtonUp(0),
                        66
                    );
                } else {
                    // Begin holding down the button, and set a timeout to
                    // release that will be cancelled if this turns out to be a
                    // drag.
                    this.#delegate.trackpadButtonDown(0);
                    this.#dragTimeout = window.setTimeout(() => {
                        this.#delegate.trackpadButtonUp(0);
                        this.#dragTimeout = 0;
                    }, DRAG_TIME_THRESHOLD);
                }
            }
        }
        this.#pointerDownIsMove = false;
    }

    handlePointerMove(event: PointerEvent) {
        if (!this.#pointerDown) {
            return;
        }

        const deltaX = event.clientX - this.#pointerDownX;
        const deltaY = event.clientY - this.#pointerDownY;
        if (
            !this.#pointerDownIsMove &&
            deltaX * deltaX + deltaY * deltaY < MOVE_DISTANCE_THRESHOLD_SQ
        ) {
            return;
        }

        if (!this.#pointerDownIsDrag && this.#dragTimeout) {
            this.#pointerDownIsDrag = true;
            window.clearTimeout(this.#dragTimeout);
            this.#dragTimeout = 0;
        }

        if (this.#pointerDownIsMove) {
            this.#delegate.trackpadDidMove(
                ...accelerate(
                    event.movementX,
                    event.movementY,
                    event.timeStamp - this.#previousMoveTime
                )
            );
        } else {
            this.#pointerDownIsMove = true;
        }
        this.#previousMoveTime = event.timeStamp;
    }
}

// If the pointer moves less than this distance, it's considered a click
const MOVE_DISTANCE_THRESHOLD_SQ = 20 * 20;

// If the pointer is down for less than this time, it's considered a click
const MOVE_TIME_THRESHOLD = 200;

// If we do a click followed by another pointer down and move within this time,
// it's considered a drag operation (with the button held down).
const DRAG_TIME_THRESHOLD = 300;

function accelerate(
    deltaX: number,
    deltaY: number,
    deltaMs: number
): [x: number, y: number] {
    const deviceSpeed = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaMs;
    // Linear at slow speeds
    if (deviceSpeed <= 0.5) {
        return [deltaX, deltaY];
    }
    // Slightly faster at medium speeds
    if (deviceSpeed <= 1) {
        return [deltaX * 2, deltaY * 2];
    }
    // Quadratic at high speeds
    const cursorSpeed = Math.pow(deviceSpeed, 2);
    const multiplier = cursorSpeed / deviceSpeed;
    return [deltaX * multiplier, deltaY * multiplier];
}

export interface EmulatorTrackpadControllerDelegate {
    trackpadDidMove(deltaX: number, deltaY: number): void;
    trackpadButtonDown(button: number): void;
    trackpadButtonUp(button: number): void;
}
