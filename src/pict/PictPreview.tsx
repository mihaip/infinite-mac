import {useEffect, useRef, useState} from "react";
import {renderPict} from "./renderer";
import {type PictBitmap} from "./decode";
import "./PictPreview.css";

export function PictPreview({data, size}: {data: Uint8Array; size: number}) {
    const [result, setResult] = useState<PictBitmap | string>();
    const canvas = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (data.length < size) {
            setResult("The captured PICT is incomplete.");
            return;
        }
        let cancelled = false;
        renderPict(data).then(
            bitmap => {
                if (!cancelled) setResult(bitmap);
            },
            (error: Error) => {
                if (!cancelled) setResult(error.message);
            }
        );
        return () => {
            cancelled = true;
        };
    }, [data, size]);
    useEffect(() => {
        if (result && typeof result !== "string") {
            canvas.current
                ?.getContext("2d")
                ?.putImageData(
                    new ImageData(result.rgba, result.width, result.height),
                    0,
                    0
                );
        }
    }, [result]);
    if (!result || typeof result === "string")
        return (
            <p className="MacResources-Notice">
                {result ?? "Rendering picture…"}
            </p>
        );
    return (
        <figure className="PictPreview">
            <canvas ref={canvas} width={result.width} height={result.height} />
            <figcaption>
                {result.width} × {result.height}
            </figcaption>
        </figure>
    );
}
