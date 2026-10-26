import "@/app/internal/EmulatorTargetDialog.css";
import {useEffect, useRef, useState, type PointerEvent} from "react";
import {saveAs} from "file-saver";
import {Dialog} from "@/controls/Dialog";
import {
    createTargetImage,
    type ScreenFrame,
    type TargetRect,
} from "@/app/internal/emulator-preview-target";

export function EmulatorTargetDialog({
    frame,
    name,
    initialRect,
    onClose,
    onSave,
}: {
    frame: ScreenFrame;
    name: string;
    initialRect?: TargetRect;
    onClose: () => void;
    onSave: (blob: Blob) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const anchorRef = useRef<{x: number; y: number}>();
    const [rect, setRect] = useState(
        initialRect ?? {
            x: 0,
            y: 24,
            width: frame.width,
            height: frame.height - 24,
        }
    );
    const [prepared, setPrepared] = useState<{
        rect: TargetRect;
        blob: Blob;
    }>();
    const [error, setError] = useState<string>();
    useEffect(() => {
        canvasRef
            .current!.getContext("2d")!
            .putImageData(
                new ImageData(frame.data, frame.width, frame.height),
                0,
                0
            );
    }, [frame]);
    const valid =
        rect.x >= 0 &&
        rect.y >= 0 &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.x + rect.width <= frame.width &&
        rect.y + rect.height <= frame.height;
    useEffect(() => {
        if (!valid) return;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            createTargetImage(frame, rect)
                .then(blob => {
                    if (cancelled) return;
                    setPrepared({rect, blob});
                    setError(undefined);
                })
                .catch(error => {
                    if (!cancelled) setError(String(error));
                });
        }, 150);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [frame, rect, valid]);
    const ready = valid && prepared?.rect === rect;

    function handleSave() {
        if (!ready || !prepared) return;
        saveAs(prepared.blob, name);
        onSave(prepared.blob);
    }

    const point = (event: PointerEvent<HTMLCanvasElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        return {
            x: Math.max(
                0,
                Math.min(
                    frame.width - 1,
                    Math.floor(
                        ((event.clientX - bounds.left) * frame.width) /
                            bounds.width
                    )
                )
            ),
            y: Math.max(
                0,
                Math.min(
                    frame.height - 1,
                    Math.floor(
                        ((event.clientY - bounds.top) * frame.height) /
                            bounds.height
                    )
                )
            ),
        };
    };
    return (
        <Dialog
            title="Save Target Image"
            className="EmulatorsPreview-TargetDialog"
            onCancel={onClose}
            doneLabel={valid && !ready ? "Preparing PNG…" : "Save PNG"}
            doneEnabled={ready}
            onDone={handleSave}>
            <p>
                Drag a rectangle around distinctive idle screen contents.
                Exclude clocks, blinking cursors, and other changing areas.
            </p>
            <div className="EmulatorsPreview-TargetScreenshot">
                <canvas
                    ref={canvasRef}
                    width={frame.width}
                    height={frame.height}
                    onPointerDown={event => {
                        if (event.button !== 0) return;
                        anchorRef.current = point(event);
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setRect({...anchorRef.current, width: 1, height: 1});
                    }}
                    onPointerMove={event => {
                        const anchor = anchorRef.current;
                        if (!anchor) return;
                        const current = point(event);
                        setRect({
                            x: Math.min(anchor.x, current.x),
                            y: Math.min(anchor.y, current.y),
                            width: Math.abs(anchor.x - current.x) + 1,
                            height: Math.abs(anchor.y - current.y) + 1,
                        });
                    }}
                    onPointerUp={event => {
                        anchorRef.current = undefined;
                        event.currentTarget.releasePointerCapture(
                            event.pointerId
                        );
                    }}
                    onPointerCancel={() => {
                        anchorRef.current = undefined;
                    }}
                />
                <div
                    className="EmulatorsPreview-TargetSelection"
                    style={{
                        left: `${(rect.x / frame.width) * 100}%`,
                        top: `${(rect.y / frame.height) * 100}%`,
                        width: `${(rect.width / frame.width) * 100}%`,
                        height: `${(rect.height / frame.height) * 100}%`,
                    }}
                />
            </div>
            <div className="EmulatorsPreview-TargetCoordinates">
                {(["x", "y", "width", "height"] as const).map(key => (
                    <label key={key}>
                        {key}
                        <input
                            type="number"
                            value={rect[key]}
                            min={key === "x" || key === "y" ? 0 : 1}
                            max={
                                key === "x" || key === "width"
                                    ? frame.width
                                    : frame.height
                            }
                            onChange={event =>
                                setRect(current => ({
                                    ...current,
                                    [key]: Math.trunc(
                                        Number(event.target.value)
                                    ),
                                }))
                            }
                        />
                    </label>
                ))}
            </div>
            <p>
                Save as <code>{name}</code> in{" "}
                <code>src/app/internal/targets/</code>, replacing the existing
                file. The PNG includes the rectangle’s screen coordinates.
            </p>
            {!valid && (
                <p role="alert">The rectangle must fit inside the screen.</p>
            )}
            {error && <p role="alert">{error}</p>}
        </Dialog>
    );
}
