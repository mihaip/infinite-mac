import type {DiskDef} from "./disks";
import {DISKS_BY_YEAR} from "./disks";
import type {MachineDef} from "./machines";
import "./Browser.css";

export type BrowserRunDef = {
    disk: DiskDef;
    machine: MachineDef;
};

export type BrowserProps = {
    onRun: (def: BrowserRunDef) => void;
};

export function Browser({onRun}: BrowserProps) {
    return (
        <div className="Browser">
            <h1>Infinite Mac</h1>
            {Array.from(Object.entries(DISKS_BY_YEAR), ([year, disks]) => (
                <div key={year}>
                    <h2>{year}</h2>
                    <ul>
                        {disks.map(disk => (
                            <li
                                key={disk.name}
                                onClick={() =>
                                    onRun({
                                        disk,
                                        machine: disk.machines[0],
                                    })
                                }>
                                {disk.name}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}
