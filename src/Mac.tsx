import {useEffect, useRef} from "react";
import "./Mac.css";
import basiliskPrefsPath from "./Data/BasiliskIIPrefs.txt";
import quadraRomPath from "./Data/Quadra-650.rom.gz";
import macOs753ImagePath from "./Data/MacOS753.img.gz";
import gamesImagePath from "./Data/Games.img.gz";

const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

export function Mac() {
    const screeRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const emulatorConfig = {
            screenWidth: SCREEN_WIDTH,
            screenHeight: SCREEN_HEIGHT,
            screenCanvas: screeRef.current,
            basiliskPrefsPath,
            quadraRomPath,
            macOs753ImagePath,
            gamesImagePath,
        };
        console.log("Should start emulator with config", emulatorConfig);
        return () => {
            console.log("Should stop emulator");
        };
    }, []);
    return (
        <div
            className="Mac"
            style={{width: SCREEN_WIDTH, height: SCREEN_HEIGHT}}>
            <canvas
                className="Mac-Screen"
                ref={screeRef}
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                onContextMenu={e => e.preventDefault()}
            />
        </div>
    );
}
