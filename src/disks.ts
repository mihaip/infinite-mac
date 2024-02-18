import {type Appearance} from "./controls/Appearance";
import {type EmulatorChunkedFileSpec} from "./emulator/emulator-common";
import {
    type MachineDef,
    MAC_128K,
    MAC_512KE,
    MAC_SE,
    MAC_II,
    MAC_IIFX,
    MAC_PLUS,
    POWER_MACINTOSH_G3_BW,
    POWER_MACINTOSH_9500,
    QUADRA_650,
    POWER_MACINTOSH_6100,
    NEXT_COMPUTER,
    NEXT_CUBE,
    NEXT_STATION,
    NEXT_STATION_TURBO_COLOR,
} from "./machines";

type GeneratedChunkedFileSpec = Omit<
    EmulatorChunkedFileSpec,
    "prefetchChunks" | "baseUrl"
>;

export type EmulatorDiskDef = {
    // Dynamically imported since some manifests can be quite large, and we
    // don't want to incur the cost of loading all of them up-front.
    generatedSpec: () => Promise<{default: GeneratedChunkedFileSpec}>;
    // prefetchChunks are semi-automatically generated -- we will get a
    // warning via validateSpecPrefetchChunks() if these are incorrect.
    prefetchChunks: number[];
    // Changes to this file will be persisted in the origin private file
    // system.
    persistent?: boolean;
    // Will be mounted as a floppy disk in emulators that make the distinction
    // between disk types.
    isFloppy?: boolean;
};

export type SystemDiskDef = EmulatorDiskDef & {
    displayName: string;
    displaySubtitle?: string;
    releaseDate: [year: number, month: number, date: number];
    description: string;
    machines: MachineDef[];
    appleTalkSupported?: boolean;
    infiniteHdSubset?: "mfs" | "system6";
    delayAdditionalDiskMount?: boolean;
    appearance?: Appearance;
    isUnstable?: boolean;
    notable?: boolean;
};

export type DiskFile = {
    file: File;
    treatAsCDROM: boolean;
};

export type PlaceholderDiskDef = {
    type: "placeholder";
    displayName: string;
    displaySubtitle?: string;
    releaseDate: [year: number, month: number, date: number];
    description: string;
    machines: MachineDef[];
};

export function isPlaceholderDiskDef(
    disk: SystemDiskDef | PlaceholderDiskDef
): disk is PlaceholderDiskDef {
    return "type" in disk && disk.type === "placeholder";
}
function isSystemDiskDef(
    disk: SystemDiskDef | PlaceholderDiskDef
): disk is SystemDiskDef {
    return !isPlaceholderDiskDef(disk);
}

const SYSTEM_1_0: SystemDiskDef = {
    displayName: "System 1.0",
    description: "Initial system software release, shipped with the Mac 128K.",
    releaseDate: [1984, 1, 24],
    prefetchChunks: [0, 1],
    machines: [MAC_128K],
    infiniteHdSubset: "mfs",
    // Loading the Infinite HD disk as part of the initial set of images does
    // appear to work in System 1.0 under Mini vMac, but if we delay it until
    // after the system is booted, it appears to work.
    delayAdditionalDiskMount: true,
    generatedSpec: () => import("./Data/System 1.0.dsk.json"),
    notable: true,
};

const SYSTEM_1_0_ORIGINAL: SystemDiskDef = {
    displayName: "System 1.0 (System Disk)",
    description: "Initial system software release, shipped with the Mac 128K.",
    releaseDate: [1984, 1, 24],
    prefetchChunks: [0, 1],
    machines: [MAC_128K],
    infiniteHdSubset: "mfs",
    delayAdditionalDiskMount: true,
    generatedSpec: () => import("./Data/System 1.0 (Original).dsk.json"),
    isFloppy: true,
};

const SYSTEM_1_1: SystemDiskDef = {
    displayName: "System 1.1",
    description:
        "Maintenance release that improved disk copying speeds and added the “Set Startup” command and the Finder about box.",
    releaseDate: [1984, 5, 5],
    prefetchChunks: [0, 1],
    machines: [MAC_128K],
    infiniteHdSubset: "mfs",
    generatedSpec: () => import("./Data/System 1.1.dsk.json"),
};

const SYSTEM_2_0: SystemDiskDef = {
    displayName: "System 2.0",
    description:
        "Introduced the ”New Folder” and ”Shut Down” commands, the MiniFinder, and the Choose Printer DA. Also added icons to list view and the Command-Shift-3 screenshot FKEY.",
    releaseDate: [1985, 4, 8],
    prefetchChunks: [0, 1],
    machines: [MAC_128K],
    infiniteHdSubset: "mfs",
    generatedSpec: () => import("./Data/System 2.0.dsk.json"),
    notable: true,
};

const SYSTEM_2_1: SystemDiskDef = {
    displayName: "System 2.1",
    description:
        "Added support for the Hard Disk 20 drive and the HFS file system.",
    releaseDate: [1985, 9, 17],
    prefetchChunks: [0, 1, 2],
    // The Mac 128K is supported, but HFS is not loaded in that case.
    machines: [MAC_512KE, MAC_128K],
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 2.1.dsk.json"),
    notable: true,
};

const SYSTEM_3_0: SystemDiskDef = {
    displayName: "System 3.0",
    description:
        "Added more complete support for HFS, a RAM disk cache, zoom boxes for windows and a redesigned control panel. Introduced with the Mac Plus.",
    releaseDate: [1986, 1, 16],
    prefetchChunks: [0, 1, 2],
    machines: [MAC_PLUS, MAC_512KE],
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 3.0.dsk.json"),
    notable: true,
};

const SYSTEM_3_1: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "System 3.1",
    releaseDate: [1986, 2, 14], // Precise date is not known
    description:
        "Caused data corruption and was superseded by 3.2 shortly after release.",
    machines: [MAC_PLUS, MAC_512KE],
};

const SYSTEM_3_2: SystemDiskDef = {
    displayName: "System 3.2",
    description:
        "Includes redesigned Calculator and Chooser desktop accessories.",
    releaseDate: [1986, 6, 2],
    prefetchChunks: [0, 1, 2],
    machines: [MAC_PLUS, MAC_512KE],
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 3.2.dsk.json"),
};

const SYSTEM_3_3: SystemDiskDef = {
    displayName: "System 3.3",
    description:
        "Enhanced AppleShare file serving support. The Trash can icon now bulges when it's not empty.",
    releaseDate: [1987, 1, 12],
    prefetchChunks: [0, 1, 2],
    machines: [MAC_PLUS, MAC_512KE],
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 3.3.dsk.json"),
};

const SYSTEM_4_0: SystemDiskDef = {
    displayName: "System 4.0",
    description:
        "Added the Find File desktop accessory and the Restart command. Features a redesigned control panel. Released with the Mac SE.",
    releaseDate: [1987, 3, 2],
    prefetchChunks: [0, 1, 2],
    machines: [MAC_SE],
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 4.0.dsk.json"),
};

const SYSTEM_4_1: SystemDiskDef = {
    displayName: "System 4.1",
    description:
        "Added Easy Access accessibility features. Improved compatibility with larger hard drives. Released with the Mac II.",
    releaseDate: [1987, 4, 14],
    prefetchChunks: [0, 1, 2],
    machines: [MAC_II, MAC_SE, MAC_PLUS, MAC_512KE],
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 4.1.dsk.json"),
};

const SYSTEM_5_0: SystemDiskDef = {
    displayName: "System 5.0",
    description:
        "Introduced the MultiFinder, revised the Finder about box, and improved printing support.",
    releaseDate: [1987, 10, 8],
    prefetchChunks: [0, 1, 2],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 5.0 HD.dsk.json"),
    notable: true,
};

const SYSTEM_5_1: SystemDiskDef = {
    displayName: "System 5.1",
    description: "Updated the LaserWriter Driver and Apple HD SC Setup.",
    releaseDate: [1987, 12, 1],
    prefetchChunks: [0, 1, 2],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 5.1 HD.dsk.json"),
};

const SYSTEM_6_0: SystemDiskDef = {
    displayName: "System 6.0",
    description: "Added MacroMaker, Map and CloseView utilities.",
    releaseDate: [1988, 4, 30],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 6.0 HD.dsk.json"),
    notable: true,
};

const SYSTEM_6_0_1: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "System 6.0.1",
    description: "Released with the Mac IIx, buggy and short-lived.",
    releaseDate: [1988, 9, 19],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
};

const SYSTEM_6_0_2: SystemDiskDef = {
    displayName: "System 6.0.2",
    description: "Updated LaserWriter and other printing-related utilites.",
    releaseDate: [1988, 9, 19],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 6.0.2 HD.dsk.json"),
};

const SYSTEM_6_0_3: SystemDiskDef = {
    displayName: "System 6.0.3",
    description: "Added support for the Mac IIcx and SE/30.",
    releaseDate: [1989, 3, 7],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 6.0.3 HD.dsk.json"),
};

const SYSTEM_6_0_4: SystemDiskDef = {
    displayName: "System 6.0.4",
    description:
        "Added support for the Mac IIci and Portable. Improved the installer. Holding down the option key when double-clicking in the Finder closes the parent window.",
    releaseDate: [1989, 9, 20],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 6.0.4 HD.dsk.json"),
};

const SYSTEM_6_0_5: SystemDiskDef = {
    displayName: "System 6.0.5",
    description:
        "Bundled 32-bit QuickDraw (previously a separate package). Added support for the Mac IIfx.",
    releaseDate: [1990, 3, 19],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 6.0.5 HD.dsk.json"),
    notable: true,
};

const SYSTEM_6_0_6: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "System 6.0.6.",
    releaseDate: [1990, 10, 15], // Official release date is not known.
    description: "Never officially released due to an AppleTalk bug.",
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
};

const SYSTEM_6_0_7: SystemDiskDef = {
    displayName: "System 6.0.7",
    description:
        "First release to ship on 1440K disks. Added support for the Classic, LC and IIsi.",
    releaseDate: [1990, 10, 15],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 6.0.7 HD.dsk.json"),
};

const SYSTEM_6_0_8: SystemDiskDef = {
    displayName: "System 6.0.8",
    description:
        "Final release of System 6, updated printing software to match the printing software of System 7.",
    releaseDate: [1991, 4, 17],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 6.0.8 HD.dsk.json"),
};

const SYSTEM_7_0: SystemDiskDef = {
    displayName: "System 7.0",
    description:
        "Fully 32-bit clean, the MultiFinder is now mandatory, reorganized the System Folder into subfolders, made the Apple menu customizable, revamped the window appearance, and much more.",
    releaseDate: [1991, 5, 13],
    prefetchChunks: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ],
    machines: [MAC_IIFX, MAC_PLUS, MAC_SE, MAC_II],
    appleTalkSupported: true,
    generatedSpec: () => import("./Data/System 7.0 HD.dsk.json"),
    notable: true,
};

const SYSTEM_7_1: SystemDiskDef = {
    displayName: "System 7.1",
    description:
        "Added the Fonts folder, introduced system enablers to support new Mac models and improved internationalization support.",
    releaseDate: [1992, 8, 28],
    prefetchChunks: [
        0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22,
        25, 26,
    ],
    machines: [QUADRA_650, MAC_IIFX, MAC_PLUS, MAC_SE, MAC_II],
    appleTalkSupported: true,
    generatedSpec: () => import("./Data/System 7.1 HD.dsk.json"),
};

const SYSTEM_7_1_1: SystemDiskDef = {
    displayName: "System 7.1.1",
    displaySubtitle: "Pro",
    description: "Bundled PowerTalk and AppleScript.",
    releaseDate: [1993, 10, 21],
    prefetchChunks: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 21, 22, 23,
        24, 25, 26, 27, 28, 29, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43,
        44,
    ],
    machines: [QUADRA_650, MAC_IIFX, MAC_PLUS, MAC_SE, MAC_II],
    appleTalkSupported: true,
    generatedSpec: () => import("./Data/System 7.1.1 HD.dsk.json"),
};

const SYSTEM_7_1_2: SystemDiskDef = {
    displayName: "System 7.1.2",
    description:
        "Initial system software for the first Power Macintosh computers.",
    releaseDate: [1994, 3, 14],
    prefetchChunks: [0, 1, 2],
    machines: [POWER_MACINTOSH_6100],
    isUnstable: true,
    generatedSpec: () => import("./Data/System 7.1.2 HD.dsk.json"),
};

const SYSTEM_7_1_2_DISK_TOOLS: SystemDiskDef = {
    displayName: "System 7.1.2 Disk Tools",
    description:
        "Disk Tools startup disk from the floppy disk version of System 7.1.2.",
    releaseDate: [1994, 3, 14],
    prefetchChunks: [0],
    machines: [POWER_MACINTOSH_6100],
    generatedSpec: () => import("./Data/System 7.1.2 Disk Tools FD.dsk.json"),
    isFloppy: true,
};

const SYSTEM_7_5: SystemDiskDef = {
    displayName: "System 7.5",
    description:
        "Featured a new startup screen, drag-and-drop support and the Launcher. Included a hierarchical Apple menu, Extensions Manager, menu bar clock, Find File, Stickies, WindowShade, all based on licensed third-party utilities.",
    releaseDate: [1994, 9, 12],
    prefetchChunks: [
        0, 1, 2, 6, 7, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
        26, 27, 28, 33, 39, 40, 41, 43, 44, 45, 46, 47, 48, 50, 51, 54, 55, 56,
        57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 70, 71, 72,
    ],
    machines: [QUADRA_650, MAC_IIFX, MAC_PLUS, MAC_SE, MAC_II],
    appleTalkSupported: true,
    generatedSpec: () => import("./Data/System 7.5 HD.dsk.json"),
    notable: true,
};

const SYSTEM_7_5_DISK_TOOLS: SystemDiskDef = {
    displayName: "System 7.5 Disk Tools",
    description:
        "Disk Tools startup disk from the floppy disk version of System 7.5.",
    releaseDate: [1994, 9, 12],
    prefetchChunks: [0],
    machines: [POWER_MACINTOSH_6100],
    generatedSpec: () => import("./Data/System 7.5 Disk Tools FD.dsk.json"),
    isFloppy: true,
};

const SYSTEM_7_5_1: SystemDiskDef = {
    displayName: "System 7.5.1",
    description:
        "Bug fixes and small tweaks. Startup screen now now features the Mac OS logo.",
    releaseDate: [1995, 3, 23],
    prefetchChunks: [
        0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23,
        27, 28, 29, 31, 32, 33, 34, 35, 39, 41, 48, 50, 51, 54, 55, 57, 58, 59,
        64, 65, 66, 67, 68, 69, 70, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89,
        90, 91, 92, 93, 94,
    ],
    machines: [QUADRA_650, MAC_IIFX, MAC_PLUS, MAC_SE, MAC_II],
    appleTalkSupported: true,
    generatedSpec: () => import("./Data/System 7.5.1 HD.dsk.json"),
};

const SYSTEM_7_5_2: SystemDiskDef = {
    displayName: "System 7.5.2",
    description:
        "Introduced the Open Transport networking stack. Added support for PCI-based Power Macs.",
    releaseDate: [1995, 6, 19],
    prefetchChunks: [
        0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23,
        27, 28, 29, 31, 32, 33, 34, 35, 39, 41, 48, 50, 51, 54, 55, 57, 58, 59,
        64, 65, 66, 67, 68, 69, 70, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89,
        90, 91, 92, 93, 94,
    ],
    machines: [POWER_MACINTOSH_9500],
    appleTalkSupported: true,
    isUnstable: true,
    generatedSpec: () => import("./Data/System 7.5.2 HD.dsk.json"),
};

const SYSTEM_7_5_3: SystemDiskDef = {
    displayName: "System 7.5.3",
    description:
        "Brought Open Transport and other improvements released with the PCI Power Mac-only 7.5.2 release to a broader set of Macs.",
    releaseDate: [1996, 3, 11],
    prefetchChunks: [
        0, 3, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24,
        25, 26, 27, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58,
        59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 79, 80, 88, 89, 90, 92, 93,
        94, 96, 98, 99, 100, 102, 103, 104, 106, 107, 108, 109, 110, 111, 113,
        114, 116, 117, 166,
    ],
    machines: [QUADRA_650, MAC_PLUS, MAC_SE, MAC_II, MAC_IIFX],
    appleTalkSupported: true,
    generatedSpec: () => import("./Data/System 7.5.3 HD.dsk.json"),
    notable: true,
};

const SYSTEM_7_5_3_PPC: SystemDiskDef = {
    displayName: "System 7.5.3",
    displaySubtitle: "PowerPC",
    description:
        "Installation with OpenDoc, QuickDraw GX and other PowerPC-only software.",
    releaseDate: [1996, 3, 11],
    prefetchChunks: [
        0, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23,
        24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
        43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 55, 56, 57, 58, 59, 60, 61, 62,
        63, 64, 68, 69, 70, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 96, 97, 98,
        99, 100, 101, 102, 103, 106, 107, 108, 109, 110, 111, 112, 114, 120,
        121, 122, 123, 124, 125, 129, 130, 131, 133, 134, 135, 136, 137, 139,
        140, 141, 142, 143, 144, 145, 146, 147, 148, 152, 153, 155,
    ],
    machines: [POWER_MACINTOSH_9500],
    appleTalkSupported: true,
    generatedSpec: () => import("./Data/System 7.5.3 (PPC) HD.dsk.json"),
};

const KANJITALK_7_5_3: SystemDiskDef = {
    displayName: "KanjiTalk 7.5.3",
    description: "Japanese edition of System 7.5.3.",
    releaseDate: [1996, 3, 11],
    prefetchChunks: [
        0, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 27, 28,
        29, 30, 31, 32, 33, 34, 35, 43, 44, 45, 46, 47, 49, 50, 51, 52, 54, 62,
        63, 64, 65, 66, 67, 69, 70, 71, 72, 73, 76, 77, 78, 79, 80, 81, 82, 83,
        84, 85, 89, 90, 94, 114, 116, 142, 147, 159, 161, 168, 169, 170, 171,
        172, 174, 175, 176, 177, 179, 180, 181, 182, 183, 185, 186, 187, 189,
        190, 191, 192, 193, 194, 195, 196, 197, 399,
    ],
    machines: [QUADRA_650, MAC_PLUS, MAC_SE, MAC_II, MAC_IIFX],
    appleTalkSupported: true,
    generatedSpec: () => import("./Data/KanjiTalk 7.5.3 HD.dsk.json"),
    notable: true,
};

const SYSTEM_7_5_4: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "System 7.5.4",
    description:
        "Withdrawn from release at the last minute due a showstopper bug.",
    releaseDate: [1996, 9, 18],
    machines: [QUADRA_650, MAC_PLUS, MAC_SE, MAC_II, MAC_IIFX],
};

const SYSTEM_7_5_5: SystemDiskDef = {
    displayName: "System 7.5.5",
    description: "Improved memory system performance and reliability.",
    releaseDate: [1996, 9, 18],
    prefetchChunks: [
        0, 2, 5, 6, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
        24, 25, 27, 28, 30, 31, 32, 33, 34, 35, 38, 45, 46, 49, 50, 51, 57, 59,
        61, 64, 66, 70, 71, 79, 83, 84, 86, 87, 88, 89, 90, 95, 96, 97, 100,
        103, 107, 114, 115, 125, 126, 130, 131, 132, 150, 151, 159, 161, 162,
        163, 164, 165, 168, 170, 171, 172, 180, 181, 182, 183, 184, 185, 186,
        187, 188, 189, 190,
    ],
    machines: [
        QUADRA_650,
        MAC_PLUS,
        MAC_SE,
        MAC_II,
        MAC_IIFX,
        POWER_MACINTOSH_9500,
    ],
    appleTalkSupported: true,
    generatedSpec: () => import("./Data/System 7.5.5 HD.dsk.json"),
};

const MAC_OS_7_6: SystemDiskDef = {
    displayName: "Mac OS 7.6",
    description:
        "First to be officially called “Mac OS”. Improved performance and reliability. Featured a revamped Extensions Manager and speech support.",
    releaseDate: [1997, 1, 7],
    prefetchChunks: [
        0, 3, 6, 11, 12, 13, 18, 29, 30, 32, 33, 34, 35, 36, 37, 38, 39, 40, 54,
        55, 56, 57, 58, 59, 60, 61, 64, 65, 66, 67, 68, 69, 70, 78, 79, 80, 81,
        82, 84, 85, 86, 88, 92, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108,
        109, 110, 112, 113, 114, 115, 116, 117, 119, 120, 121, 122, 126, 127,
        128, 134, 136, 139, 140, 141, 145, 146, 147, 148, 149, 150, 151, 152,
        153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166,
        167, 168, 169, 170, 171,
    ],
    machines: [QUADRA_650, MAC_IIFX, POWER_MACINTOSH_9500],
    appleTalkSupported: true,
    generatedSpec: () => import("./Data/Mac OS 7.6 HD.dsk.json"),
    notable: true,
};

const MAC_OS_8_0: SystemDiskDef = {
    displayName: "Mac OS 8.0",
    description:
        "Introduced the Platinum appearance, multi-threaded Finder, context menus, popup windows, and other features.",
    releaseDate: [1997, 7, 26],
    prefetchChunks: [
        0, 3, 6, 7, 10, 11, 12, 22, 23, 25, 28, 29, 30, 31, 33, 34, 35, 36, 37,
        39, 40, 42, 44, 56, 58, 59, 60, 62, 63, 65, 66, 67, 68, 70, 71, 72, 73,
        74, 75, 80, 81, 82, 83, 84, 85, 86, 87, 88, 94, 95, 96, 97, 100, 101,
        102, 103, 104, 105, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122,
        123, 124, 126, 130, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149,
        150, 151, 152, 153, 154, 155, 156, 157, 158, 160, 165, 166, 172, 173,
        174, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188,
        189, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204,
        205, 206, 208,
    ],
    machines: [QUADRA_650, POWER_MACINTOSH_9500],
    appleTalkSupported: true,
    appearance: "Platinum",
    generatedSpec: () => import("./Data/Mac OS 8.0 HD.dsk.json"),
    notable: true,
};

const MAC_OS_8_1: SystemDiskDef = {
    displayName: "Mac OS 8.1",
    description: "Added support for the HFS+ file system.",
    releaseDate: [1998, 1, 19],
    prefetchChunks: [
        0, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 22, 23, 24, 25, 26, 27, 28, 29,
        30, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
        49, 50, 51, 52, 54, 55, 56, 57, 58, 60, 61, 63, 64, 65, 66, 67, 68, 69,
        70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 85, 86, 87, 88,
        89, 90, 91, 92, 93, 94, 95, 96, 97, 108, 119, 120, 122, 123, 124, 125,
        126, 129, 130, 131, 132, 137, 138, 143, 144, 145, 151, 152, 153, 154,
        155, 158, 159, 160, 161, 162, 163, 169, 170, 171, 172, 175, 176, 177,
        179, 181,
    ],
    machines: [QUADRA_650, POWER_MACINTOSH_9500],
    appleTalkSupported: true,
    appearance: "Platinum",
    generatedSpec: () => import("./Data/Mac OS 8.1 HD.dsk.json"),
    notable: true,
};

const MAC_OS_8_1_DISK_TOOLS_68K: SystemDiskDef = {
    displayName: "Mac OS 8.1 Disk Tools (68K)",
    description:
        "Disk Tools startup disk from the floppy disk version of Mac OS 8.1.",
    releaseDate: [1998, 1, 19],
    prefetchChunks: [0],
    machines: [QUADRA_650],
    generatedSpec: () => import("./Data/Mac OS 8.1 Disk Tools 68K FD.dsk.json"),
    isFloppy: true,
};

const MAC_OS_8_1_DISK_TOOLS_PPC: SystemDiskDef = {
    displayName: "Mac OS 8.1 Disk Tools (PPC)",
    description:
        "Disk Tools startup disk from the floppy disk version of Mac OS 8.1.",
    releaseDate: [1998, 1, 19],
    prefetchChunks: [0],
    machines: [POWER_MACINTOSH_9500],
    generatedSpec: () => import("./Data/Mac OS 8.1 Disk Tools PPC FD.dsk.json"),
    isFloppy: true,
};

const MAC_OS_8_5: SystemDiskDef = {
    displayName: "Mac OS 8.5",
    description:
        "Introduced Sherlock, 32-bit icons in the Finder, font smoothing, a new help system and the application palette.",
    releaseDate: [1998, 10, 17],
    prefetchChunks: [
        0, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 23, 24, 25,
        26, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44,
        45, 46, 47, 48, 49, 51, 52, 53, 54, 55, 56, 57, 58, 62, 68, 69, 70, 71,
        72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 87, 88, 89, 90, 91,
        92, 93, 94, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113,
        114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127,
        128, 129, 130, 131, 132, 134, 135, 136, 137, 138, 139, 140, 181, 182,
        183, 184, 185, 186, 187, 191, 192, 194, 195, 196, 197, 198, 200, 204,
        205, 207, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220,
        221, 222, 223, 224, 225, 228, 229, 230, 231, 232, 234, 240, 241, 243,
        244, 247, 248, 249, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259,
        260, 261, 263, 264, 270, 272, 273, 280, 281, 334, 345, 347, 349, 350,
        351, 352, 353, 354, 363, 364, 414, 415, 416, 421, 422, 423, 425, 426,
        427, 428, 432, 453, 454, 458,
    ],
    machines: [POWER_MACINTOSH_9500, POWER_MACINTOSH_G3_BW],
    appleTalkSupported: true,
    appearance: "Platinum",
    generatedSpec: () => import("./Data/Mac OS 8.5 HD.dsk.json"),
    notable: true,
};

const MAC_OS_8_6: SystemDiskDef = {
    displayName: "Mac OS 8.6",
    description:
        "Added a revised nanokernel for improved multi-processing and multi-threading.",
    releaseDate: [1999, 5, 10],
    prefetchChunks: [
        0, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
        24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 38, 39, 40, 41, 42,
        43, 44, 45, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 68, 69, 72, 78,
        80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97,
        98, 99, 100, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
        120, 122, 124, 125, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136,
        137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150,
        151, 152, 193, 194, 195, 198, 199, 200, 201, 203, 204, 205, 208, 209,
        211, 212, 213, 214, 216, 220, 221, 222, 223, 228, 229, 230, 231, 237,
        238, 241, 242, 243, 244, 245, 246, 247, 248, 249, 251, 252, 253, 254,
        255, 256, 259, 260, 261, 262, 263, 264, 265, 266, 267, 269, 271, 272,
        279, 280, 281, 283, 284, 286, 347, 357, 358, 359, 360, 361, 362, 363,
        364, 365, 367, 368, 369, 370, 371, 372, 373, 374, 375, 376, 377, 378,
        379, 380, 381, 382, 383, 384, 391, 392, 393, 399, 400, 401, 447, 448,
        449, 456, 457, 458, 483, 488,
    ],
    machines: [POWER_MACINTOSH_9500, POWER_MACINTOSH_G3_BW],
    appleTalkSupported: true,
    appearance: "Platinum",
    generatedSpec: () => import("./Data/Mac OS 8.6 HD.dsk.json"),
};

const MAC_OS_9_0: SystemDiskDef = {
    displayName: "Mac OS 9.0",
    description:
        "Introduced the Keychain, multiple user support, iTools integration, Sherlock internet channels and online software updates.",
    releaseDate: [1999, 10, 23],
    prefetchChunks: [
        0, 4, 5, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 38, 39, 41,
        42, 43, 44, 45, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
        61, 62, 63, 64, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
        81, 82, 83, 84, 85, 87, 88, 89, 92, 97, 102, 103, 104, 105, 106, 107,
        108, 116, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129,
        130, 131, 132, 133, 134, 135, 136, 137, 138, 140, 141, 142, 144, 145,
        147, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162,
        163, 165, 166, 167, 168, 169, 170, 172, 173, 174, 175, 176, 177, 178,
        179, 180, 181, 182, 183, 185, 251, 252, 253, 254, 255, 256, 258, 259,
        260, 261, 262, 263, 264, 272, 273, 274, 275, 277, 278, 280, 282, 284,
        285, 286, 287, 306, 308, 309, 310, 311, 313, 314, 318, 320, 321, 322,
        324, 325, 327, 331, 337, 338, 339, 342, 343, 347, 352, 353, 354, 356,
        357, 359, 360, 361, 365, 368, 369, 370, 371, 373, 374, 378, 379, 380,
        381, 383, 384, 385, 386, 387, 388, 389, 397, 399, 400, 406, 408, 409,
        410, 411, 412, 413, 416, 417, 419, 422, 424, 428, 429, 430, 431, 432,
        433, 441, 446, 492, 494, 499, 500, 501, 502, 503, 506, 507, 508, 511,
        512, 515, 554, 559, 560, 562, 563, 564, 565, 566, 567, 568,
    ],
    machines: [POWER_MACINTOSH_G3_BW, POWER_MACINTOSH_9500],
    appearance: "Platinum",
    generatedSpec: () => import("./Data/Mac OS 9.0 HD.dsk.json"),
    notable: true,
};

const MAC_OS_9_0_1: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "Mac OS 9.0.1",
    description: "Under development but never released.",
    releaseDate: [2000, 1, 1], // Planned release date unknown
    machines: [POWER_MACINTOSH_G3_BW, POWER_MACINTOSH_9500],
};

const MAC_OS_9_0_2: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "Mac OS 9.0.2",
    description: "Released with the PowerBook G3 (FireWire) only.",
    releaseDate: [2000, 2, 16],
    machines: [POWER_MACINTOSH_G3_BW, POWER_MACINTOSH_9500],
};

const MAC_OS_9_0_3: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "Mac OS 9.0.3",
    description: "Released with iMacs only.",
    releaseDate: [2000, 3, 1], // Exact date unknown
    machines: [POWER_MACINTOSH_G3_BW, POWER_MACINTOSH_9500],
};

const MAC_OS_9_0_4: SystemDiskDef = {
    displayName: "Mac OS 9.0.4",
    description:
        "Bug fixes, final release supported by the SheepShaver emulator.",
    releaseDate: [2000, 4, 4],
    prefetchChunks: [
        0, 4, 5, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33,
        34, 35, 38, 39, 40, 44, 46, 47, 48, 49, 50, 51, 52, 54, 55, 56, 57, 58,
        59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 74, 75, 76, 77, 78,
        79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 90, 91, 92, 93, 94, 95, 99, 103,
        104, 105, 106, 110, 111, 112, 113, 114, 115, 116, 125, 126, 127, 128,
        129, 130, 131, 132, 133, 134, 135, 136, 137, 140, 141, 145, 146, 149,
        150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163,
        164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177,
        178, 179, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192,
        193, 194, 195, 272, 273, 275, 276, 277, 278, 279, 280, 281, 286, 287,
        288, 291, 292, 294, 295, 296, 297, 298, 299, 300, 303, 304, 305, 306,
        307, 308, 309, 310, 311, 312, 315, 316, 317, 319, 320, 330, 332, 333,
        334, 335, 336, 340, 346, 349, 350, 351, 352, 353, 355, 356, 359, 360,
        361, 363, 364, 365, 366, 367, 368, 369, 370, 373, 374, 380, 382, 385,
        386, 387, 391, 392, 394, 395, 396, 398, 399, 400, 401, 411, 412, 413,
        416, 417, 418, 419, 422, 423, 424, 425, 479, 480, 481, 482, 483, 484,
        493, 496, 497, 500, 501, 502, 504, 507, 511, 559, 567, 571, 572, 574,
        575, 577, 579, 580, 583, 586, 587, 588, 589, 591, 593, 595, 596, 597,
        598,
    ],
    machines: [POWER_MACINTOSH_G3_BW, POWER_MACINTOSH_9500],
    appearance: "Platinum",
    generatedSpec: () => import("./Data/Mac OS 9.0.4 HD.dsk.json"),
};

const NEXTSTEP_0_8: SystemDiskDef = {
    displayName: "NeXTStep 0.8",
    description:
        "First publicly-available preview release. Included the Mach kernel, an object-oriented API based on Objective-C, a Display PostScript-powered UI, and several applications.",
    releaseDate: [1988, 10, 12],
    prefetchChunks: [
        0, 1, 2, 3, 40, 41, 42, 43, 44, 45, 79, 80, 84, 85, 86, 118, 119, 121,
        122, 123, 124, 125, 126, 127, 128, 158, 159, 160, 197, 198, 236, 238,
        315, 317, 474, 477, 591, 593, 710, 711, 712, 748, 749, 788, 789, 906,
        907, 908, 945, 947, 985, 986, 1142, 1143, 1181, 1183, 1852, 1853, 1890,
        1892, 1930, 1931, 1932, 1933, 1935, 2481, 2483, 2520, 2522, 2523, 2524,
        2560, 2561, 2639, 2640, 2835, 2837, 2914, 2915, 2916, 2954, 3350, 3351,
        3390, 3391, 3392, 3393, 3394, 3395, 3396, 3403, 3404, 3405, 3429, 3430,
        3431, 3432, 3468, 3469, 3470, 3471, 3472, 3477, 3478, 3485, 3494, 3495,
        3496, 3497, 3508, 3509, 3512, 3513, 3514, 3515, 3516, 3517, 3518, 3519,
        3520, 3547, 3548, 3549, 3550, 3551, 3552, 3553, 3554, 3555, 3557, 3558,
        3559, 3560, 3562, 3565, 3566, 3572, 3587, 3588, 3589, 3602, 3603, 3604,
        3605, 3608, 3609, 3610, 3611, 3612, 3630, 3631, 3632, 3633, 3665, 3705,
        3706, 3707, 3708, 3709, 3710, 3714, 3715, 3716, 3717, 3718, 3720, 3722,
        3723, 3724, 3725, 3726, 3727, 3728, 3730, 3731, 3732, 3745, 3750, 3752,
        3753, 3784, 3786, 3787, 3823, 3824, 3825, 3826, 3827, 3828, 3833, 3834,
        3846, 3863, 3871, 3877, 3903, 3911, 3912,
    ],
    machines: [NEXT_COMPUTER],
    appearance: "NeXT",
    generatedSpec: () => import("./Data/NeXTStep 0.8 HD.dsk.json"),
};

const NEXTSTEP_3_3: SystemDiskDef = {
    displayName: "NeXTSTEP 3.3",
    description:
        "Final NeXTSTEP release, improved Intel support and added MIME support to NeXTmail.",
    releaseDate: [1994, 12, 7],
    prefetchChunks: [
        0, 1, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20, 21, 23, 24, 25, 26, 28,
        32, 33, 34, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 164, 168, 169, 172,
        173, 174, 176, 177, 178, 179, 180, 181, 185, 188, 192, 193, 194, 196,
        197, 198, 199, 200, 201, 202, 208, 209, 210, 211, 224, 225, 228, 236,
        240, 241, 260, 280, 328, 329, 376, 400, 412, 476, 504, 505, 506, 644,
        648, 649, 652, 653, 656, 657, 658, 904, 907, 908, 909, 911, 912, 913,
        914, 916, 921, 923, 924, 927, 928, 929, 930, 931, 932, 933, 934, 935,
        936, 937, 938, 939, 940, 941, 942, 943, 944, 945, 946, 948, 950, 951,
        952, 953, 954, 960, 964, 965, 968, 969, 970, 972, 973, 976, 977, 978,
        979, 985, 1000, 1001, 1004, 1008, 1012, 1013, 1016, 1017, 1018, 1019,
        1020, 1021, 1024, 1025, 1028, 1029, 1030, 1036, 1037, 1042, 1043, 1044,
        1060, 1068, 1072, 1076, 1077, 1080, 1100, 1112, 1144, 1168, 1176, 1177,
        1184, 1188, 1192, 1240, 1241, 1244, 1248, 1252, 1256, 1284, 1352, 1353,
        1356, 1357, 1412, 1413, 1424, 1428, 1432, 1436, 1437, 1468, 1469, 1484,
        1485, 1496, 1500, 1516, 1517, 1518, 1528, 1529, 1530, 1531, 1532, 1533,
        1534, 1536, 1539, 1541, 1560, 1561, 1584, 1585, 1588, 1589, 1600, 1601,
        1656, 1657, 1676, 1677, 1696, 1697, 1736, 1737, 1764, 1765, 1784, 1796,
        1800, 1801, 1848, 1852, 1853, 1856, 1857, 1920, 1924, 1956, 1957, 1960,
        1992, 1996, 1997, 2032, 2033, 2036, 2037, 2040, 2043, 2104, 2105, 2112,
        2113, 2280, 2284, 2292, 2293, 2296, 2300, 2308, 2309, 2320, 2324, 2325,
        2364, 2368, 2369, 2400, 2404, 2408, 2412, 2424, 2436, 2440, 2476, 2477,
        2492, 2493, 2508, 2509, 2540, 2541, 2544, 2560, 2561, 2576, 2577, 2578,
        2588, 2589, 2608, 2609, 2628, 2629, 2644, 2645, 2660, 2664, 2684, 2685,
        2700, 2701, 2702, 2704, 2724, 2729, 3104, 3105, 3108, 3160, 3240, 3241,
        3244, 3248, 3252, 3264, 3268, 3273, 3276, 3480, 3481, 3484, 3492, 3500,
        3504, 4092,
    ],
    machines: [
        NEXT_STATION_TURBO_COLOR,
        NEXT_STATION,
        NEXT_CUBE,
        NEXT_COMPUTER,
    ],
    appearance: "NeXT",
    generatedSpec: () => import("./Data/NEXTSTEP 3.3 HD.dsk.json"),
};

const NEXTSTEP_4_0: SystemDiskDef = {
    displayName: "NeXTSTEP 4.0 PR1",
    description:
        "Preview release of NeXTSTEP 4.0, featuring a revamped look-and-feel. Abandoned in favor of OPENSTEP 4.0, which reverted back to the NexTSTEP 3.3 UI.",
    releaseDate: [1995, 9, 7],
    prefetchChunks: [
        0, 1, 4, 8, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
        27, 28, 32, 33, 34, 37, 38, 39, 40, 41, 46, 47, 48, 68, 69, 70, 76, 77,
        164, 168, 169, 172, 176, 177, 180, 181, 192, 193, 196, 197, 268, 269,
        270, 271, 272, 273, 274, 275, 276, 280, 281, 288, 292, 296, 300, 320,
        324, 476, 504, 506, 512, 513, 516, 560, 564, 568, 572, 573, 574, 575,
        576, 577, 578, 579, 580, 581, 582, 583, 584, 585, 586, 587, 588, 589,
        592, 593, 594, 598, 599, 629, 644, 648, 649, 652, 653, 656, 657, 658,
        660, 780, 788, 792, 793, 794, 795, 796, 797, 798, 799, 800, 801, 804,
        805, 904, 908, 909, 912, 913, 914, 915, 916, 917, 920, 921, 923, 927,
        928, 929, 931, 932, 933, 934, 960, 961, 962, 963, 964, 965, 966, 968,
        969, 972, 973, 976, 977, 978, 979, 980, 981, 985, 986, 1000, 1001, 1008,
        1012, 1013, 1014, 1016, 1020, 1021, 1024, 1025, 1028, 1029, 1036, 1037,
        1041, 1042, 1043, 1044, 1048, 1049, 1053, 1072, 1076, 1077, 1080, 1100,
        1112, 1144, 1165, 1166, 1168, 1169, 1170, 1171, 1176, 1177, 1184, 1188,
        1192, 1236, 1240, 1241, 1244, 1245, 1246, 1248, 1252, 1256, 1284, 1296,
        1297, 1308, 1312, 1336, 1337, 1352, 1353, 1356, 1357, 1372, 1376, 1380,
        1381, 1384, 1388, 1392, 1396, 1400, 1404, 1405, 1408, 1412, 1413, 1416,
        1420, 1424, 1428, 1432, 1433, 1436, 1440, 1444, 1448, 1452, 1460, 1461,
        1462, 1463, 1464, 1465, 1466, 1467, 1468, 1484, 1496, 1500, 1501, 1516,
        1517, 1528, 1529, 1530, 1532, 1533, 1534, 1535, 1536, 1539, 1553, 1848,
        2400, 2404, 2408, 2412, 2424, 2548, 2552, 2556, 2580, 2584, 2592, 2596,
        2600, 2604, 3492, 3496, 3516, 4012, 4013, 4014, 4015, 4016, 4018, 4019,
        4020, 4048, 4056, 4064, 4076, 4092,
    ],
    machines: [
        NEXT_STATION_TURBO_COLOR,
        NEXT_STATION,
        NEXT_CUBE,
        NEXT_COMPUTER,
    ],
    appearance: "NeXT",
    generatedSpec: () => import("./Data/NEXTSTEP 4.0 HD.dsk.json"),
};

const OPENSTEP_4_0: SystemDiskDef = {
    displayName: "OPENSTEP 4.0",
    description:
        "First release to implement the OPENSTEP specification. Also includes NEXTIME, Samba, PPP, Perl5 and Taylor UUCP support.",
    releaseDate: [1996, 6, 25],
    prefetchChunks: [
        0, 1, 16, 32, 48, 49, 51, 65, 66, 81, 112, 113, 128, 129, 144, 145, 160,
        161, 162, 176, 177, 208, 209, 224, 225, 240, 241, 256, 288, 304, 336,
        337, 369, 432, 433, 464, 465, 480, 481, 512, 528, 560, 576, 577, 609,
        610, 640, 641, 642, 643, 644, 645, 646, 672, 673, 688, 689, 690, 691,
        692, 693, 704, 705, 706, 720, 721, 736, 737, 769, 770, 784, 785, 786,
        787, 788, 789, 792, 794, 795, 816, 817, 818, 832, 833, 896, 897, 913,
        914, 1169, 1232, 1233, 1248, 1249, 1264, 1265, 1266, 1280, 1281, 1296,
        1298, 1312, 1313, 1314, 1315, 1328, 1329, 1360, 1361, 1376, 1377, 1378,
        1392, 1393, 1394, 1395, 1396, 1397, 1408, 1409, 1424, 1425, 1426, 1427,
        1440, 1441, 1456, 1457, 1472, 1473, 1488, 1489, 1520, 1521, 1552, 1568,
        1569, 1648, 1649, 1664, 1665, 1680, 1681, 1696, 1697, 1712, 1713, 1728,
        1729, 1744, 1745, 1760, 1761, 1762, 1776, 1777, 1792, 1808, 1824, 1840,
        1841, 1856, 1857, 1858, 1904, 1905, 1920, 1921, 1969, 1970, 2032, 2033,
        2034, 2048, 2064, 2065, 2112, 2113, 2128, 2129, 2130, 2144, 2145, 2146,
        2160, 2161, 2208, 2209, 2210, 2224, 2225, 2240, 2241, 2256, 2257, 2258,
        2272, 2273, 2288, 2289, 2304, 2400, 2401, 2496, 2497, 2513, 2544, 2545,
        2576, 2577, 2578, 2592, 2624, 2625, 2626, 2627, 2640, 2641, 2642, 2672,
        2673, 2674, 2753, 2754, 2816, 2818, 2819, 2820, 2821, 2822, 2823, 2824,
        2832, 2833, 2848, 2851, 2881, 2882, 2992, 2993, 3008, 3104, 3105, 3106,
        3120, 3360, 3361, 3440, 3441, 3520, 3521, 3664, 3665, 3696, 3697, 3776,
        3777, 3824, 3825, 3968, 3969, 4033, 4096, 4112, 4113, 4114, 4144, 4368,
        4369, 4513, 4515, 4518, 4528, 4529, 4532, 4538, 4539, 4544, 4545, 4546,
        4547, 4548, 4549, 4550, 4551, 4552, 4553, 4554, 4556, 4558, 4559, 4560,
        4561, 4564, 4565, 4566, 4567, 4569, 4570, 4576, 4577, 4578, 4579, 4580,
        4593, 4594, 4595, 4609, 4611, 4625, 4626, 4627, 4628, 4629, 4630, 4656,
        4657, 4658, 4659, 4660, 4661, 4662, 4663, 4664, 4665, 4666, 4667, 4668,
        4669, 4672, 4674, 4675, 4688, 4689, 4690, 4736, 4737, 4848, 4849, 4864,
        4865, 4880, 4881, 4896, 4897, 4898, 4899, 4912, 4960, 4961, 4976, 4977,
        4992, 4993, 5008, 5009, 5024, 5025, 5026, 5027, 5028, 5029, 5030, 5031,
        5032, 5040, 5041, 5056, 5057, 5072, 5073, 5088, 5089, 5090, 5091, 5092,
        5093, 5094, 5095, 5096, 5097, 5104, 5105, 5152, 5153, 5168, 5184, 5185,
        5200, 5201, 5216, 5217, 5218, 5219, 5232, 5233, 5264, 5265, 5312, 5313,
        5392, 5393, 5456, 5457, 5520, 5521, 5523, 5536, 5537, 5552, 5553, 5568,
        5569, 5680, 5681, 5696, 5697, 5840, 5841, 5857, 5872, 5876, 6033, 6048,
        6049, 6065, 6128, 6129, 6192, 6193, 6321, 6368, 6369, 6370, 6384, 6385,
        6481, 6482, 6496, 6497, 6498, 6544, 6545, 6560, 6561, 6576, 6577, 6592,
        6593, 6640, 6641, 6656, 6672, 6688, 7040, 7041, 7264, 7265, 7376, 7377,
        7392, 7393, 7424, 7472, 7473, 7520, 7521, 7552, 7553, 7601, 7632, 7633,
        7665,
    ],
    machines: [
        NEXT_STATION_TURBO_COLOR,
        NEXT_STATION,
        NEXT_CUBE,
        NEXT_COMPUTER,
    ],
    appearance: "NeXT",
    generatedSpec: () => import("./Data/OPENSTEP 4.0 HD.dsk.json"),
};

export const ALL_DISKS = [
    SYSTEM_1_0,
    SYSTEM_1_1,
    SYSTEM_2_0,
    SYSTEM_2_1,
    SYSTEM_3_0,
    SYSTEM_3_1,
    SYSTEM_3_2,
    SYSTEM_3_3,
    SYSTEM_4_0,
    SYSTEM_4_1,
    SYSTEM_5_0,
    SYSTEM_5_1,
    SYSTEM_6_0,
    SYSTEM_6_0_1,
    SYSTEM_6_0_2,
    SYSTEM_6_0_3,
    SYSTEM_6_0_4,
    SYSTEM_6_0_5,
    SYSTEM_6_0_6,
    SYSTEM_6_0_7,
    SYSTEM_6_0_8,
    SYSTEM_7_0,
    SYSTEM_7_1,
    SYSTEM_7_1_1,
    SYSTEM_7_1_2,
    SYSTEM_7_5,
    SYSTEM_7_5_1,
    SYSTEM_7_5_2,
    SYSTEM_7_5_3,
    SYSTEM_7_5_3_PPC,
    KANJITALK_7_5_3,
    SYSTEM_7_5_4,
    SYSTEM_7_5_5,
    MAC_OS_7_6,
    MAC_OS_8_0,
    MAC_OS_8_1,
    MAC_OS_8_5,
    MAC_OS_8_6,
    MAC_OS_9_0,
    MAC_OS_9_0_1,
    MAC_OS_9_0_2,
    MAC_OS_9_0_3,
    MAC_OS_9_0_4,
    NEXTSTEP_0_8,
    NEXTSTEP_3_3,
    NEXTSTEP_4_0,
    OPENSTEP_4_0,
];

export const FLOPPY_DISKS = [
    SYSTEM_1_0_ORIGINAL,
    SYSTEM_7_1_2_DISK_TOOLS,
    SYSTEM_7_5_DISK_TOOLS,
    MAC_OS_8_1_DISK_TOOLS_68K,
    MAC_OS_8_1_DISK_TOOLS_PPC,
];

export const SYSTEM_DISKS_BY_NAME: {[name: string]: SystemDiskDef} =
    Object.fromEntries(
        ALL_DISKS.filter(isSystemDiskDef).map(disk => [
            systemDiskName(disk),
            disk,
        ])
    );

export const FLOPPY_DISKS_BY_NAME: {[name: string]: SystemDiskDef} =
    Object.fromEntries(FLOPPY_DISKS.map(disk => [systemDiskName(disk), disk]));

export function systemDiskName(disk: SystemDiskDef) {
    return (
        disk.displayName +
        (disk.displaySubtitle ? " - " + disk.displaySubtitle : "")
    );
}

export const NOTABLE_DISKS: SystemDiskDef[] = [];
export const NEXT_DISKS: (SystemDiskDef | PlaceholderDiskDef)[] = [];

export const DISKS_BY_YEAR: {
    [year: number]: (SystemDiskDef | PlaceholderDiskDef)[];
} = {};
export const NOTABLE_DISKS_BY_YEAR: {
    [year: number]: (SystemDiskDef | PlaceholderDiskDef)[];
} = {};
export const NEXT_DISKS_BY_YEAR: {
    [year: number]: (SystemDiskDef | PlaceholderDiskDef)[];
} = {};

ALL_DISKS.forEach(disk => {
    const [year] = disk.releaseDate;
    if (!DISKS_BY_YEAR[year]) {
        DISKS_BY_YEAR[year] = [];
    }
    DISKS_BY_YEAR[year].push(disk);
    if ("notable" in disk && disk.notable) {
        NOTABLE_DISKS.push(disk);
        if (!NOTABLE_DISKS_BY_YEAR[year]) {
            NOTABLE_DISKS_BY_YEAR[year] = [];
        }
        NOTABLE_DISKS_BY_YEAR[year].push(disk);
    }
    if (disk.machines.some(m => m.platform === "NeXT")) {
        NEXT_DISKS.push(disk);
        if (!NEXT_DISKS_BY_YEAR[year]) {
            NEXT_DISKS_BY_YEAR[year] = [];
        }
        NEXT_DISKS_BY_YEAR[year].push(disk);
    }
});

export const INFINITE_HD: EmulatorDiskDef = {
    prefetchChunks: [0, 3692, 3696, 3697, 3698],
    generatedSpec: () => import("./Data/Infinite HD.dsk.json"),
};

export const INFINITE_HD6: EmulatorDiskDef = {
    prefetchChunks: [0, 2271, 2274, 2275],
    generatedSpec: () => import("./Data/Infinite HD6.dsk.json"),
};

export const INFINITE_HD_MFS: EmulatorDiskDef = {
    prefetchChunks: [0, 1, 2],
    generatedSpec: () => import("./Data/Infinite HD (MFS).dsk.json"),
};

export const SAVED_HD: EmulatorDiskDef = {
    prefetchChunks: [0],
    generatedSpec: () => import("./Data/Saved HD.dsk.json"),
    persistent: true,
};
