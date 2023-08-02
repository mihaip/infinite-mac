import "./Custom.css";
import {useCallback, useEffect, useState} from "react";
import {Dialog} from "./controls/Dialog";
import * as varz from "./varz";
import {type RunDef} from "./run-def";
import {ALL_MACHINES, MACHINES_BY_NAME, QUADRA_650} from "./machines";
import {
    SYSTEM_DISKS_BY_NAME,
    type SystemDiskDef,
    systemDiskName,
} from "./disks";
import {Button} from "./controls//Button";
import {Input} from "./controls/Input";
import {type Appearance} from "./controls/Appearance";
import {Select} from "./controls/Select";
import {Checkbox} from "./controls/Checkbox";

export function Custom({
    onRun,
    onDone,
}: {
    onRun: (def: RunDef, inNewWindow?: boolean) => void;
    onDone: () => void;
}) {
    useEffect(() => {
        varz.increment("custom_shown");
    }, []);

    const defaultDisk = SYSTEM_DISKS_BY_NAME["System 7.1"];

    const [runDef, setRunDef] = useState<RunDef>({
        machine: QUADRA_650,
        disks: [defaultDisk],
        cdromURLs: [],
        includeInfiniteHD: true,
        debugFallback: false,
        debugAudio: false,
    });

    const handleRun = useCallback(
        (event: React.MouseEvent) => {
            event.preventDefault();
            onDone();
            varz.increment("custom_run");
            const inNewWindow =
                event.button === 2 || event.metaKey || event.ctrlKey;
            onRun(runDef, inNewWindow);
        },
        [onDone, onRun, runDef]
    );

    const {appearance = "Classic"} = runDef.disks[0] ?? {};

    return (
        <Dialog
            title="Run A Custom Configuration"
            onDone={handleRun}
            doneLabel="Run"
            onCancel={onDone}
            appearance={appearance}
            className="Custom-Dialog">
            <p>
                Build your own configuration by selecting a machine and disks.
            </p>
            <label className="Custom-Dialog-Row">
                <span className="Custom-Dialog-Label">Machine:</span>
                <Select
                    appearance={appearance}
                    value={runDef.machine.name}
                    onChange={e =>
                        setRunDef({
                            ...runDef,
                            machine: MACHINES_BY_NAME[e.target.value],
                        })
                    }>
                    {ALL_MACHINES.map(machine => (
                        <option key={machine.name} value={machine.name}>
                            {machine.name}
                        </option>
                    ))}
                </Select>
                <div className="Custom-Dialog-Description Dialog-Description">
                    Note that machines cannot run all system software versions.
                </div>
            </label>

            <div className="Custom-Dialog-Row">
                {runDef.disks.map((disk, i) => (
                    <DiskOption
                        key={i}
                        disk={disk}
                        onChange={disk =>
                            setRunDef({
                                ...runDef,
                                disks: [
                                    ...runDef.disks.slice(0, i),
                                    disk,
                                    ...runDef.disks.slice(i + 1),
                                ],
                            })
                        }
                        onAdd={() =>
                            setRunDef({
                                ...runDef,
                                disks: [
                                    ...runDef.disks.slice(0, i + 1),
                                    defaultDisk,
                                    ...runDef.disks.slice(i + 1),
                                ],
                            })
                        }
                        onRemove={() =>
                            setRunDef({
                                ...runDef,
                                disks: [
                                    ...runDef.disks.slice(0, i),
                                    ...runDef.disks.slice(i + 1),
                                ],
                            })
                        }
                        appearance={appearance}
                    />
                ))}
                {runDef.disks.length === 0 && (
                    <>
                        <span className="Custom-Dialog-Label">Disk:</span>
                        <Button
                            appearance={appearance}
                            onClick={e => {
                                e.preventDefault();
                                setRunDef({
                                    ...runDef,
                                    disks: [defaultDisk],
                                });
                            }}>
                            Add
                        </Button>
                    </>
                )}
                <div className="Custom-Dialog-Description Dialog-Description">
                    System software disks from the Infinite Mac collection.
                </div>
            </div>

            <div className="Custom-Dialog-Row">
                {runDef.cdromURLs.map((cdromURL, i) => (
                    <CDROMOption
                        key={i}
                        cdromURL={cdromURL}
                        onChange={cdromURL =>
                            setRunDef({
                                ...runDef,
                                cdromURLs: [
                                    ...runDef.cdromURLs.slice(0, i),
                                    cdromURL,
                                    ...runDef.cdromURLs.slice(i + 1),
                                ],
                            })
                        }
                        onAdd={() =>
                            setRunDef({
                                ...runDef,
                                cdromURLs: [
                                    ...runDef.cdromURLs.slice(0, i + 1),
                                    "",
                                    ...runDef.cdromURLs.slice(i + 1),
                                ],
                            })
                        }
                        onRemove={() =>
                            setRunDef({
                                ...runDef,
                                cdromURLs: [
                                    ...runDef.cdromURLs.slice(0, i),
                                    ...runDef.cdromURLs.slice(i + 1),
                                ],
                            })
                        }
                        appearance={appearance}
                    />
                ))}
                {runDef.cdromURLs.length === 0 && (
                    <>
                        <span className="Custom-Dialog-Label">Disk URL:</span>
                        <Button
                            appearance={appearance}
                            onClick={e => {
                                e.preventDefault();
                                setRunDef({
                                    ...runDef,
                                    cdromURLs: [""],
                                });
                            }}>
                            Add
                        </Button>
                    </>
                )}
                <div className="Custom-Dialog-Description Dialog-Description">
                    Disk or CD-ROM image from a URL. The image must be a raw
                    .iso/.img file (i.e. not compressed) and from{" "}
                    <a href="https://github.com/search?q=repo%3Amihaip%2Finfinite-mac+%22const+allowedDomains%22&type=code">
                        a supported site
                    </a>
                    .
                </div>
            </div>

            <label className="Custom-Dialog-Row">
                <span className="Custom-Dialog-Label">Extras:</span>
                <Checkbox
                    appearance={appearance}
                    checked={runDef.includeInfiniteHD}
                    onChange={e =>
                        setRunDef({
                            ...runDef,
                            includeInfiniteHD: e.target.checked,
                        })
                    }
                />
                Infinite HD
                <div className="Custom-Dialog-Description Dialog-Description">
                    Include the Infinite HD disk, which has a large collection
                    of useful software.
                </div>
            </label>
        </Dialog>
    );
}

function DiskOption({
    disk,
    onChange,
    onAdd,
    onRemove,
    appearance,
}: {
    disk: SystemDiskDef;
    onChange: (disk: SystemDiskDef) => void;
    onAdd: () => void;
    onRemove: () => void;
    appearance: Appearance;
}) {
    return (
        <label className="Custom-Dialog-Repeated">
            <span className="Custom-Dialog-Label">Disk:</span>
            <Select
                appearance={appearance}
                value={systemDiskName(disk)}
                onChange={e => onChange(SYSTEM_DISKS_BY_NAME[e.target.value])}>
                {Object.values(SYSTEM_DISKS_BY_NAME).map(disk => {
                    const name = systemDiskName(disk);
                    return (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    );
                })}
            </Select>
            <Button
                appearance={appearance}
                onClick={e => {
                    e.preventDefault();
                    onRemove();
                }}>
                –
            </Button>
            <Button
                appearance={appearance}
                onClick={e => {
                    e.preventDefault();
                    onAdd();
                }}>
                +
            </Button>
        </label>
    );
}

function CDROMOption({
    cdromURL,
    onChange,
    onAdd,
    onRemove,
    appearance,
}: {
    cdromURL: string;
    onChange: (cdromURL: string) => void;
    onAdd: () => void;
    onRemove: () => void;
    appearance: Appearance;
}) {
    return (
        <label className="Custom-Dialog-Repeated">
            <span className="Custom-Dialog-Label">Disk URL:</span>
            <Input
                type="url"
                size={50}
                value={cdromURL}
                onChange={e => onChange(e.target.value)}
                appearance={appearance}
            />
            <Button
                appearance={appearance}
                onClick={e => {
                    e.preventDefault();
                    onRemove();
                }}>
                –
            </Button>
            <Button
                appearance={appearance}
                onClick={e => {
                    e.preventDefault();
                    onAdd();
                }}>
                +
            </Button>
        </label>
    );
}
