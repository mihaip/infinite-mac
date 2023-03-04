import type {DiskDef} from "./disks";
import {DISKS_BY_YEAR} from "./disks";
import type {MachineDef} from "./machines";
import "./Browser.css";
import {ScreenFrame} from "./ScreenFrame";
import {useState} from "react";
import {Button} from "./Button";
import type {EmulatorEthernetProvider} from "./emulator/emulator-ui";
import {CloudflareWorkerEthernetProvider} from "./CloudflareWorkerEthernetProvider";

export type BrowserProps = {
    onRun: (def: BrowserRunDef, inNewWindow?: boolean) => void;
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
    onRun: (def: BrowserRunDef, inNewWindow?: boolean) => void;
};

function Disk(props: DiskProps) {
    const [bezelStyle, setBezelStyle] = useState(
        props.disk.machines[0].bezelStyle
    );
    return (
        <ScreenFrame
            className="Disk"
            bezelStyle={bezelStyle}
            width={320}
            height={240}
            bezelSize="Medium"
            screen={<DiskContents setBezelStyle={setBezelStyle} {...props} />}
        />
    );
}

export type DiskContentsContents = {
    disk: DiskDef;
    onRun: (def: BrowserRunDef, inNewWindow?: boolean) => void;
    setBezelStyle: (bezelStyle: MachineDef["bezelStyle"]) => void;
};

function DiskContents({disk, onRun, setBezelStyle}: DiskContentsContents) {
    const [customizing, setCustomizing] = useState(false);
    const [machine, setMachine] = useState(disk.machines[0]);
    const [appleTalkEnabled, setAppleTalkEnabled] = useState(false);
    const [appleTalkZoneName, setAppleTalkZoneName] = useState("");
    const run = (event: React.MouseEvent) => {
        let ethernetProvider;
        if (appleTalkEnabled && appleTalkZoneName) {
            ethernetProvider = new CloudflareWorkerEthernetProvider(
                appleTalkZoneName
            );
        }
        const runDef = {disk, machine, ethernetProvider};
        const inNewWindow =
            event.button === 2 || event.metaKey || event.ctrlKey;
        onRun(runDef, inNewWindow);
    };

    let contents;
    if (customizing) {
        contents = (
            <>
                <div className="Row">
                    Machine:{" "}
                    <select
                        value={machine.name}
                        onChange={e => {
                            const machine =
                                disk.machines[e.target.selectedIndex];
                            setMachine(machine);
                            setBezelStyle(machine.bezelStyle);
                        }}>
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
    const buttonAppearance = disk.hasPlatinumAppearance
        ? "Platinum"
        : "Classic";
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

export type BrowserRunDef = {
    disk: DiskDef;
    machine: MachineDef;
    ethernetProvider?: EmulatorEthernetProvider;
};

export function runDefFromUrl(urlString: string): BrowserRunDef | undefined {
    let url;
    try {
        url = new URL(urlString);
    } catch (e) {
        return undefined;
    }

    const pieces = url.pathname.split("/");
    if (pieces.length !== 3) {
        return undefined;
    }
    const year = parseInt(pieces[1]);
    if (isNaN(year)) {
        return undefined;
    }
    const disks = DISKS_BY_YEAR[year];
    if (!disks) {
        return undefined;
    }
    const diskName = decodeURIComponent(pieces[2]);
    const disk = disks.find(disk => disk.displayName === diskName);
    if (!disk) {
        return undefined;
    }
    const searchParams = url.searchParams;
    let machine = disk.machines[0];
    const machineName = searchParams.get("machine");
    if (machineName) {
        machine =
            disk.machines.find(machine => machine.name === machineName) ??
            machine;
    }
    let ethernetProvider;
    const appleTalkZoneName = searchParams.get("appleTalk");
    if (appleTalkZoneName) {
        ethernetProvider = new CloudflareWorkerEthernetProvider(
            appleTalkZoneName
        );
    }
    return {
        disk,
        machine,
        ethernetProvider,
    };
}

export function runDefToUrl(runDef: BrowserRunDef, baseUrl: string): string {
    const {disk, machine, ethernetProvider} = runDef;
    const year = Object.entries(DISKS_BY_YEAR).find(([year, disks]) =>
        disks.includes(disk)
    )?.[0];
    const url = new URL(`/${year}/${disk.displayName}`, baseUrl);
    if (machine !== disk.machines[0]) {
        url.searchParams.set("machine", machine.name);
    }
    if (ethernetProvider instanceof CloudflareWorkerEthernetProvider) {
        url.searchParams.set("appleTalk", ethernetProvider.zoneName());
    }
    return url.toString();
}
