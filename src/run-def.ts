import {BroadcastChannelEthernetProvider} from "./BroadcastChannelEthernetProvider";
import {CloudflareWorkerEthernetProvider} from "./CloudflareWorkerEthernetProvider";
import {fromDateString, toDateString} from "./dates";
import {
    ALL_DISKS,
    DISKS_BY_YEAR,
    FLOPPY_DISKS,
    isPlaceholderDiskDef,
    type DiskFile,
    type SystemDiskDef,
} from "./disks";
import {type EmulatorEthernetProvider} from "./emulator/emulator-ui";
import {
    MACHINES_BY_NAME,
    type MachineDefRAMSize,
    type MachineDef,
} from "./machines";

export type RunDef = {
    machine: MachineDef;
    ramSize?: MachineDefRAMSize;
    screenSize: ScreenSize;
    screenScale?: number;
    disks: SystemDiskDef[];
    diskFiles: DiskFile[];
    cdromURLs: string[];
    includeInfiniteHD: boolean;
    includeSavedHD: boolean;
    includeLibrary: boolean;
    libraryDownloadURLs: string[];
    ethernetProvider?: EmulatorEthernetProvider;
    // Force non-SharedArrayBuffer mode for debugging
    debugFallback?: boolean;
    debugAudio?: boolean;
    debugPaused?: boolean;
    debugLog?: boolean;
    debugTrackpad?: boolean;
    isCustom?: boolean;
    customDate?: Date;
    isEmbed?: boolean;
    embedScreenUpdateMessages?: boolean;
};

export type ScreenSize =
    | "auto"
    | "fullscreen"
    | "window"
    | "embed"
    | {width: number; height: number};

export function runDefFromUrl(urlString: string): RunDef | undefined {
    let url;
    try {
        url = new URL(urlString);
    } catch (e) {
        return undefined;
    }

    const {searchParams, pathname} = url;

    let isCustom = searchParams.has("edit");
    const isEmbed = pathname === "/embed";
    const embedScreenUpdateMessages =
        isEmbed && searchParams.get("screen_update_messages") === "true";
    let includeInfiniteHD;
    let includeSavedHD;
    const includeLibrary = searchParams.get("library") !== "false";
    const libraryDownloadURLs = [...searchParams.getAll("library_url")];
    const disks: SystemDiskDef[] = [];
    const yearDiskDef = diskFromYearPath(url.pathname);
    if (yearDiskDef) {
        disks.push(yearDiskDef);
        includeInfiniteHD = searchParams.get("infinite_hd") !== "false";
        includeSavedHD = searchParams.get("saved_hd") !== "false";
    } else {
        includeInfiniteHD = searchParams.get("infinite_hd") === "true";
        includeSavedHD = searchParams.get("saved_hd") === "true";
        isCustom = true;
    }

    for (const diskName of searchParams.getAll("disk")) {
        const disk =
            ALL_DISKS.find(disk => disk.displayName === diskName) ??
            FLOPPY_DISKS.find(disk => disk.displayName === diskName);
        if (disk && !isPlaceholderDiskDef(disk)) {
            disks.push(disk);
        }
    }

    let machine: MachineDef | undefined = undefined;
    const machineName = searchParams.get("machine");
    if (machineName) {
        machine = MACHINES_BY_NAME[machineName];
        isCustom = true;
    }
    if (!machine && disks.length > 0) {
        machine = disks[0].preferredMachine;
    }
    if (!machine) {
        return undefined;
    }
    let ramSize: MachineDefRAMSize | undefined = undefined;
    const ramSizeParam = searchParams.get("ram") as MachineDefRAMSize | null;
    if (ramSizeParam && machine.ramSizes.includes(ramSizeParam)) {
        ramSize = ramSizeParam;
        isCustom = true;
    }
    let screenSize: ScreenSize = isEmbed ? "embed" : "auto";
    const screenSizeParam = searchParams.get("screenSize");
    switch (screenSizeParam) {
        case "auto":
        case "fullscreen":
        case "window":
            screenSize = screenSizeParam;
            break;
        case null:
            break;
        default: {
            const [width, height] = screenSizeParam
                .split("x")
                .map(s => parseInt(s));
            if (!isNaN(width) && !isNaN(height)) {
                screenSize = {width, height};
            }
            break;
        }
    }
    let screenScale: number | undefined = undefined;
    const screenScaleParam = searchParams.get("screenScale");
    if (screenScaleParam) {
        const scale = parseFloat(screenScaleParam);
        if (!isNaN(scale)) {
            screenScale = scale;
        }
    }

    const cdromURLs = [
        ...searchParams.getAll("cdrom"),
        ...searchParams.getAll("cdrom_url"),
    ];

    let ethernetProvider;
    const appleTalkZoneName = searchParams.get("appleTalk");
    if (appleTalkZoneName) {
        ethernetProvider = new CloudflareWorkerEthernetProvider(
            appleTalkZoneName
        );
    } else if (searchParams.get("broadcast_channel_ethernet") === "true") {
        ethernetProvider = new BroadcastChannelEthernetProvider();
    }

    let customDate;
    const customDateParam = searchParams.get("date");
    if (customDateParam) {
        customDate = fromDateString(customDateParam);
    }
    const debugFallback = searchParams.get("debug_fallback") === "true";
    const debugAudio = searchParams.get("debug_audio") === "true";
    const debugPaused = searchParams.get("debug_paused") === "true";
    const debugLog = searchParams.get("debug_log") === "true";
    const debugTrackpad = searchParams.get("debug_trackpad") === "true";

    return {
        disks,
        includeInfiniteHD,
        includeSavedHD,
        includeLibrary,
        libraryDownloadURLs,
        machine,
        ramSize,
        screenSize,
        screenScale,
        ethernetProvider,
        cdromURLs,
        diskFiles: [],
        customDate,
        debugFallback,
        debugAudio,
        debugPaused,
        debugLog,
        debugTrackpad,
        isCustom,
        isEmbed,
        embedScreenUpdateMessages,
    };
}

export function runDefToUrl(runDef: RunDef): string {
    const {disks, machine, ethernetProvider} = runDef;
    let url: URL;
    if (
        disks.length === 1 &&
        ALL_DISKS.includes(disks[0]) &&
        !disks[0].hiddenInBrowser
    ) {
        url = new URL(diskToYearPath(disks[0]), location.href);
        if (!runDef.includeInfiniteHD) {
            url.searchParams.set("infinite_hd", "false");
        }
        if (!runDef.includeSavedHD) {
            url.searchParams.set("saved_hd", "false");
        }
    } else {
        url = new URL("/run", location.href);
        for (const disk of disks) {
            url.searchParams.append("disk", disk.displayName);
        }
        if (runDef.includeInfiniteHD) {
            url.searchParams.set("infinite_hd", "true");
        }
        if (runDef.includeSavedHD) {
            url.searchParams.set("saved_hd", "true");
        }
    }
    if (!runDef.includeLibrary) {
        url.searchParams.set("library", "false");
    }
    for (const libraryURL of runDef.libraryDownloadURLs) {
        url.searchParams.append("library_url", libraryURL);
    }
    for (const cdromURL of runDef.cdromURLs) {
        url.searchParams.append("cdrom", cdromURL);
    }

    if (disks.length !== 1 || machine !== disks[0].preferredMachine) {
        url.searchParams.set("machine", machine.name);
    }
    if (runDef.ramSize && runDef.ramSize !== machine.ramSizes[0]) {
        url.searchParams.set("ram", runDef.ramSize);
    }
    if (runDef.screenSize !== "auto") {
        url.searchParams.set(
            "screenSize",
            typeof runDef.screenSize === "object"
                ? `${runDef.screenSize.width}x${runDef.screenSize.height}`
                : runDef.screenSize
        );
    }
    if (runDef.screenScale && runDef.screenScale !== 1) {
        url.searchParams.set("screenScale", runDef.screenScale.toString());
    }
    if (ethernetProvider instanceof CloudflareWorkerEthernetProvider) {
        url.searchParams.set("appleTalk", ethernetProvider.zoneName());
    } else if (ethernetProvider instanceof BroadcastChannelEthernetProvider) {
        url.searchParams.set("broadcast_channel_ethernet", "true");
    }
    if (runDef.customDate) {
        url.searchParams.set("date", toDateString(runDef.customDate));
    }

    if (runDef.debugAudio) {
        url.searchParams.set("debug_audio", "true");
    }
    if (runDef.debugLog) {
        url.searchParams.set("debug_log", "true");
    }
    if (runDef.debugPaused) {
        url.searchParams.set("debug_paused", "true");
    }
    if (runDef.debugFallback) {
        url.searchParams.set("debug_fallback", "true");
    }
    if (runDef.debugTrackpad) {
        url.searchParams.set("debug_trackpad", "true");
    }
    return url.toString();
}

function diskToYearPath(disk: SystemDiskDef): string {
    const year = Object.entries(DISKS_BY_YEAR).find(([year, disks]) =>
        disks.includes(disk)
    )?.[0];
    return `/${year}/${disk.displayName}`;
}

function diskFromYearPath(pathname: string): SystemDiskDef | undefined {
    const pieces = pathname.split("/");
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
    if (!disk || isPlaceholderDiskDef(disk)) {
        return undefined;
    }
    return disk;
}
