import "@/app/MacEmulatorStats.css";
import {type EmulatorStats} from "@/emulator/common/common";

export function MacEmulatorStats({stats}: {stats: EmulatorStats}) {
    if (Object.keys(stats).length === 0) {
        return null;
    }
    return (
        <div className="Mac-Emulator-Stats">
            <div className="Mac-Emulator-Stats-Details">
                <b>Emulator Stats:</b>
                <ul>
                    {stats.effectiveSpeed !== undefined && (
                        <li>
                            <b>Effective Speed:</b>{" "}
                            {stats.effectiveSpeed.toFixed(1)}x
                        </li>
                    )}
                    {stats.currentIPMS !== undefined && (
                        <li>
                            <b>Instructions/second:</b>{" "}
                            {(stats.currentIPMS / 1000).toFixed(1)}M
                        </li>
                    )}
                    {stats.diskBytesRead !== undefined && (
                        <li>
                            <b>Disk Reads:</b> {formatSize(stats.diskBytesRead)}
                        </li>
                    )}
                    {stats.diskBytesWritten !== undefined && (
                        <li>
                            <b>Disk Writes:</b>{" "}
                            {formatSize(stats.diskBytesWritten)}
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
}

function formatSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
}
