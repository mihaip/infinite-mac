import type {DiskDef} from "./disks";
import {DISKS_BY_YEAR} from "./disks";
import type {MachineDef} from "./machines";
import "./Browser.css";
import {ScreenFrame} from "./ScreenFrame";
import {useState} from "react";
import {Button} from "./Button";
import type {EmulatorEthernetProvider} from "./emulator/emulator-ui";
import {CloudflareWorkerEthernetProvider} from "./CloudflareWorkerEthernetProvider";

export type BrowserRunDef = {
    disk: DiskDef;
    machine: MachineDef;
    ethernetProvider?: EmulatorEthernetProvider;
};

export type BrowserProps = {
    onRun: (def: BrowserRunDef) => void;
};

export function Browser({onRun}: BrowserProps) {
    return (
        <div className="Browser">
            <h1>Infinite Mac</h1>
            {Array.from(Object.entries(DISKS_BY_YEAR), ([year, disks]) => (
                <div className="Year" key={year}>
                    <h2>{year}</h2>
                    <div className="Disks">
                        {disks.map(disk => (
                            <Disk disk={disk} onRun={onRun} key={disk.name} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export type DiskProps = {
    disk: DiskDef;
    onRun: (def: BrowserRunDef) => void;
};

function Disk(props: DiskProps) {
    return (
        <ScreenFrame
            className="Disk"
            bezelStyle={props.disk.bezelStyle}
            width={320}
            height={240}
            bezelSize="Medium"
            screen={<DiskContents {...props} />}
        />
    );
}

function DiskContents({disk, onRun}: DiskProps) {
    const [customizing, setCustomizing] = useState(false);
    const [machine, setMachine] = useState(disk.machines[0]);
    const [appleTalkEnabled, setAppleTalkEnabled] = useState(false);
    const [appleTalkZoneName, setAppleTalkZoneName] = useState("");
    const run = () => {
        let ethernetProvider;
        if (appleTalkEnabled && appleTalkZoneName) {
            ethernetProvider = new CloudflareWorkerEthernetProvider(
                appleTalkZoneName
            );
        }
        onRun({disk, machine, ethernetProvider});
    };

    let contents;
    if (customizing) {
        contents = (
            <>
                <div className="Row">
                    Machine:{" "}
                    <select
                        value={machine.name}
                        onChange={e =>
                            setMachine(disk.machines[e.target.selectedIndex])
                        }>
                        {disk.machines.map((machine, i) => (
                            <option value={machine.name} key={i}>
                                {machine.name}
                            </option>
                        ))}
                    </select>
                </div>
                {disk.appleTalkSupported && (
                    <div className="Row">
                        <label>
                            <input
                                type="checkbox"
                                checked={appleTalkEnabled}
                                onChange={() =>
                                    setAppleTalkEnabled(!appleTalkEnabled)
                                }
                            />
                            Enable AppleTalk
                        </label>{" "}
                        {appleTalkEnabled && (
                            <input
                                type="text"
                                value={appleTalkZoneName}
                                placeholder="Zone Name"
                                size={12}
                                onChange={e =>
                                    setAppleTalkZoneName(e.target.value)
                                }
                            />
                        )}
                    </div>
                )}
            </>
        );
    } else {
        contents = <div className="Row">{disk.description}</div>;
    }
    const buttonAppearance =
        disk.bezelStyle === "Beige" ? "Classic" : "Platinum";
    return (
        <div className="DiskContents">
            <h3 className="Row">
                {disk.displayName}
                {disk.displaySubtitle && (
                    <span className="Subtitle"> ({disk.displaySubtitle})</span>
                )}
            </h3>
            {contents}
            <div className="Row Buttons">
                <Button
                    appearance={buttonAppearance}
                    className="CustomizeButton"
                    onClick={() => setCustomizing(!customizing)}>
                    {customizing ? "Cancel" : "Customize…"}
                </Button>
                <Button appearance={buttonAppearance} onClick={run}>
                    Run
                </Button>
            </div>
        </div>
    );
}
