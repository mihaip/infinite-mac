import "./CustomFields.css";
import classNames from "classnames";
import {Fragment, useCallback, useEffect, useState} from "react";
import {canSaveDisks} from "./canSaveDisks";
import {systemCDROMEra, systemCDROMs} from "./cdroms";
import {CloudflareWorkerEthernetProvider} from "./CloudflareWorkerEthernetProvider";
import {Button} from "./controls/Button";
import {Checkbox} from "./controls/Checkbox";
import {Input} from "./controls/Input";
import {Select} from "./controls/Select";
import {fromDateString, toDateString} from "./dates";
import {
    type DiskFile,
    type SystemDiskDef,
    FLOPPY_DISKS_BY_NAME,
    SYSTEM_DISKS_BY_NAME,
    systemDiskName,
} from "./disks";
import {diskImageExtensions} from "./emulator/emulator-common";
import {
    emulatorSupportsAppleTalk,
    emulatorSupportsDebugLog,
} from "./emulator/emulator-common-emulators";
import {
    type MachineDef,
    type MachineDefRAMSize,
    ALL_MACHINES,
    MACHINES_BY_NAME,
} from "./machines";
import {type RunDef, type ScreenSize} from "./run-def";
import allowedCDROMDomains from "./cdrom-sites.json";

const ALL_DISKS_BY_NAME = {
    ...SYSTEM_DISKS_BY_NAME,
    ...FLOPPY_DISKS_BY_NAME,
};

export function CustomFields({
    runDef,
    setRunDef,
    defaultDisk,
    defaultSupportedScreenSizes,
    allowAutoScreenSize = true,
    allowSavedHD = true,
    allowAppleTalk = true,
    allowScreenScale = false,
    setCanRun,
}: {
    runDef: RunDef;
    setRunDef: React.Dispatch<React.SetStateAction<RunDef>>;
    defaultDisk: SystemDiskDef;
    defaultSupportedScreenSizes?: ConstrainedScreenSize[];
    allowAutoScreenSize?: boolean;
    allowSavedHD?: boolean;
    allowAppleTalk?: boolean;
    allowScreenScale?: boolean;
    setCanRun: (canRun: boolean) => void;
}) {
    const appleTalkSupported =
        allowAppleTalk &&
        runDef.disks.length > 0 &&
        runDef.disks[0].appleTalkSupported === true &&
        emulatorSupportsAppleTalk(runDef.machine.emulatorType);
    const debugLogSupported = emulatorSupportsDebugLog(
        runDef.machine.emulatorType
    );

    const [appleTalkEnabled, setAppleTalkEnabled] = useState(false);
    const [appleTalkZoneName, setAppleTalkZoneName] = useState("");
    const [customDateEnabled, setCustomDateEnabled] = useState(
        runDef.customDate !== undefined
    );
    const [showCDROMDomains, setShowCDROMDomains] = useState(false);
    const [diskURLs, setDiskURLs] = useState<DiskURL[]>([
        ...(runDef.diskURLs?.map(url => ({
            url,
            mountReadWrite: true,
        })) ?? []),
        ...runDef.cdromURLs.map(url => ({
            url,
            mountReadWrite: false,
        })),
    ]);
    useEffect(
        () =>
            setRunDef(runDef => ({
                ...runDef,
                cdromURLs: diskURLs
                    .filter(diskURL => diskURL.url && !diskURL.mountReadWrite)
                    .map(diskURL => diskURL.url),
                diskURLs: diskURLs
                    .filter(diskURL => diskURL.url && diskURL.mountReadWrite)
                    .map(diskURL => diskURL.url),
            })),
        [setRunDef, diskURLs]
    );

    const handleAddDiskFile = useCallback(
        (i: number, onDiskFileAdded?: () => void) => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = diskImageExtensions.join(",");
            input.onchange = () => {
                if (input.files?.length) {
                    const file = input.files[0];
                    setRunDef(runDef => ({
                        ...runDef,
                        diskFiles: [
                            ...runDef.diskFiles.slice(0, i + 1),
                            {
                                file,
                                treatAsCDROM:
                                    file.name.endsWith(".iso") ||
                                    file.name.endsWith(".toast") ||
                                    file.name.endsWith(".cdr"),
                                hasDeviceImageHeader:
                                    file.name.endsWith(".hda"),
                            },
                            ...runDef.diskFiles.slice(i + 1),
                        ],
                    }));
                    onDiskFileAdded?.();
                }
                input.remove();
            };
            input.click();
        },
        [setRunDef]
    );

    const groupedMachines: {[group: string]: MachineDef[]} = {
        "68K": [],
        "PowerPC": [],
        "NeXT": [],
    };
    for (const machine of ALL_MACHINES) {
        if (machine.isHidden) {
            continue;
        }
        if (machine.platform === "NeXT") {
            groupedMachines["NeXT"].push(machine);
        } else if (machine.cpu.startsWith("68")) {
            groupedMachines["68K"].push(machine);
        } else {
            groupedMachines["PowerPC"].push(machine);
        }
    }

    useEffect(() => {
        // Need a disk
        setCanRun(
            (runDef.disks.length > 0 ||
                runDef.diskFiles.length > 0 ||
                runDef.cdromURLs.length > 0 ||
                (runDef.diskURLs?.length ?? 0) > 0 ||
                runDef.includeSavedHD) &&
                // Need AppleTalk to be configured if enabled.
                (!appleTalkSupported ||
                    !appleTalkEnabled ||
                    appleTalkZoneName !== "")
        );
        setRunDef(runDef => {
            const ethernetProvider =
                appleTalkSupported && appleTalkEnabled && appleTalkZoneName
                    ? new CloudflareWorkerEthernetProvider(appleTalkZoneName)
                    : undefined;
            return {
                ...runDef,
                ethernetProvider,
            };
        });
    }, [
        setRunDef,
        setCanRun,
        runDef.disks.length,
        runDef.diskFiles.length,
        runDef.cdromURLs.length,
        runDef.diskURLs?.length,
        runDef.includeSavedHD,
        appleTalkEnabled,
        appleTalkZoneName,
        appleTalkSupported,
    ]);

    return (
        <>
            <label className="CustomFields-Row">
                <span className="CustomFields-Label">Machine:</span>
                <Select
                    value={runDef.machine.name}
                    onChange={e => {
                        const machine = MACHINES_BY_NAME[e.target.value];
                        const update: Partial<RunDef> = {machine};
                        if (
                            runDef.ramSize &&
                            !machine.ramSizes.includes(runDef.ramSize)
                        ) {
                            update.ramSize = machine.ramSizes[0];
                        }
                        setRunDef({...runDef, ...update});
                    }}>
                    {Object.entries(groupedMachines).map(
                        ([group, machines]) => (
                            <Fragment key={group}>
                                <option disabled>{group}</option>
                                {machines.map(m => (
                                    <option key={m.name} value={m.name}>
                                        {m.name}
                                    </option>
                                ))}
                            </Fragment>
                        )
                    )}
                </Select>
                <div className="CustomFields-Description Dialog-Description">
                    Emulator: {runDef.machine.emulatorType}
                </div>
            </label>
            <label className="CustomFields-Row">
                <span className="CustomFields-Label">RAM:</span>
                <Select
                    value={runDef.ramSize ?? runDef.machine.ramSizes[0]}
                    onChange={e =>
                        setRunDef({
                            ...runDef,
                            ramSize: e.target.value as MachineDefRAMSize,
                        })
                    }>
                    {runDef.machine.ramSizes.map(ramSize => (
                        <option key={ramSize} value={ramSize}>
                            {ramSize}B
                        </option>
                    ))}
                </Select>
                <div className="CustomFields-Description Dialog-Description">
                    Not all operating systems versions can run with a reduced
                    amount of RAM.
                </div>
            </label>
            <label className="CustomFields-Row">
                <span className="CustomFields-Label">Screen Size:</span>
                {runDef.machine.fixedScreenSize ? (
                    <>
                        {runDef.machine.fixedScreenSize.width} x{" "}
                        {runDef.machine.fixedScreenSize.height}
                    </>
                ) : runDef.machine.supportedScreenSizes ? (
                    <ScreenSizePickerConstrained
                        supportedScreenSizes={
                            runDef.machine.supportedScreenSizes
                        }
                        value={runDef.screenSize}
                        onChange={screenSize =>
                            setRunDef({...runDef, screenSize})
                        }
                        allowAutoScreenSize={allowAutoScreenSize}
                    />
                ) : defaultSupportedScreenSizes ? (
                    <ScreenSizePickerConstrained
                        supportedScreenSizes={defaultSupportedScreenSizes}
                        value={runDef.screenSize}
                        onChange={screenSize =>
                            setRunDef({...runDef, screenSize})
                        }
                        allowAutoScreenSize={allowAutoScreenSize}
                    />
                ) : (
                    <ScreenSizePicker
                        value={runDef.screenSize}
                        onChange={screenSize =>
                            setRunDef({...runDef, screenSize})
                        }
                    />
                )}
                {allowScreenScale && (
                    <>
                        {" "}
                        @{" "}
                        <ScreenScalePicker
                            value={runDef.screenScale}
                            onChange={screenScale =>
                                setRunDef({...runDef, screenScale})
                            }
                        />
                    </>
                )}
                {allowAutoScreenSize && (
                    <div className="CustomFields-Description Dialog-Description">
                        Not all machines support custom screen sizes, some sizes
                        may result in crashes.
                    </div>
                )}
            </label>
            <div className="CustomFields-Row">
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
                        onAddDiskFile={onDiskFileAdded =>
                            handleAddDiskFile(0, onDiskFileAdded)
                        }
                        onRemove={() =>
                            setRunDef(runDef => ({
                                ...runDef,
                                disks: [
                                    ...runDef.disks.slice(0, i),
                                    ...runDef.disks.slice(i + 1),
                                ],
                            }))
                        }
                    />
                ))}
                {runDef.diskFiles.map((diskFile, i) => (
                    <DiskFileOption
                        key={i}
                        diskFile={diskFile}
                        onChange={diskFile =>
                            setRunDef({
                                ...runDef,
                                diskFiles: [
                                    ...runDef.diskFiles.slice(0, i),
                                    diskFile,
                                    ...runDef.diskFiles.slice(i + 1),
                                ],
                            })
                        }
                        onAdd={() => handleAddDiskFile(i)}
                        onRemove={() =>
                            setRunDef({
                                ...runDef,
                                diskFiles: [
                                    ...runDef.diskFiles.slice(0, i),
                                    ...runDef.diskFiles.slice(i + 1),
                                ],
                            })
                        }
                    />
                ))}
                {runDef.disks.length === 0 && (
                    <>
                        <span className="CustomFields-Label">Disk:</span>
                        <Button
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
                <div className="CustomFields-Description Dialog-Description">
                    Some machines and system software combinations may not work.
                </div>
            </div>

            <div className="CustomFields-Row">
                {diskURLs.map((url, i) => (
                    <DiskURLOption
                        key={i}
                        url={url}
                        onChange={url =>
                            setDiskURLs(v => [
                                ...v.slice(0, i),
                                url,
                                ...v.slice(i + 1),
                            ])
                        }
                        onAdd={() =>
                            setDiskURLs(v => [
                                ...v.slice(0, i + 1),
                                {url: "", mountReadWrite: false},
                                ...v.slice(i + 1),
                            ])
                        }
                        onRemove={() =>
                            setDiskURLs(v => [
                                ...v.slice(0, i),
                                ...v.slice(i + 1),
                            ])
                        }
                    />
                ))}
                {diskURLs.length === 0 && (
                    <>
                        <span className="CustomFields-Label">Disk URL:</span>
                        <Button
                            onClick={e => {
                                e.preventDefault();
                                setDiskURLs(v => [
                                    ...v,
                                    {url: "", mountReadWrite: false},
                                ]);
                            }}>
                            Add
                        </Button>
                    </>
                )}
                <div className="CustomFields-Description Dialog-Description">
                    Disk or CD-ROM image from a URL. The image must be a raw
                    .iso/.img/.toast/.bin file (i.e. not compressed) and from{" "}
                    <span
                        className={classNames({
                            "CustomFields-Description-Link": !showCDROMDomains,
                        })}
                        onClick={() => setShowCDROMDomains(true)}>
                        a supported site
                    </span>
                    {showCDROMDomains && (
                        <> ({allowedCDROMDomains.join(", ")})</>
                    )}
                    .
                </div>
            </div>

            <div className="CustomFields-Row">
                <span className="CustomFields-Label">Built-in Disks:</span>
                <label>
                    <Checkbox
                        checked={runDef.includeInfiniteHD}
                        onChange={e =>
                            setRunDef({
                                ...runDef,
                                includeInfiniteHD: e.target.checked,
                            })
                        }
                    />
                    Infinite HD
                </label>
                <div className="CustomFields-Description Dialog-Description">
                    Include the Infinite HD disk, which has a large collection
                    of useful software.
                </div>
            </div>

            {allowSavedHD && (
                <div className="CustomFields-Row">
                    <span className="CustomFields-Label" />
                    <label
                        className={classNames({"disabled": !canSaveDisks()})}>
                        <Checkbox
                            disabled={!canSaveDisks()}
                            checked={runDef.includeSavedHD}
                            onChange={e =>
                                setRunDef({
                                    ...runDef,
                                    includeSavedHD: e.target.checked,
                                })
                            }
                        />
                        Saved HD
                    </label>
                    <div className="CustomFields-Description Dialog-Description">
                        Include the Saved HD disk, an empty 1 GB disk whose
                        contents are preserved across visits to this site (best
                        effort).
                        {!canSaveDisks() && (
                            <div>Not supported by this browser</div>
                        )}
                    </div>
                </div>
            )}

            <div className="CustomFields-Row CustomFields-InputCompensate">
                <span className="CustomFields-Label">Advanced:</span>
                <label>
                    <Checkbox
                        checked={customDateEnabled}
                        onChange={() => {
                            if (customDateEnabled) {
                                setCustomDateEnabled(false);
                                setRunDef({
                                    ...runDef,
                                    customDate: undefined,
                                });
                            } else {
                                setCustomDateEnabled(true);
                            }
                        }}
                    />
                    Custom date
                </label>{" "}
                <Input
                    style={{
                        visibility: customDateEnabled ? "visible" : "hidden",
                    }}
                    type="date"
                    value={toDateString(runDef.customDate ?? new Date())}
                    onChange={e =>
                        setRunDef({
                            ...runDef,
                            customDate: fromDateString(e.target.value),
                        })
                    }
                />
                <div className="CustomFields-Description Dialog-Description">
                    Allows time-limited software to be used.
                </div>
            </div>

            {appleTalkSupported && (
                <div className="CustomFields-Row CustomFields-InputCompensate">
                    <span className="CustomFields-Label" />
                    <label>
                        <Checkbox
                            checked={appleTalkEnabled}
                            onChange={() =>
                                setAppleTalkEnabled(!appleTalkEnabled)
                            }
                        />
                        Enable AppleTalk
                    </label>{" "}
                    <Input
                        style={{
                            visibility: appleTalkEnabled ? "visible" : "hidden",
                        }}
                        type="text"
                        value={appleTalkZoneName}
                        placeholder="Zone Name"
                        size={12}
                        onChange={e => setAppleTalkZoneName(e.target.value)}
                    />
                    <div className="CustomFields-Description Dialog-Description">
                        Allow local networking between emulated machines in the
                        same zone.
                    </div>
                </div>
            )}

            {debugLogSupported && (
                <div className="CustomFields-Row">
                    <span className="CustomFields-Label" />
                    <label>
                        <Checkbox
                            checked={runDef.debugLog ?? false}
                            onChange={e =>
                                setRunDef({
                                    ...runDef,
                                    debugLog: e.target.checked
                                        ? true
                                        : undefined,
                                })
                            }
                        />
                        Debug mode
                    </label>
                    <div className="CustomFields-Description Dialog-Description">
                        Include extra debug information in the console, and do a
                        verbose boot if possible.
                    </div>
                </div>
            )}
        </>
    );
}

function DiskOption({
    disk,
    onChange,
    onAdd,
    onAddDiskFile,
    onRemove,
}: {
    disk: SystemDiskDef;
    onChange: (disk: SystemDiskDef) => void;
    onAdd: () => void;
    onAddDiskFile: (onDiskFileAdded?: () => void) => void;
    onRemove: () => void;
}) {
    const diskOption = (disk: SystemDiskDef) => {
        const name = systemDiskName(disk);
        return (
            <option key={name} value={name}>
                {name}
            </option>
        );
    };

    const macDisks = [];
    const macOSXDisks = [];
    const nextDisks = [];
    for (const disk of Object.values(SYSTEM_DISKS_BY_NAME)) {
        if (disk.preferredMachine.platform === "NeXT") {
            nextDisks.push(disk);
        } else if (disk.displayName.startsWith("Mac OS X")) {
            macOSXDisks.push(disk);
        } else {
            macDisks.push(disk);
        }
    }

    const [showDiskFileButton, setShowDiskFileButton] = useState(false);
    const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === "disk-file") {
            // Safari doesn't trigger the file picker when invoked from a change
            // event because it doesn't consider it to be a user gesture
            // (https://webkit.org/b/216689). We need to first show a button
            // and let the user click it.
            if (
                navigator.userAgent.includes("Safari") &&
                !navigator.userAgent.includes("Chrome")
            ) {
                setShowDiskFileButton(true);
            } else {
                onAddDiskFile(onRemove);
            }
        } else {
            onChange(ALL_DISKS_BY_NAME[e.target.value]);
        }
    };

    return (
        <div className="CustomFields-Repeated">
            <span className="CustomFields-Label">Disk:</span>
            {showDiskFileButton ? (
                <Button
                    onClick={e => {
                        e.preventDefault();
                        onAddDiskFile(onRemove);
                    }}>
                    Chose File…
                </Button>
            ) : (
                <Select
                    className="CustomFields-Repeated-Disk"
                    value={systemDiskName(disk)}
                    onChange={handleSelect}>
                    {macDisks.map(diskOption)}
                    <option disabled>Mac OS X</option>
                    {macOSXDisks.map(diskOption)}
                    <option disabled>NeXT</option>
                    {nextDisks.map(diskOption)}
                    <option disabled>Floppy Disks</option>
                    {Object.values(FLOPPY_DISKS_BY_NAME).map(diskOption)}
                    <option disabled>Custom</option>
                    <option value="disk-file">Disk File…</option>
                </Select>
            )}
            <Button
                className="AddRemove"
                onClick={e => {
                    e.preventDefault();
                    onRemove();
                }}>
                –
            </Button>
            <Button
                className="AddRemove"
                onClick={e => {
                    e.preventDefault();
                    onAdd();
                }}>
                +
            </Button>
        </div>
    );
}

function DiskFileOption({
    diskFile,
    onChange,
    onAdd,
    onRemove,
}: {
    diskFile: DiskFile;
    onChange: (diskFile: DiskFile) => void;
    onAdd: () => void;
    onRemove: () => void;
}) {
    return (
        <div className="CustomFields-Repeated">
            <span className="CustomFields-Label">Disk:</span>
            <div className="CustomFields-Repeated-Disk">
                {diskFile.file.name}
            </div>
            <Button
                className="AddRemove"
                onClick={e => {
                    e.preventDefault();
                    onRemove();
                }}>
                –
            </Button>
            <Button
                className="AddRemove"
                onClick={e => {
                    e.preventDefault();
                    onAdd();
                }}>
                +
            </Button>
        </div>
    );
}

type DiskURL = {url: string; mountReadWrite: boolean};

function DiskURLOption({
    url,
    onChange,
    onAdd,
    onRemove,
}: {
    url: DiskURL;
    onChange: (cdromURL: DiskURL) => void;
    onAdd: () => void;
    onRemove: () => void;
}) {
    return (
        <>
            <div className="CustomFields-Repeated">
                <span className="CustomFields-Label">Disk URL:</span>
                <Input
                    type="url"
                    size={50}
                    value={url.url}
                    onChange={e => onChange({...url, url: e.target.value})}
                />
                <Select
                    className="CustomFields-CDROMs"
                    value=""
                    onChange={e =>
                        onChange({url: e.target.value, mountReadWrite: false})
                    }>
                    <option value="" disabled>
                        System CD-ROMs
                    </option>
                    {systemCDROMs.map((cdrom, i) => (
                        <Fragment key={cdrom.srcUrl}>
                            {i > 0 &&
                                systemCDROMEra(cdrom) !==
                                    systemCDROMEra(systemCDROMs[i - 1]) && (
                                    <option disabled />
                                )}
                            <option value={cdrom.srcUrl}>{cdrom.name}</option>
                        </Fragment>
                    ))}
                </Select>
                <Button
                    className="AddRemove"
                    onClick={e => {
                        e.preventDefault();
                        onRemove();
                    }}>
                    –
                </Button>
                <Button
                    className="AddRemove"
                    onClick={e => {
                        e.preventDefault();
                        onAdd();
                    }}>
                    +
                </Button>
            </div>
            <div className="CustomFields-DiskURL-MountReadWrite">
                <span className="CustomFields-Label" />
                <label>
                    <Checkbox
                        checked={!url.mountReadWrite}
                        onChange={e =>
                            onChange({
                                ...url,
                                mountReadWrite: !e.target.checked,
                            })
                        }
                    />
                    CD-ROM (read-only)
                </label>
            </div>
        </>
    );
}

export function ScreenSizePicker({
    value,
    onChange,
}: {
    value: ScreenSize;
    onChange: (value: ScreenSize) => void;
}) {
    const [width, setWidth] = useState(
        typeof value === "string" ? 640 : value.width
    );
    const [height, setHeight] = useState(
        typeof value === "string" ? 480 : value.height
    );

    return (
        <div className="CustomFields-ScreenSize">
            <Select
                value={typeof value === "string" ? value : "custom"}
                onChange={e => {
                    const option = e.target.value;
                    if (option === "custom") {
                        onChange({width, height});
                    } else {
                        onChange(option as ScreenSize);
                    }
                }}>
                {Object.entries({
                    "auto": "Automatic",
                    "window": "Window",
                    "fullscreen": "Full Screen",
                    "custom": "Custom",
                }).map(([value, label]) => (
                    <option key={value} value={value}>
                        {label}
                    </option>
                ))}
            </Select>
            {typeof value !== "string" && (
                <>
                    <Input
                        type="number"
                        min={2}
                        max={4096}
                        step={2}
                        value={width}
                        onChange={e => {
                            const width = parseInt(e.target.value);
                            setWidth(width);
                            onChange({width, height});
                        }}
                        size={4}
                    />{" "}
                    ×{" "}
                    <Input
                        type="number"
                        min={2}
                        max={4096}
                        step={2}
                        value={height}
                        onChange={e => {
                            const height = parseInt(e.target.value);
                            setHeight(height);
                            onChange({width, height});
                        }}
                        size={4}
                    />
                </>
            )}
        </div>
    );
}

type ConstrainedScreenSize = {width: number; height: number};

function ScreenSizePickerConstrained({
    supportedScreenSizes,
    value,
    onChange,
    allowAutoScreenSize,
}: {
    supportedScreenSizes: ConstrainedScreenSize[];
    value: ScreenSize;
    onChange: (value: ScreenSize) => void;
    allowAutoScreenSize: boolean;
}) {
    const options = [];
    if (allowAutoScreenSize) {
        options.push(
            <option key="auto" value="auto">
                Automatic
            </option>
        );
    }

    // Don't use JSON.stringify here, as it will also take into account extra properties like monitorId, which may not be stable across instances.
    const sizeKey = (size: ConstrainedScreenSize) =>
        `${size.width}x${size.height}`;

    for (const size of supportedScreenSizes) {
        options.push(
            <option key={sizeKey(size)} value={sizeKey(size)}>
                {size.width} × {size.height}
            </option>
        );
    }

    // Make sure that we have a valid option selected
    useEffect(() => {
        if (value === "auto") {
            return;
        }
        if (typeof value === "string") {
            onChange("auto");
            return;
        }
        for (const size of supportedScreenSizes) {
            if (size.width === value.width && size.height === value.height) {
                return;
            }
        }
        onChange("auto");
    }, [onChange, supportedScreenSizes, value]);

    return (
        <Select
            value={typeof value === "string" ? value : sizeKey(value)}
            onChange={e => {
                for (const size of supportedScreenSizes) {
                    if (sizeKey(size) === e.target.value) {
                        onChange(size);
                        return;
                    }
                }
                onChange("auto");
            }}>
            {options}
        </Select>
    );
}

function ScreenScalePicker({
    value = 1,
    onChange,
}: {
    value: number | undefined;
    onChange: (value: number | undefined) => void;
}) {
    return (
        <Select
            value={value.toString()}
            onChange={e => {
                const value = parseFloat(e.currentTarget.value);
                onChange(value === 1 ? undefined : value);
            }}>
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
        </Select>
    );
}
