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
import {Button} from "./controls/Button";
import {About} from "./About";
import {Donate} from "./Donate";
import {useWindowWidth} from "./useWindowWidth";
import "./Browser.css";
import {Changelog} from "./Changelog";
import {type RunDef} from "./run-def";
import {Custom} from "./Custom";
import classNames from "classnames";
import {canSaveDisks} from "./canSaveDisks";
import {usePersistentState} from "./usePersistentState";

type BrowserRunFn = (def: RunDef, inNewWindow?: boolean) => void;

export function Browser({
    onRun,
    initialCustomRunDef,
}: {
    onRun: BrowserRunFn;
    initialCustomRunDef?: RunDef;
}) {
    const [notableOnly, setNotableOnly] = usePersistentState(
        true,
        "notableOnly"
    );
    const disksByYear = notableOnly ? NOTABLE_DISKS_BY_YEAR : DISKS_BY_YEAR;
    return (
        <div className="Browser">
            <header>
                <div className="Logo">
                    <h1>Infinite Mac</h1>
                </div>
                <Description
                    onRun={onRun}
                    initialCustomRunDef={initialCustomRunDef}
                />
            </header>
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

function Description({
    onRun,
    initialCustomRunDef,
}: {
    onRun: BrowserRunFn;
    initialCustomRunDef?: RunDef;
}) {
    const [aboutVisible, setAboutVisible] = useState(false);
    const [changelogVisible, setChangelogVisible] = useState(false);
    const [donateVisible, setDonateVisible] = useState(false);
    const [customVisible, setCustomVisible] = useState(
        location.pathname === "/run" || initialCustomRunDef !== undefined
    );

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
                        initialRunDef={initialCustomRunDef}
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
                <NotableToggleButton
                    onClick={() => setNotableOnly(true)}
                    selected={notableOnly}
                    label="Notable"
                    count={NOTABLE_DISKS.length}
                />
                <NotableToggleButton
                    onClick={() => setNotableOnly(false)}
                    selected={!notableOnly}
                    label="All"
                    count={ALL_DISKS.length}
                />
            </div>
        </div>
    );
}

function NotableToggleButton({
    onClick,
    selected,
    label,
    count,
}: {
    onClick: () => void;
    selected: boolean;
    label: string;
    count: number;
}) {
    return (
        <button
            onClick={onClick}
            className={classNames("Notable-Toggle-Button", {
                "selected": selected,
            })}>
            <span className="name-container">
                <span className="name">{label}</span>
                <span className="name-sizer">{label}</span>
            </span>{" "}
            <span className="count">({count})</span>
        </button>
    );
}

type DiskProps = {
    disk: SystemDiskDef | PlaceholderDiskDef;
    onRun: BrowserRunFn;
};

function Disk({disk, onRun}: DiskProps) {
    const {bezelStyle} = disk.machines[0];
    return (
        <DiskFrame
            bezelStyle={bezelStyle}
            screen={
                isPlaceholderDiskDef(disk) ? (
                    <PlaceholderDiskContents disk={disk} />
                ) : (
                    <DiskContents disk={disk} onRun={onRun} />
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
};

function DiskContents({disk, onRun}: DiskContentsProps) {
    const {bezelStyle} = disk.machines[0];
    const [customVisible, setCustomVisible] = useState(false);
    const run = (event: React.MouseEvent) => {
        const runDef = {
            disks: [disk],
            screenSize: "auto",
            includeInfiniteHD: true,
            includeSavedHD: canSaveDisks(),
            machine: disk.machines[0],
            cdromURLs: [],
            diskFiles: [],
        } satisfies RunDef;
        const inNewWindow =
            event.button === 2 || event.metaKey || event.ctrlKey;
        onRun(runDef, inNewWindow);
    };

    const {appearance = "Classic"} = disk;

    return (
        <div
            className={classNames(
                "DiskContents",
                `DiskContents-${bezelStyle}`
            )}>
            <DiskHeader disk={disk} />
            <div className="Row DiskDescription">{disk.description}</div>
            {disk.isUnstable && (
                <div className="Row Unstable-Warning">
                    Unstable under emulation.
                </div>
            )}
            <div className="Row Buttons">
                <Button
                    appearance={appearance}
                    className="CustomizeButton"
                    onClick={() => setCustomVisible(true)}>
                    Customize…
                </Button>
                <Button appearance={appearance} onClick={run}>
                    Run
                </Button>
            </div>

            {customVisible && (
                <Custom
                    defaultDisk={disk}
                    onRun={onRun}
                    onDone={() => setCustomVisible(false)}
                />
            )}
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
