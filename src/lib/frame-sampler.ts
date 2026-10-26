/** Coalesce frequent frames without dropping the final frame when drawing stops. */
export function createFrameSampler<T>(
    interval: number,
    onFrame: (frame: T) => void
) {
    let latest: T | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    return {
        push(frame: T) {
            if (interval <= 0) {
                onFrame(frame);
                return;
            }
            latest = frame;
            timer ??= setTimeout(() => {
                timer = undefined;
                const frame = latest!;
                latest = undefined;
                onFrame(frame);
            }, interval);
        },
        dispose() {
            clearTimeout(timer);
            timer = undefined;
            latest = undefined;
        },
    };
}
