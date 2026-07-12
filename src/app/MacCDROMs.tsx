import {useRef, useState} from "react";
import "@/app/MacCDROMs.css";
import {type EmulatorCDROM} from "@/emulator/common/common";
import {Button} from "@/controls/Button";
import classNames from "classnames";
import {Dialog} from "@/controls/Dialog";
import {cdromLibrary, getCDROMInfo, systemCDROMCompare} from "@/defs/cdroms";
import {Input} from "@/controls/Input";
import {type MachinePlatform} from "@/defs/machines";
import defaultFloppySDImage from "@/Images/DefaultFloppySD.png";
import defaultFloppyDDImage from "@/Images/DefaultFloppyDD.png";
import defaultFloppyHDImage from "@/Images/DefaultFloppyHD.png";
import defaultCDROMImage from "@/Images/DefaultCDROM.png";
import defaultCDROMNeXTImage from "@/Images/DefaultCDROM-NeXT.png";
import cdromsIcon from "@/Images/CD-ROM.png";
import floppiessIcon from "@/Images/Floppy.png";
import {
    Drawer,
    DrawerContents,
    DrawerHeader,
    DrawerList,
    DrawerListCategory,
} from "@/controls/Drawer";
import allowedCDROMDomains from "@/defs/cdrom-sites.json";

export function MacCDROMs({
    onRun,
    platform,
    floppies,
}: {
    onRun: (cdrom: EmulatorCDROM) => void;
    platform?: MachinePlatform;
    floppies?: boolean;
}) {
    const [search, setSearch] = useState("");
    return (
        <Drawer
            title={floppies ? "Floppies" : "CD-ROMs"}
            titleIconUrl={floppies ? floppiessIcon : cdromsIcon}
            contents={collapse => (
                <MacCDROMsContents
                    search={search}
                    setSearch={setSearch}
                    onRun={cdrom => {
                        collapse();
                        onRun(cdrom);
                    }}
                    platform={platform}
                    floppies={floppies}
                />
            )}
        />
    );
}

function MacCDROMsContents({
    search,
    setSearch,
    onRun,
    platform = "Macintosh",
    floppies,
}: {
    search: string;
    setSearch: (search: string) => void;
    onRun: (cdrom: EmulatorCDROM) => void;
    platform?: MachinePlatform;
    floppies?: boolean;
}) {
    const cdroms = cdromLibrary;
    const folderPaths = Array.from(Object.keys(cdroms)).sort();
    const cdromsByCategory: {[category: string]: EmulatorCDROM[]} = {};
    let lastCategory;
    for (const folderPath of folderPaths) {
        if (
            search &&
            !folderPath.toLowerCase().includes(search.toLowerCase())
        ) {
            continue;
        }
        const cdrom = cdroms[folderPath];
        const {platform: cdromPlatform = "Macintosh"} = cdrom;
        if (cdromPlatform !== platform) {
            continue;
        }
        if ((floppies && !cdrom.isFloppy) || (!floppies && cdrom.isFloppy)) {
            continue;
        }
        const category = folderPath.substring(
            0,
            folderPath.length - cdrom.name.length - 1
        );
        if (category !== lastCategory) {
            cdromsByCategory[category] = [];
            lastCategory = category;
        }
        cdromsByCategory[category].push(cdrom);
    }
    const sortedCategories = Object.keys(cdromsByCategory).sort((a, b) => {
        if (a === b) {
            return 0;
        }
        if (a.startsWith(b)) {
            return 1;
        }
        if (b.startsWith(a)) {
            return -1;
        }
        return a.localeCompare(b);
    });
    const sortedCdromsByCategory = Object.fromEntries(
        sortedCategories.map(category => [category, cdromsByCategory[category]])
    );
    for (const [category, cdroms] of Object.entries(sortedCdromsByCategory)) {
        cdroms.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, {numeric: true})
        );
        if (category === "System Software") {
            cdroms.sort(systemCDROMCompare);
        }
    }

    const [customCDROMVisible, setCustomCDROMVisible] = useState(false);

    return (
        <DrawerContents>
            {customCDROMVisible && (
                <MacCustomCDROM
                    onRun={onRun}
                    onDone={() => setCustomCDROMVisible(false)}
                    floppies={floppies}
                />
            )}
            <DrawerHeader>
                <div className="Mac-CDROMs-Instructions">
                    {floppies ? (
                        <>
                            Load floppy images into the emulated Mac to access
                            additional software. Only one additional floppy may
                            be mounted at a time.
                        </>
                    ) : (
                        <>
                            Load CD-ROM images into the emulated Mac to access
                            software that is too large to pre-install on
                            Infinite HD.
                        </>
                    )}
                </div>
                <div className="Mac-CDROMs-Controls">
                    <Button onClick={() => setCustomCDROMVisible(true)}>
                        Load from URL…
                    </Button>
                    <Input
                        type="search"
                        placeholder="Filter…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </DrawerHeader>
            <DrawerList>
                {Object.entries(sortedCdromsByCategory).map(
                    ([category, cdroms]) => (
                        <DrawerListCategory key={category} title={category}>
                            {cdroms.map(cdrom => (
                                <MacCDROM
                                    key={cdrom.name}
                                    cdrom={cdrom}
                                    onRun={() => {
                                        onRun(cdrom);
                                    }}
                                />
                            ))}
                        </DrawerListCategory>
                    )
                )}
            </DrawerList>
        </DrawerContents>
    );
}

function MacCustomCDROM({
    onRun,
    onDone,
    floppies,
}: {
    onRun: (cdrom: EmulatorCDROM) => void;
    onDone: () => void;
    floppies?: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [url, setUrl] = useState("");
    const handleLoad = async () => {
        try {
            const cdrom = await getCDROMInfo(url);
            if (floppies) {
                cdrom.isFloppy = true;
            }
            history.replaceState(
                {},
                "",
                location.pathname + "?cdrom_url=" + encodeURIComponent(url)
            );
            onRun(cdrom);
            onDone();
        } catch (err) {
            alert("Could not load CD-ROM: " + (err as Error).message);
        }
    };
    const noun = floppies ? "floppy" : "CD-ROM";
    const extensions = floppies
        ? ".img or .moof"
        : ".iso, .img, .toast, or .bin";
    return (
        <Dialog
            title={`Load custom ${noun}`}
            onDone={handleLoad}
            doneLabel="Load"
            doneEnabled={url !== "" && inputRef.current?.validity.valid}
            onCancel={onDone}>
            <p>
                Infinite Mac supports loading of {noun} images from URLs. Be
                aware of the following caveats:
            </p>
            <ul>
                <li>Raw {extensions} files work best.</li>
                <li>
                    Only a subset of sites are supported (currently{" "}
                    {allowedCDROMDomains.join(", ")}). If there is another site
                    that you wish to be supported, please contact the
                    maintainer.
                </li>
                <li>
                    The site must support{" "}
                    <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests">
                        range requests
                    </a>{" "}
                    so that the image can be streamed in.
                </li>
            </ul>
            <p>
                <Input
                    className="Mac-Custom-CDROM-URL"
                    type="url"
                    value={url}
                    placeholder="URL"
                    size={40}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => {
                        if (
                            e.key === "Enter" &&
                            inputRef.current?.validity.valid
                        ) {
                            handleLoad();
                        }
                    }}
                    ref={inputRef}
                />
            </p>
        </Dialog>
    );
}

function MacCDROM({cdrom, onRun}: {cdrom: EmulatorCDROM; onRun: () => void}) {
    const {
        name,
        coverImageHash,
        coverImageSize,
        coverImageType = "round",
        fileSize,
    } = cdrom;
    let coverClassName, coverImageUrl, coverImageWidth, coverImageHeight;
    if (coverImageHash && coverImageSize) {
        coverImageUrl = `/Covers/${coverImageHash}.jpeg`;
        [coverImageWidth, coverImageHeight] = coverImageSize;
        coverClassName = classNames("Mac-CDROM-Cover", {
            "Mac-CDROM-Cover-Round": coverImageType === "round",
        });
    } else {
        coverClassName = classNames("Mac-CDROM-Cover", "Default");
        coverImageWidth = coverImageHeight = 32;
        if (cdrom.isFloppy) {
            if (fileSize <= 500_000) {
                coverImageUrl = defaultFloppySDImage;
            } else if (fileSize <= 1_200_000) {
                coverImageUrl = defaultFloppyDDImage;
            } else {
                coverImageUrl = defaultFloppyHDImage;
            }
        } else if (cdrom.platform === "NeXT") {
            coverImageUrl = defaultCDROMNeXTImage;
            coverImageWidth = coverImageHeight = 48;
        } else {
            coverImageUrl = defaultCDROMImage;
        }
    }
    return (
        <div className="Mac-CDROM" onClick={onRun}>
            <img
                className={coverClassName}
                src={coverImageUrl}
                width={coverImageWidth}
                height={coverImageHeight}
                loading="lazy"
            />
            <div className="Mac-CDROM-Name">{name}</div>
        </div>
    );
}
