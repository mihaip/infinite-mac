import {useState, useEffect} from "react";

export function useDevicePixelRatio() {
    const dpr = window.devicePixelRatio;
    const [currentDpr, setCurrentDpr] = useState(dpr);

    useEffect(() => {
        const updateDpr = () => setCurrentDpr(window.devicePixelRatio);
        const mediaMatcher = window.matchMedia(
            `screen and (resolution: ${currentDpr}dppx)`
        );

        if (mediaMatcher.addEventListener) {
            mediaMatcher.addEventListener("change", updateDpr);
        } else {
            mediaMatcher.addListener(updateDpr);
        }

        return () => {
            if (mediaMatcher.removeEventListener) {
                mediaMatcher.removeEventListener("change", updateDpr);
            } else {
                mediaMatcher.removeListener(updateDpr);
            }
        };
    }, [currentDpr]);

    return currentDpr;
}
