import {useCallback, useEffect, useRef, useState} from "react";

export function useScreenRecording(
    screenSize: {width: number; height: number},
    onRecording: (blob: Blob) => void,
    onError: (error: unknown) => void
): {
    isRecording: boolean;
    handleFrame: (imageData: ImageData) => void;
    toggleRecording: () => void;
} {
    const recordingRef = useRef<Recording>();
    const latestFrameRef = useRef<ImageData>();
    const [isRecording, setIsRecording] = useState(false);

    // Keep this callback stable: changing recording state must not restart the
    // emulator effect that supplies its delegate callbacks.
    const handleFrame = useCallback((imageData: ImageData) => {
        latestFrameRef.current = imageData;
        const recording = recordingRef.current;
        if (recording?.recorder.state === "recording") {
            drawRecordingFrame(recording, imageData);
        }
    }, []);

    useEffect(() => {
        return () => {
            latestFrameRef.current = undefined;
            const recorder = recordingRef.current?.recorder;
            if (!recorder) {
                return;
            }
            // Discard unfinished recordings when leaving the Mac, and don't
            // download or update React state after unmounting.
            recorder.ondataavailable = null;
            recorder.onstop = null;
            recorder.onerror = null;
            if (recorder.state !== "inactive") {
                recorder.stop();
            }
            recorder.stream.getTracks().forEach(track => track.stop());
            recordingRef.current = undefined;
        };
    }, []);

    const toggleRecording = () => {
        const currentRecorder = recordingRef.current?.recorder;
        if (currentRecorder) {
            // Keep the recorder until the final dataavailable/stop events, so
            // rapid clicks can't start a second recording while it finalizes.
            if (currentRecorder.state !== "inactive") {
                currentRecorder.stop();
            }
            return;
        }
        let stream: MediaStream | undefined;
        try {
            // The capture canvas keeps its initial size for the entire video,
            // even when the emulator switches video modes. This lets us use
            // avc1 MP4 without changing decoder settings during playback.
            const canvas = document.createElement("canvas");
            canvas.width = screenSize.width;
            canvas.height = screenSize.height;
            if (
                typeof canvas.captureStream !== "function" ||
                typeof MediaRecorder === "undefined"
            ) {
                throw new Error(
                    "Screen recording is not supported by this browser"
                );
            }
            const mimeType = RECORDING_MIME_TYPES.find(type =>
                MediaRecorder.isTypeSupported(type)
            );
            if (!mimeType) {
                throw new Error("No supported screen recording format");
            }
            const context = canvas.getContext("2d", {alpha: false});
            if (!context) {
                throw new Error("Could not create recording canvas");
            }
            // Capture when the delegate supplies a frame, without imposing
            // a frame-rate cap or requiring explicit requestFrame calls.
            stream = canvas.captureStream();
            const recorder = new MediaRecorder(stream, {mimeType});
            const chunks: Blob[] = [];
            let failed = false;
            recorder.ondataavailable = event => {
                if (event.data.size) {
                    chunks.push(event.data);
                }
            };
            recorder.onerror = event => {
                failed = true;
                onError(event);
            };
            recorder.onstop = () => {
                recorder.stream.getTracks().forEach(track => track.stop());
                recordingRef.current = undefined;
                setIsRecording(false);
                if (failed) {
                    return;
                }
                if (!chunks.length) {
                    onError(new Error("No video frames were recorded"));
                    return;
                }
                onRecording(
                    new Blob(chunks, {
                        type: recorder.mimeType || chunks[0].type || mimeType,
                    })
                );
            };
            const recording = {recorder, context};
            // Capture the initial frame.
            if (latestFrameRef.current) {
                drawRecordingFrame(recording, latestFrameRef.current);
            } else {
                context.fillStyle = "black";
                context.fillRect(0, 0, canvas.width, canvas.height);
            }
            recorder.start(1000);
            recordingRef.current = recording;
            setIsRecording(true);
        } catch (error) {
            stream?.getTracks().forEach(track => track.stop());
            recordingRef.current = undefined;
            onError(error);
        }
    };

    return {isRecording, toggleRecording, handleFrame};
}

// Prefer MP4 with H.264 for compatibility with video players and editors.
// Fall back to WebM when the browser can't record MP4.
const RECORDING_MIME_TYPES = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp8",
    "video/webm",
];

type Recording = {
    recorder: MediaRecorder;
    context: CanvasRenderingContext2D;
};

function drawRecordingFrame({context}: Recording, imageData: ImageData) {
    const {width, height} = context.canvas;
    // Keep the screen origin and pixels stable across resolution changes.
    // Smaller frames leave black space; larger frames are cropped by the canvas.
    if (width < imageData.width || height < imageData.height) {
        context.fillStyle = "black";
        context.fillRect(0, 0, width, height);
    }
    context.putImageData(imageData, 0, 0);
}
