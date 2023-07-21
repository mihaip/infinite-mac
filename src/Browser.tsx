import {
    type SystemDiskDef,
    type PlaceholderDiskDef,
    DISKS_BY_YEAR,
    NOTABLE_DISKS_BY_YEAR,
    isPlaceholderDiskDef,
    NOTABLE_DISKS,
    ALL_DISKS,
} from "./disks";
import {type MachineDef} from "./machines";
import {ScreenFrame} from "./ScreenFrame";
import {useState} from "react";
import {Button} from "./Button";
import {CloudflareWorkerEthernetProvider} from "./CloudflareWorkerEthernetProvider";
import {emulatorSupportsAppleTalk} from "./emulator/emulator-common-emulators";
import {About} from "./About";
import {Donate} from "./Donate";
import {useWindowWidth} from "./useWindowWidth";
import "./Browser.css";
import {Changelog} from "./Changelog";
import {type RunDef} from "./run-def";
import {Custom} from "./Custom";

type BrowserRunFn = (def: RunDef, inNewWindow?: boolean) => void;

export type BrowserProps = {
    onRun: BrowserRunFn;
};

export function Browser({onRun}: BrowserProps) {
    const [notableOnly, setNotableOnly] = useState(true);
    const disksByYear = notableOnly ? NOTABLE_DISKS_BY_YEAR : DISKS_BY_YEAR;
    return (
        <div className="Browser">
            <header>
                <div className="Logo">
                    <h1>Infinite Mac</h1>
                </div>
            </header>
            <Description onRun={onRun} />
            <div className="Disks-Container">
                <NotableToggle
                    notableOnly={notableOnly}
                    setNotableOnly={setNotableOnly}
                />
                {Array.from(Object.entries(disksByYear), ([year, disks]) => (
                    <div className="Year" key={year}>
                        <h2>{year}</h2>
                        <div className="Disks">
                            {disks.map((disk, i) => (
                                <Disk disk={disk} onRun={onRun} key={i} />
                            ))}
                        </div>
                    </div>
                ))}
                <div className="Year">
                    <h2>{new Date().getFullYear()}</h2>
                    <div className="Disks">
                        <CustomDisk onRun={onRun} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function Description({onRun}: {onRun: BrowserRunFn}) {
    const [aboutVisible, setAboutVisible] = useState(false);
    const [changelogVisible, setChangelogVisible] = useState(false);
    const [donateVisible, setDonateVisible] = useState(false);
    const [customVisible, setCustomVisible] = useState(false);

    return (
        <div className="Description">
            <p>
                Infinite Mac is a collection of classic Macintosh system
                releases and software, all easily accessible from the comfort of
                a (modern) web browser.
            </p>
            <p>
                Pick any version of System Software/Mac OS from the 1980s or
                1990s and run it (and major software of that era) within a
                virtual machine. You can also{" "}
                <span onClick={() => setCustomVisible(true)}>
                    run a custom version
                </span>{" "}
                with your choice of machine and virtual disks. Files can be
                imported and exported using drag and drop, and System 7 and
                onward have more advanced integrations as well – refer to the
                welcome screen in each machine for more details.
                {customVisible && (
                    <Custom
                        onRun={onRun}
                        onDone={() => setCustomVisible(false)}
                    />
                )}
            </p>
            <p>
                {aboutVisible && (
                    <About onDone={() => setAboutVisible(false)} />
                )}
                {changelogVisible && (
                    <Changelog onDone={() => setChangelogVisible(false)} />
                )}
                {donateVisible && (
                    <Donate onDone={() => setDonateVisible(false)} />
                )}
                You can{" "}
                <span onClick={() => setAboutVisible(true)}>learn more</span>,{" "}
                <span onClick={() => setChangelogVisible(true)}>
                    see what's changed recently
                </span>{" "}
                or <span onClick={() => setDonateVisible(true)}>donate</span> to
                support this project.
            </p>
        </div>
    );
}

function NotableToggle({
    notableOnly,
    setNotableOnly,
}: {
    notableOnly: boolean;
    setNotableOnly: (v: boolean) => void;
}) {
    return (
        <div className="Notable-Toggle-Container">
            <div className="Notable-Toggle">
                <span className="Notable-Toggle-Label">Releases:</span>
                <button
                    onClick={() => setNotableOnly(true)}
                    className={notableOnly ? "selected" : ""}>
                    <span className="name">Notable</span>{" "}
                    <span className="count">({NOTABLE_DISKS.length})</span>
                </button>
                <button
                    onClick={() => setNotableOnly(false)}
                    className={notableOnly ? "" : "selected"}>
                    <span className="name">All</span>{" "}
                    <span className="count">({ALL_DISKS.length})</span>
                </button>
            </div>
        </div>
    );
}

type DiskProps = {
    disk: SystemDiskDef | PlaceholderDiskDef;
    onRun: BrowserRunFn;
};

function Disk({disk, onRun}: DiskProps) {
    const [bezelStyle, setBezelStyle] = useState(disk.machines[0].bezelStyle);
    return (
        <DiskFrame
            bezelStyle={bezelStyle}
            screen={
                isPlaceholderDiskDef(disk) ? (
                    <PlaceholderDiskContents disk={disk} />
                ) : (
                    <DiskContents
                        setBezelStyle={setBezelStyle}
                        disk={disk}
                        onRun={onRun}
                    />
                )
            }
        />
    );
}

function DiskFrame({
    bezelStyle,
    screen,
}: {
    bezelStyle: MachineDef["bezelStyle"];
    screen: React.ReactElement;
}) {
    const windowWidth = useWindowWidth();

    // Match 10 vs. 40px padding chosen via the media query.
    const isSmallScreen = windowWidth <= 400;
    let screenWidth = windowWidth - (isSmallScreen ? 110 : 180);
    const bezelSize = isSmallScreen ? "Small-ish" : "Medium";
    screenWidth = Math.max(Math.min(screenWidth, 320), 200);
    const screenHeight = Math.round(screenWidth * 0.75);

    return (
        <ScreenFrame
            className="Disk"
            bezelStyle={bezelStyle}
            width={screenWidth}
            height={screenHeight}
            bezelSize={bezelSize}
            screen={screen}
        />
    );
}

type DiskContentsProps = {
    disk: SystemDiskDef;
    onRun: BrowserRunFn;
    setBezelStyle: (bezelStyle: MachineDef["bezelStyle"]) => void;
};

function DiskContents({disk, onRun, setBezelStyle}: DiskContentsProps) {
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
        const runDef = {
            disks: [disk],
            includeInfiniteHD: true,
            machine,
            cdromURLs: [],
            ethernetProvider,
            debugAudio: false,
            debugFallback: false,
        } satisfies RunDef;
        const inNewWindow =
            event.button === 2 || event.metaKey || event.ctrlKey;
        onRun(runDef, inNewWindow);
    };

    let contents;
    if (customizing) {
        const appleTalkSupported =
            disk.appleTalkSupported &&
            emulatorSupportsAppleTalk(machine.emulatorType);
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
                {appleTalkSupported && (
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
        contents = (
            <>
                <div className="Row DiskDescription">{disk.description}</div>
                {disk.isUnstable && (
                    <div className="Row Unstable-Warning">
                        Unstable under emulation.
                    </div>
                )}
            </>
        );
    }
    const buttonAppearance = disk.hasPlatinumAppearance
        ? "Platinum"
        : "Classic";
    return (
        <div className="DiskContents">
            <DiskHeader disk={disk} />
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

type PlaceholderDiskContentsProps = {
    disk: PlaceholderDiskDef;
};

function PlaceholderDiskContents({disk}: PlaceholderDiskContentsProps) {
    return (
        <div className="DiskContents DiskContents-Placeholder">
            <DiskHeader disk={disk} />
            <div className="Row DiskDescription">{disk.description}</div>
        </div>
    );
}

function CustomDisk({onRun}: {onRun: BrowserRunFn}) {
    const [customVisible, setCustomVisible] = useState(false);
    const today = new Date();
    return (
        <DiskFrame
            bezelStyle="Pinstripes"
            screen={
                <div className="DiskContents">
                    {customVisible && (
                        <Custom
                            onRun={onRun}
                            onDone={() => setCustomVisible(false)}
                        />
                    )}
                    <DiskHeader
                        disk={{
                            releaseDate: [
                                today.getFullYear(),
                                today.getMonth() + 1,
                                today.getDate(),
                            ],
                            displayName: "Custom",
                        }}
                    />
                    <div className="Row DiskDescription">
                        Build a custom instance, using your choice of emulated
                        machine and disk images.
                    </div>
                    <div className="Row Buttons">
                        <Button
                            appearance="Platinum"
                            onClick={() => setCustomVisible(true)}>
                            Run
                        </Button>
                    </div>
                </div>
            }
        />
    );
}

function DiskHeader({
    disk,
}: {
    disk: Pick<
        SystemDiskDef,
        "releaseDate" | "displayName" | "displaySubtitle"
    >;
}) {
    const [year, month, day] = disk.releaseDate;
    const releaseDateString = new Date(year, month - 1, day).toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "long",
            day: "numeric",
        }
    );
    return (
        <>
            <h3 className="Row">
                {disk.displayName}
                {disk.displaySubtitle && (
                    <span className="Subtitle"> ({disk.displaySubtitle})</span>
                )}
                <div className="ReleaseDate">{releaseDateString}</div>
            </h3>
        </>
    );
}
