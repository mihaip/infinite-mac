import {BroadcastChannelEthernetProvider} from "./BroadcastChannelEthernetProvider";
import {CloudflareWorkerEthernetProvider} from "./CloudflareWorkerEthernetProvider";
import {
    ALL_DISKS,
    DISKS_BY_YEAR,
    HIDDEN_DISKS,
    isPlaceholderDiskDef,
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
    disks: SystemDiskDef[];
    cdromURLs: string[];
    includeInfiniteHD: boolean;
    includeSavedHD: boolean;
    ethernetProvider?: EmulatorEthernetProvider;
    // Force non-SharedArrayBuffer mode for debugging
    debugFallback: boolean;
    debugAudio: boolean;
    debugPaused: boolean;
};

export function runDefFromUrl(urlString: string): RunDef | undefined {
    let url;
    try {
        url = new URL(urlString);
    } catch (e) {
        return undefined;
    }

    const {searchParams} = url;

    let includeInfiniteHD;
    let includeSavedHD;
    const disks: SystemDiskDef[] = [];
    const yearDiskDef = diskFromYearPath(url.pathname);
    if (yearDiskDef) {
        disks.push(yearDiskDef);
        includeInfiniteHD = searchParams.get("infinite_hd") !== "false";
        includeSavedHD = searchParams.get("saved_hd") !== "false";
    } else {
        includeInfiniteHD = searchParams.get("infinite_hd") === "true";
        includeSavedHD = searchParams.get("saved_hd") === "true";
    }

    for (const diskName of searchParams.getAll("disk")) {
        const disk =
            ALL_DISKS.find(disk => disk.displayName === diskName) ??
            HIDDEN_DISKS.find(disk => disk.displayName === diskName);
        if (disk && !isPlaceholderDiskDef(disk)) {
            disks.push(disk);
        }
    }

    let machine: MachineDef | undefined = undefined;
    const machineName = searchParams.get("machine");
    if (machineName) {
        machine = MACHINES_BY_NAME[machineName];
    }
    if (!machine && disks.length > 0) {
        machine = disks[0].machines[0];
    }
    if (!machine) {
        return undefined;
    }
    let ramSize: MachineDefRAMSize | undefined = undefined;
    const ramSizeParam = searchParams.get("ram") as MachineDefRAMSize | null;
    if (ramSizeParam && machine.ramSizes.includes(ramSizeParam)) {
        ramSize = ramSizeParam;
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
    const debugFallback = searchParams.get("debug_fallback") === "true";
    const debugAudio = searchParams.get("debug_audio") === "true";
    const debugPaused = searchParams.get("debug_paused") === "true";

    return {
        disks,
        includeInfiniteHD,
        includeSavedHD,
        machine,
        ramSize,
        ethernetProvider,
        cdromURLs,
        debugFallback,
        debugAudio,
        debugPaused,
    };
}

export function runDefToUrl(runDef: RunDef): string {
    const {disks, machine, ethernetProvider} = runDef;
    let url: URL;
    if (disks.length === 1) {
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
    for (const cdromURL of runDef.cdromURLs) {
        url.searchParams.append("cdrom", cdromURL);
    }

    if (disks.length !== 1 || machine !== disks[0].machines[0]) {
        url.searchParams.set("machine", machine.name);
    }
    if (runDef.ramSize && runDef.ramSize !== machine.ramSizes[0]) {
        url.searchParams.set("ram", runDef.ramSize);
    }
    if (ethernetProvider instanceof CloudflareWorkerEthernetProvider) {
        url.searchParams.set("appleTalk", ethernetProvider.zoneName());
    } else if (ethernetProvider instanceof BroadcastChannelEthernetProvider) {
        url.searchParams.set("broadcast_channel_ethernet", "true");
    }
    if (runDef.debugAudio) {
        url.searchParams.set("debug_audio", "true");
    }
    if (runDef.debugFallback) {
        url.searchParams.set("debug_fallback", "true");
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
