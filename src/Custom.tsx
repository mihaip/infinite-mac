import "./Custom.css";
import {Fragment, useCallback, useEffect, useState} from "react";
import {Dialog} from "./controls/Dialog";
import * as varz from "./varz";
import {type ScreenSize, type RunDef} from "./run-def";
import {
    ALL_MACHINES,
    MACHINES_BY_NAME,
    type MachineDefRAMSize,
    type MachineDef,
} from "./machines";
import {
    SYSTEM_DISKS_BY_NAME,
    FLOPPY_DISKS_BY_NAME,
    type DiskFile,
    type SystemDiskDef,
    systemDiskName,
} from "./disks";
import {Button} from "./controls//Button";
import {Input} from "./controls/Input";
import {AppearanceProvider} from "./controls/Appearance";
import {Select} from "./controls/Select";
import {Checkbox} from "./controls/Checkbox";
import {
    emulatorSupportsAppleTalk,
    emulatorSupportsDebugLog,
} from "./emulator/emulator-common-emulators";
import {CloudflareWorkerEthernetProvider} from "./CloudflareWorkerEthernetProvider";
import classNames from "classnames";
import {canSaveDisks} from "./canSaveDisks";
import {systemCDROMEra, systemCDROMs} from "./cdroms";
import {diskImageExtensions} from "./emulator/emulator-common";
import {fromDateString, toDateString} from "./dates";

const ALL_DISKS_BY_NAME = {
    ...SYSTEM_DISKS_BY_NAME,
    ...FLOPPY_DISKS_BY_NAME,
};

export function Custom({
    initialRunDef,
    defaultDisk = ALL_DISKS_BY_NAME["System 7.0.1"],
    onRun,
    onDone,
}: {
    initialRunDef?: RunDef;
    defaultDisk?: SystemDiskDef;
    onRun: (def: RunDef, inNewWindow?: boolean) => void;
    onDone: () => void;
}) {
    useEffect(() => {
        varz.increment("custom_shown");
    }, []);

    const [runDef, setRunDef] = useState<RunDef>(
        initialRunDef
            ? initialRunDef.isCustom
                ? initialRunDef
                : {...initialRunDef, isCustom: true}
            : {
                  machine: defaultDisk.preferredMachine,
                  ramSize: undefined,
                  screenSize: "auto",
                  disks: [defaultDisk],
                  cdromURLs: [],
                  includeInfiniteHD: true,
                  includeSavedHD: canSaveDisks(),
                  includeLibrary: true,
                  libraryDownloadURLs: [],
                  isCustom: true,
                  diskFiles: [],
              }
    );
    const appleTalkSupported =
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
        []
    );

    const handleRun = useCallback(
        (event: React.MouseEvent) => {
            event.preventDefault();
            onDone();
            varz.increment("custom_run");
            const inNewWindow =
                event.button === 2 || event.metaKey || event.ctrlKey;
            if (appleTalkSupported && appleTalkEnabled && appleTalkZoneName) {
                runDef.ethernetProvider = new CloudflareWorkerEthernetProvider(
                    appleTalkZoneName
                );
            }
            onRun(runDef, inNewWindow);
        },
        [
            appleTalkEnabled,
            appleTalkSupported,
            appleTalkZoneName,
            onDone,
            onRun,
            runDef,
        ]
    );
    const canRun =
        // Need a disk
        (runDef.disks.length > 0 ||
            runDef.diskFiles.length > 0 ||
            runDef.cdromURLs.length > 0 ||
            runDef.includeSavedHD) &&
        // Need AppleTalk to be configured if enabled.
        (!appleTalkSupported || !appleTalkEnabled || appleTalkZoneName !== "");

    const {appearance = "Classic", appearanceVariant} = runDef.disks[0] ?? {};
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
    return (
        <AppearanceProvider appearance={appearance} variant={appearanceVariant}>
            <Dialog
                title="Run A Custom Configuration"
                onDone={handleRun}
                doneLabel="Run"
                doneEnabled={canRun}
                onCancel={onDone}
                className="Custom-Dialog">
                <p>
                    Build your own configuration by selecting a machine and
                    disks.
                </p>
                <label className="Custom-Dialog-Row">
                    <span className="Custom-Dialog-Label">Machine:</span>
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
                    <div className="Custom-Dialog-Description Dialog-Description">
                        Emulator: {runDef.machine.emulatorType}
                    </div>
                </label>
                <label className="Custom-Dialog-Row">
                    <span className="Custom-Dialog-Label">RAM:</span>
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
                    <div className="Custom-Dialog-Description Dialog-Description">
                        Not all operating systems versions can run with a
                        reduced amount of RAM.
                    </div>
                </label>
                <label className="Custom-Dialog-Row">
                    <span className="Custom-Dialog-Label">Screen Size:</span>
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
                        />
                    ) : (
                        <ScreenSizePicker
                            value={runDef.screenSize}
                            onChange={screenSize =>
                                setRunDef({...runDef, screenSize})
                            }
                        />
                    )}
                    <div className="Custom-Dialog-Description Dialog-Description">
                        Not all machines support custom screen sizes, some sizes
                        may result in crashes.
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
                            <span className="Custom-Dialog-Label">Disk:</span>
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
                    <div className="Custom-Dialog-Description Dialog-Description">
                        Some machines and system software combinations may not
                        work.
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
                        />
                    ))}
                    {runDef.cdromURLs.length === 0 && (
                        <>
                            <span className="Custom-Dialog-Label">
                                Disk URL:
                            </span>
                            <Button
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
                        .iso/.img/.toast/.bin file (i.e. not compressed) and
                        from{" "}
                        <a href="https://github.com/search?q=repo%3Amihaip%2Finfinite-mac+%22const+allowedDomains%22&type=code">
                            a supported site
                        </a>
                        .
                    </div>
                </div>

                <div className="Custom-Dialog-Row">
                    <span className="Custom-Dialog-Label">Built-in Disks:</span>
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
                    <div className="Custom-Dialog-Description Dialog-Description">
                        Include the Infinite HD disk, which has a large
                        collection of useful software.
                    </div>
                </div>

                <div className="Custom-Dialog-Row">
                    <span className="Custom-Dialog-Label" />
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
                    <div className="Custom-Dialog-Description Dialog-Description">
                        Include the Saved HD disk, an empty 1 GB disk whose
                        contents are preserved across visits to this site (best
                        effort).
                        {!canSaveDisks() && (
                            <div>Not supported by this browser</div>
                        )}
                    </div>
                </div>

                <div className="Custom-Dialog-Row Custom-Dialog-InputCompensate">
                    <span className="Custom-Dialog-Label">Advanced:</span>
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
                        Custom Date
                    </label>{" "}
                    <Input
                        style={{
                            visibility: customDateEnabled
                                ? "visible"
                                : "hidden",
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
                    <div className="Custom-Dialog-Description Dialog-Description">
                        Allows time-limited software to be used.
                    </div>
                </div>

                {appleTalkSupported && (
                    <div className="Custom-Dialog-Row Custom-Dialog-InputCompensate">
                        <span className="Custom-Dialog-Label" />
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
                                visibility: appleTalkEnabled
                                    ? "visible"
                                    : "hidden",
                            }}
                            type="text"
                            value={appleTalkZoneName}
                            placeholder="Zone Name"
                            size={12}
                            onChange={e => setAppleTalkZoneName(e.target.value)}
                        />
                        <div className="Custom-Dialog-Description Dialog-Description">
                            Allow local networking between emulated machines in
                            the same zone.
                        </div>
                    </div>
                )}

                {debugLogSupported && (
                    <div className="Custom-Dialog-Row">
                        <span className="Custom-Dialog-Label" />
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
                            Debug Mode
                        </label>
                        <div className="Custom-Dialog-Description Dialog-Description">
                            Include extra debug information in the console, and
                            do a verbose boot if possible.
                        </div>
                    </div>
                )}
            </Dialog>
        </AppearanceProvider>
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

    return (
        <div className="Custom-Dialog-Repeated">
            <span className="Custom-Dialog-Label">Disk:</span>
            <Select
                className="Custom-Dialog-Repeated-Disk"
                value={systemDiskName(disk)}
                onChange={e => {
                    const value = e.target.value;
                    if (value === "disk-file") {
                        onAddDiskFile(onRemove);
                    } else {
                        onChange(ALL_DISKS_BY_NAME[e.target.value]);
                    }
                }}>
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
        <div className="Custom-Dialog-Repeated">
            <span className="Custom-Dialog-Label">Disk:</span>
            <div className="Custom-Dialog-Repeated-Disk">
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

function CDROMOption({
    cdromURL,
    onChange,
    onAdd,
    onRemove,
}: {
    cdromURL: string;
    onChange: (cdromURL: string) => void;
    onAdd: () => void;
    onRemove: () => void;
}) {
    return (
        <div className="Custom-Dialog-Repeated">
            <span className="Custom-Dialog-Label">Disk URL:</span>
            <Input
                type="url"
                size={50}
                value={cdromURL}
                onChange={e => onChange(e.target.value)}
            />
            <Select
                className="Custom-Dialog-CDROMs"
                value=""
                onChange={e => onChange(e.target.value)}>
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
    );
}

function ScreenSizePicker({
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
        <div className="Custom-Dialog-ScreenSize">
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

function ScreenSizePickerConstrained({
    supportedScreenSizes,
    value,
    onChange,
}: {
    supportedScreenSizes: {width: number; height: number}[];
    value: ScreenSize;
    onChange: (value: ScreenSize) => void;
}) {
    const options = [
        <option key="auto" value={JSON.stringify("auto")}>
            Automatic
        </option>,
    ];

    for (const size of supportedScreenSizes) {
        options.push(
            <option key={JSON.stringify(size)} value={JSON.stringify(size)}>
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
        <div className="Custom-Dialog-ScreenSize">
            <Select
                value={JSON.stringify(value)}
                onChange={e =>
                    onChange(JSON.parse(e.target.value) as ScreenSize)
                }>
                {options}
            </Select>
        </div>
    );
}
