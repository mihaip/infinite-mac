import {type AppearanceVariant, type Appearance} from "./controls/Appearance";
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
    NEXT_STATION,
    NEXT_STATION_TURBO_COLOR,
    POWER_MACINTOSH_G3_BEIGE,
    POWER_MACINTOSH_7500,
    POWER_MACINTOSH_G3_BW_DPPC,
    POWER_MACINTOSH_G4_PEARPC,
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
    // If true, the disk already has a device image header (with a partition
    // map) and does not need one appended for emulators that need it.
    hasDeviceImageHeader?: boolean;
    // Additional files that need to be loaded into the emulator's file system
    // booting from this disk. Map from machine to a map of file names to file
    // URLs.
    extraMachineFiles?: Map<MachineDef, {[fileName: string]: string}>;
};

export type SystemDiskDef = EmulatorDiskDef & {
    displayName: string;
    displaySubtitle?: string;
    releaseDate: [year: number, month: number, date: number];
    customDate?: Date;
    description: string;
    preferredMachine: MachineDef;
    appleTalkSupported?: boolean;
    infiniteHdSubset?: "mfs" | "system6" | "macosx";
    delayAdditionalDiskMount?: boolean;
    appearance?: Appearance;
    appearanceVariant?: AppearanceVariant;
    isUnstable?: boolean;
    notable?: boolean;
    hiddenInBrowser?: boolean;
};

export type DiskFile = {
    file: File;
    treatAsCDROM: boolean;
    hasDeviceImageHeader?: boolean;
};

export type PlaceholderDiskDef = {
    type: "placeholder";
    displayName: string;
    displaySubtitle?: string;
    releaseDate: [year: number, month: number, date: number];
    description: string;
    preferredMachine: MachineDef;
    appearance?: Appearance;
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
    preferredMachine: MAC_128K,
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
    preferredMachine: MAC_128K,
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
    preferredMachine: MAC_128K,
    infiniteHdSubset: "mfs",
    generatedSpec: () => import("./Data/System 1.1.dsk.json"),
};

const SYSTEM_2_0: SystemDiskDef = {
    displayName: "System 2.0",
    description:
        "Introduced the ”New Folder” and ”Shut Down” commands, the MiniFinder, and the Choose Printer DA. Also added icons to list view and the Command-Shift-3 screenshot FKEY.",
    releaseDate: [1985, 4, 8],
    prefetchChunks: [0, 1],
    preferredMachine: MAC_128K,
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
    preferredMachine: MAC_512KE,
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
    preferredMachine: MAC_PLUS,
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
    preferredMachine: MAC_PLUS,
};

const SYSTEM_3_2: SystemDiskDef = {
    displayName: "System 3.2",
    description:
        "Includes redesigned Calculator and Chooser desktop accessories.",
    releaseDate: [1986, 6, 2],
    prefetchChunks: [0, 1, 2],
    preferredMachine: MAC_PLUS,
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 3.2.dsk.json"),
};

const SYSTEM_3_3: SystemDiskDef = {
    displayName: "System 3.3",
    description:
        "Enhanced AppleShare file serving support. The Trash can icon now bulges when it's not empty.",
    releaseDate: [1987, 1, 12],
    prefetchChunks: [0, 1, 2],
    preferredMachine: MAC_PLUS,
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 3.3.dsk.json"),
};

const SYSTEM_4_0: SystemDiskDef = {
    displayName: "System 4.0",
    description:
        "Added the Find File desktop accessory and the Restart command. Features a redesigned control panel. Released with the Mac SE.",
    releaseDate: [1987, 3, 2],
    prefetchChunks: [0, 1, 2],
    preferredMachine: MAC_SE,
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 4.0.dsk.json"),
};

const SYSTEM_4_1: SystemDiskDef = {
    displayName: "System 4.1",
    description:
        "Added Easy Access accessibility features. Improved compatibility with larger hard drives. Released with the Mac II.",
    releaseDate: [1987, 4, 14],
    prefetchChunks: [0, 1, 2],
    preferredMachine: MAC_II,
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 4.1.dsk.json"),
};

const SYSTEM_5_0: SystemDiskDef = {
    displayName: "System 5.0",
    description:
        "Introduced the MultiFinder, revised the Finder about box, and improved printing support.",
    releaseDate: [1987, 10, 8],
    prefetchChunks: [0, 1, 2],
    preferredMachine: MAC_SE,
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 5.0 HD.dsk.json"),
    notable: true,
};

const SYSTEM_5_1: SystemDiskDef = {
    displayName: "System 5.1",
    description: "Updated the LaserWriter Driver and Apple HD SC Setup.",
    releaseDate: [1987, 12, 1],
    prefetchChunks: [0, 1, 2],
    preferredMachine: MAC_SE,
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 5.1 HD.dsk.json"),
};

const SYSTEM_6_0: SystemDiskDef = {
    displayName: "System 6.0",
    description: "Added MacroMaker, Map and CloseView utilities.",
    releaseDate: [1988, 4, 30],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    preferredMachine: MAC_SE,
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 6.0 HD.dsk.json"),
    notable: true,
};

const SYSTEM_6_0_1: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "System 6.0.1",
    description: "Released with the Mac IIx, buggy and short-lived.",
    releaseDate: [1988, 9, 19],
    preferredMachine: MAC_SE,
};

const SYSTEM_6_0_2: SystemDiskDef = {
    displayName: "System 6.0.2",
    description: "Updated LaserWriter and other printing-related utilites.",
    releaseDate: [1988, 9, 19],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    preferredMachine: MAC_SE,
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 6.0.2 HD.dsk.json"),
};

const SYSTEM_6_0_3: SystemDiskDef = {
    displayName: "System 6.0.3",
    description: "Added support for the Mac IIcx and SE/30.",
    releaseDate: [1989, 3, 7],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    preferredMachine: MAC_SE,
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 6.0.3 HD.dsk.json"),
};

const SYSTEM_6_0_4: SystemDiskDef = {
    displayName: "System 6.0.4",
    description:
        "Added support for the Mac IIci and Portable. Improved the installer. Holding down the option key when double-clicking in the Finder closes the parent window.",
    releaseDate: [1989, 9, 20],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    preferredMachine: MAC_SE,
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 6.0.4 HD.dsk.json"),
};

const SYSTEM_6_0_5: SystemDiskDef = {
    displayName: "System 6.0.5",
    description:
        "Bundled 32-bit QuickDraw (previously a separate package). Added support for the Mac IIfx.",
    releaseDate: [1990, 3, 19],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    preferredMachine: MAC_SE,
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 6.0.5 HD.dsk.json"),
    notable: true,
};

const SYSTEM_6_0_6: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "System 6.0.6.",
    releaseDate: [1990, 10, 15], // Official release date is not known.
    description: "Never officially released due to an AppleTalk bug.",
    preferredMachine: MAC_SE,
};

const SYSTEM_6_0_7: SystemDiskDef = {
    displayName: "System 6.0.7",
    description:
        "First release to ship on 1440K disks. Added support for the Classic, LC and IIsi.",
    releaseDate: [1990, 10, 15],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    preferredMachine: MAC_SE,
    infiniteHdSubset: "system6",
    generatedSpec: () => import("./Data/System 6.0.7 HD.dsk.json"),
};

const SYSTEM_6_0_8: SystemDiskDef = {
    displayName: "System 6.0.8",
    description:
        "Final release of System 6, updated printing software to match the printing software of System 7.",
    releaseDate: [1991, 4, 17],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    preferredMachine: MAC_SE,
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
    preferredMachine: MAC_IIFX,
    appleTalkSupported: true,
    appearanceVariant: "System7",
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
    preferredMachine: QUADRA_650,
    appleTalkSupported: true,
    appearanceVariant: "System7",
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
    preferredMachine: QUADRA_650,
    appleTalkSupported: true,
    appearanceVariant: "System7",
    generatedSpec: () => import("./Data/System 7.1.1 HD.dsk.json"),
};

const SYSTEM_7_1_2: SystemDiskDef = {
    displayName: "System 7.1.2",
    description:
        "Initial system software for the first Power Macintosh computers.",
    releaseDate: [1994, 3, 14],
    prefetchChunks: [0, 1, 2],
    preferredMachine: POWER_MACINTOSH_6100,
    appearanceVariant: "System7",
    isUnstable: true,
    generatedSpec: () => import("./Data/System 7.1.2 HD.dsk.json"),
};

const SYSTEM_7_1_2_DISK_TOOLS: SystemDiskDef = {
    displayName: "System 7.1.2 Disk Tools",
    description:
        "Disk Tools startup disk from the floppy disk version of System 7.1.2.",
    releaseDate: [1994, 3, 14],
    prefetchChunks: [0],
    preferredMachine: POWER_MACINTOSH_6100,
    appearanceVariant: "System7",
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
    preferredMachine: QUADRA_650,
    appleTalkSupported: true,
    appearanceVariant: "System7",
    generatedSpec: () => import("./Data/System 7.5 HD.dsk.json"),
    notable: true,
};

const SYSTEM_7_5_DISK_TOOLS: SystemDiskDef = {
    displayName: "System 7.5 Disk Tools",
    description:
        "Disk Tools startup disk from the floppy disk version of System 7.5.",
    releaseDate: [1994, 9, 12],
    prefetchChunks: [0],
    preferredMachine: POWER_MACINTOSH_6100,
    appearanceVariant: "System7",
    generatedSpec: () => import("./Data/System 7.5 Disk Tools FD.dsk.json"),
    isFloppy: true,
};

const SYSTEM_7_5_1: SystemDiskDef = {
    displayName: "System 7.5.1",
    description:
        "Bug fixes and small tweaks. Sartup screen now now features the Mac OS logo.",
    releaseDate: [1995, 3, 23],
    prefetchChunks: [
        0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23,
        27, 28, 29, 31, 32, 33, 34, 35, 39, 41, 48, 50, 51, 54, 55, 57, 58, 59,
        64, 65, 66, 67, 68, 69, 70, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89,
        90, 91, 92, 93, 94,
    ],
    preferredMachine: QUADRA_650,
    appleTalkSupported: true,
    appearanceVariant: "System7",
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
    preferredMachine: POWER_MACINTOSH_7500,
    appleTalkSupported: true,
    appearanceVariant: "System7",
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
    preferredMachine: QUADRA_650,
    appearanceVariant: "System7",
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
    preferredMachine: POWER_MACINTOSH_9500,
    appearanceVariant: "System7",
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
    preferredMachine: QUADRA_650,
    appearanceVariant: "System7",
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
    preferredMachine: QUADRA_650,
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
    preferredMachine: QUADRA_650,
    appleTalkSupported: true,
    appearanceVariant: "System7",
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
    preferredMachine: QUADRA_650,
    appleTalkSupported: true,
    appearanceVariant: "System7",
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
    preferredMachine: QUADRA_650,
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
    preferredMachine: QUADRA_650,
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
    preferredMachine: QUADRA_650,
    generatedSpec: () => import("./Data/Mac OS 8.1 Disk Tools 68K FD.dsk.json"),
    isFloppy: true,
};

const MAC_OS_8_1_DISK_TOOLS_PPC: SystemDiskDef = {
    displayName: "Mac OS 8.1 Disk Tools (PPC)",
    description:
        "Disk Tools startup disk from the floppy disk version of Mac OS 8.1.",
    releaseDate: [1998, 1, 19],
    prefetchChunks: [0],
    preferredMachine: POWER_MACINTOSH_9500,
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
    preferredMachine: POWER_MACINTOSH_9500,
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
    preferredMachine: POWER_MACINTOSH_9500,
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
    preferredMachine: POWER_MACINTOSH_G3_BW,
    appearance: "Platinum",
    generatedSpec: () => import("./Data/Mac OS 9.0 HD.dsk.json"),
    notable: true,
};

const MAC_OS_9_0_1: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "Mac OS 9.0.1",
    description: "Under development but never released.",
    releaseDate: [2000, 1, 1], // Planned release date unknown
    preferredMachine: POWER_MACINTOSH_G3_BW,
};

const MAC_OS_9_0_2: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "Mac OS 9.0.2",
    description: "Released with the PowerBook G3 (FireWire) only.",
    releaseDate: [2000, 2, 16],
    preferredMachine: POWER_MACINTOSH_G3_BW,
};

const MAC_OS_9_0_3: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "Mac OS 9.0.3",
    description: "Released with iMacs only.",
    releaseDate: [2000, 3, 1], // Exact date unknown
    preferredMachine: POWER_MACINTOSH_G3_BW,
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
    preferredMachine: POWER_MACINTOSH_G3_BW,
    appearance: "Platinum",
    generatedSpec: () => import("./Data/Mac OS 9.0.4 HD.dsk.json"),
};

const MAC_OS_9_1: SystemDiskDef = {
    displayName: "Mac OS 9.1",
    description:
        "Integrated Disc Burning within Finder and added a “Window” menu. First version supported under “Classic” on Mac OS X.",
    releaseDate: [2001, 1, 9],
    prefetchChunks: [
        0, 4, 5, 6, 8, 9, 10, 12, 13, 15, 17, 18, 19, 20, 21, 22, 28, 29, 30,
        31, 32, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 52,
        54, 55, 63, 64, 65, 66, 67, 68, 69, 70, 71, 74, 75, 80, 82, 83, 87, 88,
        89, 93, 95, 96, 98, 99, 100, 102, 103, 114, 115, 117, 118, 119, 120,
        121, 122, 123, 124, 125, 126, 128, 129, 132, 134, 135, 136, 137, 138,
        139, 165, 166, 167, 169, 170, 171, 172, 173, 185, 186, 187, 190, 191,
        192, 194, 195, 196, 200, 201, 202, 203, 204, 205, 206, 207, 212, 214,
        219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232,
        233, 235, 236, 238, 239, 240, 241, 242, 245, 246, 250, 258, 259, 260,
        262, 263, 274, 275, 276, 278, 279, 280, 281, 294, 295, 296, 297, 307,
        308, 309, 310, 311, 312, 314, 315, 316, 319, 329, 330, 331, 334, 335,
        336, 337, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 379,
        440, 441, 443, 444, 445, 446, 447, 448, 449, 450, 451, 452, 453, 454,
        455, 456, 457, 458, 459, 460, 463, 464, 465, 473, 474, 475, 476, 477,
        478, 479, 480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491,
        492, 493, 494, 495, 496, 500, 501, 503, 504, 517, 638, 639, 640, 641,
        642, 643, 644, 645, 646, 647, 648, 655, 656, 661, 816, 817, 818, 819,
        856, 859, 860, 861, 868, 869, 891, 910, 911, 912, 913, 914, 915, 916,
        918, 919, 920, 921, 922, 923, 924, 925, 926, 927, 928, 929, 930, 931,
        932, 933, 937, 938, 943, 944, 945, 946, 947, 948, 949, 950, 951, 952,
        953, 954, 955, 956, 957, 958, 959, 960, 961, 962, 963, 964, 965, 966,
        967, 968, 969, 970, 971, 972, 973, 974, 977, 978, 979, 980, 984, 985,
        986, 987, 988, 989, 990,
    ],
    preferredMachine: POWER_MACINTOSH_G3_BEIGE,
    appearance: "Platinum",
    generatedSpec: () => import("./Data/Mac OS 9.1 HD.dsk.json"),
    isUnstable: true,
};

const MAC_OS_9_2: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "Mac OS 9.2",
    description:
        "Improved performance. Only distributed with mid-2001 G4 (QuickSilver) Power Macs.",
    releaseDate: [2001, 7, 18],
    preferredMachine: POWER_MACINTOSH_G3_BEIGE,
};

const MAC_OS_9_2_1: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "Mac OS 9.2.1",
    description: "Improved Classic application compatibility under Mac OS X.",
    releaseDate: [2001, 8, 21],
    preferredMachine: POWER_MACINTOSH_G3_BEIGE,
};

const MAC_OS_9_2_2: SystemDiskDef = {
    displayName: "Mac OS 9.2.2",
    description:
        "Final Mac OS 9 release. Bug fixes for the Classic environment under Mac OS X.",
    releaseDate: [2001, 12, 5],
    prefetchChunks: [
        0, 4, 5, 6, 8, 9, 10, 15, 16, 17, 18, 19, 20, 29, 31, 32, 34, 36, 37,
        38, 45, 46, 47, 48, 49, 51, 53, 54, 56, 57, 58, 59, 60, 62, 63, 64, 65,
        68, 70, 71, 72, 80, 81, 82, 84, 85, 86, 90, 91, 96, 98, 99, 104, 105,
        109, 112, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125,
        127, 128, 139, 140, 142, 143, 144, 145, 146, 149, 151, 152, 153, 154,
        155, 158, 160, 161, 162, 165, 167, 168, 169, 170, 171, 172, 173, 175,
        178, 183, 184, 186, 187, 188, 189, 191, 203, 204, 205, 209, 210, 212,
        213, 214, 218, 219, 220, 221, 222, 223, 224, 225, 230, 232, 238, 239,
        240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 254,
        255, 257, 258, 259, 260, 261, 266, 267, 279, 280, 281, 282, 283, 295,
        296, 297, 299, 300, 301, 302, 314, 316, 317, 318, 328, 329, 330, 337,
        340, 351, 352, 355, 356, 358, 359, 363, 364, 365, 369, 370, 371, 372,
        373, 374, 375, 376, 377, 378, 379, 397, 398, 456, 457, 458, 459, 460,
        461, 462, 463, 464, 465, 466, 467, 468, 469, 470, 471, 472, 473, 474,
        475, 476, 477, 478, 479, 480, 481, 482, 483, 498, 500, 501, 502, 503,
        504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 517, 518,
        519, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 532, 533, 551,
        553, 554, 556, 647, 651, 656, 776, 777, 778, 779, 780, 781, 782, 783,
        784, 785, 786, 787, 794, 795, 799, 800, 958, 959, 960, 961, 998, 1001,
        1002, 1003, 1010, 1033, 1052, 1053, 1054, 1055, 1056, 1057, 1059, 1114,
        1117, 1118, 1119, 1120, 1124, 1126, 1127, 1128, 1129, 1130, 1131, 1132,
        1133, 1134, 1135, 1136, 1137, 1138, 1140, 1142, 1145, 1146, 1147, 1148,
        1152, 1153, 1154, 1155, 1156, 1157, 1158, 1159, 1160, 1161, 1162, 1163,
        1164, 1165, 1166, 1167, 1168, 1169, 1170, 1171, 1172, 1173, 1174, 1175,
        1176, 1177, 1178, 1179, 1180, 1181, 1182, 1183, 1185, 1186, 1187, 1197,
        1198, 1199,
    ],
    preferredMachine: POWER_MACINTOSH_G3_BEIGE,
    appearance: "Platinum",
    generatedSpec: () => import("./Data/Mac OS 9.2.2 HD.dsk.json"),
    isUnstable: true,
};

import powerMacintoshG3NvramPath from "./Data/Power-Macintosh-G3-nvram.bin?url";
import powerMacintoshG3PramPath from "./Data/Power-Macintosh-G3-pram.bin?url";
import powerMacintoshG3BWNvramPath from "./Data/Power-Macintosh-G3-BW-nvram.bin?url";
import powerMacintoshG3BWPramPath from "./Data/Power-Macintosh-G3-BW-pram.bin?url";
const dppcExtraMachineFiles = new Map([
    [
        POWER_MACINTOSH_G3_BEIGE,
        {
            "nvram.bin": powerMacintoshG3NvramPath,
            "pram.bin": powerMacintoshG3PramPath,
        },
    ],
    [
        POWER_MACINTOSH_G3_BW_DPPC,
        {
            "nvram.bin": powerMacintoshG3BWNvramPath,
            "pram.bin": powerMacintoshG3BWPramPath,
        },
    ],
]);

const MAC_OS_X_10_0_PUBLIC_BETA: SystemDiskDef = {
    displayName: "Mac OS X 10.0",
    displaySubtitle: "Public Beta",
    description:
        "First public release of Mac OS X, allowing software developers and early adopters to test a preview of the upcoming next-generation operating system.",
    releaseDate: [2000, 9, 13],
    customDate: new Date(2000, 8, 13), // Avoid time-bomb
    prefetchChunks: [
        0, 2, 3, 4, 17, 18, 19, 20, 21, 22, 24, 28, 29, 45, 46, 800, 801, 802,
        803, 804, 805, 806, 807, 808, 809, 810, 811, 812, 813, 814, 815, 816,
        818,
    ],
    preferredMachine: POWER_MACINTOSH_G3_BEIGE,
    appearance: "Aqua",
    generatedSpec: () =>
        import("./Data/Mac OS X 10.0 (Public Beta) HD.dsk.json"),
    extraMachineFiles: dppcExtraMachineFiles,
    notable: true,
    infiniteHdSubset: "macosx",
    isUnstable: true,
    hasDeviceImageHeader: true,
};

const MAC_OS_X_10_0_4: SystemDiskDef = {
    displayName: "Mac OS X 10.0",
    description:
        "Successor to classic Mac OS based on NeXTSTEP. Featured the Aqua interface, Quartz graphics system, the Dock, access to the UNIX command line, Mail and other built-in applications.",
    releaseDate: [2001, 3, 24],
    prefetchChunks: [
        0, 1, 2, 3, 4, 5, 21, 22, 23, 24, 25, 26, 27, 28, 29, 32, 34, 35, 36,
        48, 63, 64, 68, 70, 72, 73, 75, 85, 136, 137, 491, 492, 497, 498, 501,
        503, 504, 505, 506, 507, 508, 509, 518, 519, 521, 522, 523, 524, 528,
        529, 530, 532, 533, 534, 537, 542, 543, 544, 545, 547, 553, 554, 555,
        557, 558, 571, 580, 581, 582, 583, 610, 613, 614, 641, 644, 645, 672,
        673, 676, 698, 701, 702, 724, 727, 741, 742, 743, 775, 792, 978, 998,
        1047, 1067, 1085, 1092, 1098, 1099, 1122, 1123, 1280, 1281, 1282, 1283,
        1284, 1285, 1286, 1287, 1288, 1289, 1290, 1291, 1292, 1293, 1294, 1295,
        1296, 1297, 1300, 3602, 3603, 3604, 3605, 3606, 3607, 3608, 3609, 3610,
        3611, 3742, 3743, 3745, 4497, 5801, 5802, 5803, 5804, 5805, 5806, 5807,
        5808, 5809, 5810, 5811, 5812, 5813, 5814, 5815, 5816, 5817, 5832, 5833,
        5834, 5835, 5836, 5837, 5838, 5839, 5840, 5841, 5842, 5843, 5844, 5845,
        5846, 5847, 5848, 5849, 5850, 5851, 5852, 5853, 5854, 5855, 5856, 5857,
        5858, 5859, 5864, 5873, 5940, 5952, 6006, 6007, 6008, 6009, 6010, 6011,
        6024, 6025, 6026, 6034, 6035, 6037, 6042, 6043, 6044, 6045, 6050, 6066,
        6071, 6073, 6074, 6075, 6081, 6085, 6090, 6091, 6093, 6095, 6105, 6128,
        6134, 6136, 6146, 6147, 6148, 6149, 6160, 6161, 6162, 6163, 6164, 6165,
        6166, 6179, 6180, 6181, 6182, 6191, 6192, 6193, 6194, 6195, 6202, 6203,
        6206, 6208, 6209, 6211, 6212, 6213, 6221, 6222, 6223, 6224, 6230, 6233,
        6235, 6241, 6242, 6244, 6245, 6248, 6249, 6250, 6251, 6252, 6254, 6255,
        6256, 6257, 6258, 6261, 6262, 6267, 6268, 6271, 6272, 6275, 6276, 6278,
        6279, 6283, 6779, 9146, 9147, 9148, 9149, 16383,
    ],
    preferredMachine: POWER_MACINTOSH_G3_BEIGE,
    appearance: "Aqua",
    generatedSpec: () => import("./Data/Mac OS X 10.0.4 HD.dsk.json"),
    extraMachineFiles: dppcExtraMachineFiles,
    notable: true,
    infiniteHdSubset: "macosx",
    isUnstable: true,
    hasDeviceImageHeader: true,
};

const MAC_OS_X_10_1_5: SystemDiskDef = {
    displayName: "Mac OS X 10.1",
    description:
        "Added performance enhancements, CD and DVD burning, DVD playback support, Image Capture and Menu Extras.",
    releaseDate: [2001, 9, 29],
    prefetchChunks: [
        0, 2, 3, 4, 5, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
        31, 32, 33, 34, 35, 36, 37, 39, 40, 41, 42, 43, 44, 45, 46, 48, 49, 50,
        51, 52, 53, 54, 55, 56, 57, 58, 59, 61, 62, 63, 64, 65, 66, 67, 68, 69,
        70, 71, 73, 74, 75, 77, 78, 102, 107, 112, 116, 117, 119, 120, 121, 316,
        322, 334, 339, 348, 349, 357, 358, 359, 360, 362, 363, 364, 365, 366,
        367, 380, 382, 383, 385, 388, 389, 396, 399, 403, 404, 408, 409, 412,
        419, 423, 428, 429, 431, 434, 436, 497, 498, 526, 527, 540, 541, 542,
        623, 648, 653, 660, 661, 662, 663, 664, 665, 681, 685, 695, 696, 795,
        796, 799, 803, 804, 805, 807, 820, 821, 822, 823, 824, 826, 827, 828,
        829, 831, 836, 837, 838, 839, 842, 848, 849, 851, 852, 853, 855, 856,
        857, 858, 872, 873, 877, 886, 887, 892, 893, 894, 900, 901, 919, 934,
        943, 953, 954, 975, 976, 977, 978, 979, 988, 998, 999, 1020, 1021, 1025,
        1073, 1074, 1203, 1204, 1206, 1238, 1276, 1281, 1282, 1285, 1300, 1301,
        1302, 1307, 1313, 1314, 1318, 1319, 1320, 1324, 1394, 1395, 1396, 1401,
        1403, 1404, 1405, 1409, 1410, 1411, 1412, 1414, 1422, 1423, 1434, 1442,
        1446, 1449, 1450, 1451, 1456, 1458, 1464, 1465, 1466, 1467, 1468, 1470,
        1476, 1477, 1486, 1488, 1509, 1510, 1515, 1523, 1524, 1530, 1531, 1722,
        1723, 1758, 1759, 1868, 1874, 1890, 1891, 1894, 1897, 1910, 1911, 1953,
        1961, 1963, 1964, 1966, 2015, 2016, 2034, 2039, 2093, 2094, 2108, 2110,
        2112, 2113, 2114, 2115, 2121, 2122, 2126, 2128, 2312, 2313, 2319, 2320,
        2327, 2328, 2345, 2349, 2352, 2354, 2355, 2356, 2357, 2374, 2380, 2382,
        2383, 2384, 2385, 2389, 2391, 2396, 2498, 2543, 2544, 2545, 2546, 2547,
        2548, 2549, 2551, 2563, 2605, 2606, 2607, 2608, 2672, 2673, 2681, 2693,
        2699, 2700, 2713, 2715, 2749, 2751, 3090, 3116, 3136, 3151, 3152, 3153,
        3160, 3162, 3254, 3267, 3573, 3598, 3727, 3728, 3730, 3731, 3732, 3756,
        3759, 4410, 4411, 4412, 4413, 4414, 4415, 4416, 4417, 4418, 4419, 4420,
        4421, 4422, 4423, 4426, 4427, 4428, 4429, 4430, 4446, 4452, 4453, 4462,
        4463, 4464, 4466, 4469, 4470, 4471, 4472, 4473, 4474, 4475, 4476, 4477,
        4478, 4479, 4480, 4481, 4485, 4489, 4492, 4493, 4494, 4495, 4496, 4497,
        4498, 4499, 4500, 4502, 4503, 4504, 4522, 4523, 4534, 4538, 4543, 4544,
        4545, 4549, 4550, 4561, 4562, 4571, 4572, 4573, 4574, 4575, 4576, 4577,
        4578, 4579, 4580, 4581, 4582, 4601, 4602, 4603, 4604, 4605, 4606, 4607,
        4608, 4609, 4610, 4611, 4612, 4613, 4614, 4615, 4616, 4617, 4618, 4619,
        4620, 4621, 4622, 4623, 4629, 4632, 4637, 4640, 4645, 4647, 4655, 4667,
        4675, 4680, 4681, 4683, 4684, 4685, 4700, 4706, 4707, 4708, 4709, 4713,
        4714, 4715, 4716, 4720, 4721, 4722, 4724, 4767, 4768, 4770, 4771, 4772,
        4773, 4774, 4775, 4776, 4777, 4778, 4779, 4780, 4781, 4782, 4783, 4809,
        4810, 4811, 4815, 4832, 4834, 4835, 4836, 4837, 4838, 4839, 4840, 4841,
        4842, 4843, 4844, 4845, 4846, 5265, 5267, 5275, 5280, 5282, 5291, 5294,
        5312, 5313, 5314, 5315, 5316, 5319, 5322, 5323, 5332, 5334, 5342, 5346,
        5347, 5363, 5364, 5365, 5366, 5367, 5374, 5375, 5376, 5386, 5387, 5389,
        5390, 5391, 5392, 5393, 5394, 5395, 5401, 5402, 5403, 5404, 5405, 5406,
        5408, 5409, 5410, 5411, 5412, 5413, 5414, 5415, 5416, 5417, 5418, 5419,
        5420, 5421, 5422, 5423, 5424, 5425, 5426, 5427, 5428, 5429, 5430, 5431,
        5432, 5436, 5437, 5438, 5439, 5440, 5442, 5443, 5446, 5447, 5448, 5449,
        5451, 5452, 5453, 5454, 5455, 5457, 5458, 5459, 5460, 5461, 5462, 5463,
        5464, 5465, 5466, 5467, 5472, 5474, 5475, 5476, 5477, 5481, 5482, 5483,
        5484, 5485, 5486, 5487, 5488, 5489, 5490, 5492, 5493, 5494, 5497, 5498,
        5499, 5500, 5501, 5505, 5506, 5507, 5508, 5509, 5510, 5511, 5512, 5513,
        5514, 5515, 5516, 5517, 5518, 5519, 5520, 5521, 5522, 5523, 5524, 5525,
        5526, 5527, 5528, 5529, 5530, 5531, 5532, 5533, 5534, 5535, 5536, 5537,
        5538, 5539, 5540, 5541, 5542, 5543, 5545, 5546, 5547, 5548, 5549, 5550,
        5551, 5557, 5558, 5559, 5564, 5565, 5566, 5567, 5573, 5575, 5576, 5577,
        5578, 5579, 5583, 5598, 5599, 5604, 5605, 5606, 5608, 5609, 5610, 5614,
        5615, 5617, 5621, 5622, 5628, 5629, 5630, 5631, 5632, 5633, 5634, 5638,
        5639, 5640, 5662, 5663, 5664, 5665, 5671, 5674, 5675, 5676, 5677, 5678,
        5689, 5698, 5699, 5700, 5701, 5702, 5703, 5704, 5705, 5706, 5707, 5715,
        5716, 6027, 6052, 6053, 6055, 6066, 6068, 6069, 6070, 6074, 6076, 6077,
        6384, 6486, 6493, 6494, 6496, 6498, 6499, 6500, 6502, 6505, 6506, 6525,
        6530, 6532, 6534, 6535, 6536, 6541, 6542, 6543, 6544, 6545, 6547, 6548,
        6730, 6734, 7484, 7488, 8626, 8627, 8709, 8722, 8723, 8724, 8725, 8837,
        8961, 8964, 8969, 8988, 9296, 9604, 9605, 9606, 9607, 9912, 9913, 9914,
    ],
    preferredMachine: POWER_MACINTOSH_G3_BEIGE,
    appearance: "Aqua",
    generatedSpec: () => import("./Data/Mac OS X 10.1.5 HD.dsk.json"),
    extraMachineFiles: dppcExtraMachineFiles,
    notable: true,
    infiniteHdSubset: "macosx",
    hasDeviceImageHeader: true,
};

const MAC_OS_X_10_2_8: SystemDiskDef = {
    displayName: "Mac OS X 10.2",
    displaySubtitle: "Jaguar",
    description:
        "Introduced Quartz Extreme, Address Book, iChat, MPEG-4 support, Rendezvous, Inkwell, Sherlock 3, and Universal Access.",
    releaseDate: [2002, 8, 23],
    prefetchChunks: [
        0, 2, 3, 4, 5, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
        31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 42, 43, 44, 46, 47, 48, 49, 50,
        51, 52, 54, 55, 56, 57, 58, 59, 61, 62, 63, 64, 76, 88, 89, 90, 91, 92,
        93, 94, 95, 96, 97, 495, 499, 501, 510, 519, 520, 533, 534, 538, 541,
        542, 545, 547, 548, 549, 550, 551, 556, 557, 558, 559, 560, 561, 562,
        563, 564, 565, 566, 567, 568, 569, 574, 638, 639, 667, 668, 691, 692,
        693, 694, 695, 696, 697, 698, 699, 700, 701, 702, 774, 808, 810, 817,
        819, 821, 838, 842, 856, 858, 1005, 1006, 1011, 1016, 1017, 1019, 1020,
        1021, 1023, 1059, 1061, 1063, 1065, 1068, 1070, 1092, 1094, 1095, 1098,
        1101, 1112, 1115, 1116, 1119, 1138, 1153, 1156, 1161, 1202, 1218, 1219,
        1220, 1231, 1245, 1246, 1285, 1295, 1296, 1297, 1298, 1299, 1300, 1301,
        1310, 1361, 1364, 1365, 1366, 1367, 1368, 1371, 1372, 1373, 1397, 1398,
        1401, 1407, 1564, 1569, 1674, 1677, 1693, 1694, 1695, 1696, 1697, 1698,
        1699, 1755, 1757, 1770, 1776, 1778, 1779, 1780, 1875, 1886, 1887, 1895,
        1896, 1902, 1914, 1915, 1916, 1918, 1921, 1922, 1929, 2124, 2259, 2321,
        2326, 2329, 2330, 2340, 2433, 2434, 2541, 2556, 2600, 2601, 2607, 2617,
        2618, 2629, 2637, 2742, 2743, 2767, 2769, 2770, 2772, 2774, 2776, 2782,
        2783, 2788, 2791, 2798, 2800, 2801, 2814, 2816, 2821, 2826, 2828, 2829,
        2939, 2987, 2988, 2992, 2993, 2999, 3002, 3021, 3039, 3088, 3091, 3103,
        3116, 3121, 3124, 3125, 3129, 3227, 3304, 3305, 3346, 3349, 3843, 4165,
        4166, 4169, 4171, 4174, 4175, 4209, 4210, 4217, 4332, 4333, 4334, 4335,
        4336, 4337, 4338, 4339, 4344, 4346, 4347, 4354, 4355, 4528, 4529, 4530,
        4531, 4990, 4991, 5072, 5073, 5074, 5075, 5076, 5077, 5120, 5425, 5777,
        5778, 5779, 5780, 5781, 5782, 5784, 5785, 5786, 5790, 5812, 5814, 5822,
        5823, 5828, 5864, 5865, 5866, 5867, 5868, 5869, 5870, 5871, 5872, 5873,
        5874, 5875, 5876, 5877, 5878, 5879, 5882, 5883, 5884, 5887, 5888, 5899,
        5901, 5903, 5907, 5911, 5913, 5914, 5924, 5925, 5926, 5927, 5928, 5929,
        5930, 5931, 5932, 5933, 5934, 5935, 5938, 5939, 5940, 5977, 5981, 5994,
        5995, 6005, 6010, 6011, 6012, 6013, 6014, 6015, 6016, 6017, 6018, 6019,
        6029, 6030, 6055, 6060, 6061, 6062, 6065, 6081, 6090, 6091, 6093, 6094,
        6095, 6096, 6097, 6098, 6099, 6100, 6101, 6102, 6103, 6104, 6105, 6106,
        6107, 6153, 6170, 6172, 6173, 6174, 6175, 6177, 6178, 6179, 6180, 6181,
        6182, 6183, 6188, 6189, 6197, 6198, 6221, 6222, 6223, 6224, 6229, 6230,
        6231, 6232, 6233, 6235, 6236, 6237, 6244, 6245, 6246, 6249, 6250, 6251,
        6253, 6254, 6255, 6256, 6263, 6292, 6297, 6299, 6300, 6310, 6311, 6312,
        6318, 6323, 6331, 6334, 6338, 6353, 6359, 6360, 6361, 6362, 6363, 6372,
        6374, 6376, 6380, 6426, 6431, 6447, 6449, 6451, 6458, 6459, 6461, 6463,
        6464, 6465, 6466, 6467, 6497, 6511, 6514, 6573, 6577, 6578, 6587, 6588,
        6589, 6590, 6591, 6592, 6595, 6596, 6597, 6599, 6601, 6603, 6604, 6607,
        6608, 6611, 6612, 6616, 6617, 6618, 6619, 6620, 6621, 6626, 6627, 6629,
        6630, 6631, 6632, 6633, 6634, 6635, 6636, 6637, 6638, 6639, 6641, 6642,
        6643, 6644, 6646, 6689, 6690, 6697, 6732, 6733, 6734, 6735, 6736, 6737,
        6738, 6739, 6740, 6741, 6742, 6743, 6744, 6745, 6746, 6747, 6779, 6782,
        6783, 6809, 6810, 6811, 6812, 6813, 6814, 6815, 6816, 6817, 6818, 6819,
        6820, 6821, 6822, 6823, 6824, 6825, 6826, 6827, 6829, 6830, 6831, 6832,
        6833, 6834, 6836, 6837, 6838, 6839, 6840, 6842, 6843, 6846, 6847, 6855,
        6856, 6857, 6859, 6860, 6870, 6875, 6877, 6878, 6880, 6881, 6882, 6883,
        6884, 6885, 6925, 6929, 6930, 6931, 6959, 6960, 6961, 6981, 6982, 6983,
        6993, 6994, 6995, 7000, 7001, 7057, 7058, 7059, 7060, 7061, 7063, 7064,
        7065, 7188, 7189, 7190, 7191, 7192, 7193, 7194, 7195, 7196, 7197, 7198,
        7199, 7201, 7225, 7403, 7404, 7405, 7406, 7407, 7408, 7409, 7410, 7411,
        7412, 7413, 7414, 7415, 7416, 7417, 7418, 7419, 7420, 7430, 7431, 7432,
        7433, 7437, 7441, 7444, 7445, 7450, 7451, 7453, 7454, 7455, 7461, 7463,
        7464, 7467, 7472, 7474, 7477, 7479, 7480, 7481, 7482, 7483, 7484, 7485,
        7486, 7492, 7511, 7512, 7513, 7514, 7557, 7558, 7559, 7560, 7562, 7563,
        7566, 7567, 7585, 7586, 7587, 7589, 7590, 7591, 7592, 7593, 7594, 7595,
        7596, 7597, 7598, 7599, 7601, 7602, 7603, 7604, 7605, 7606, 7607, 7609,
        7610, 7611, 7612, 7613, 7614, 7615, 7616, 7619, 7620, 7621, 7663, 7664,
        7665, 7666, 7667, 7668, 7669, 7670, 7671, 7672, 7673, 7674, 7675, 7676,
        7677, 7678, 7679, 7680, 7681, 7682, 7683, 7684, 7688, 7692, 7693, 7694,
        7697, 7698, 7699, 7700, 7701, 7702, 7703, 7706, 7707, 7708, 7711, 7712,
        7719, 7722, 7723, 7724, 7726, 7727, 7728, 7729, 7730, 7731, 7733, 7740,
        7741, 7742, 7743, 7744, 7745, 7746, 7748, 7749, 7750, 7751, 7752, 7756,
        7757, 7758, 7759, 7760, 7761, 7762, 7763, 7764, 7765, 7768, 7771, 7773,
        7779, 7780, 8085, 8086, 8089, 8090, 8091, 8092, 8093, 8094, 8108, 8109,
        8740, 16383,
    ],
    preferredMachine: POWER_MACINTOSH_G4_PEARPC,
    appearance: "Aqua",
    generatedSpec: () => import("./Data/Mac OS X 10.2.8 HD.dsk.json"),
    extraMachineFiles: dppcExtraMachineFiles,
    notable: true,
    infiniteHdSubset: "macosx",
    isUnstable: true,
    hasDeviceImageHeader: true,
};

const MAC_OS_X_10_3_9: SystemDiskDef = {
    displayName: "Mac OS X 10.3",
    displaySubtitle: "Panther",
    description:
        "Introduced an updated Finder with a brushed metal interface, Exposé, fast user switching, Font Book, iChat AV, FileVault, and Xcode.",
    releaseDate: [2003, 10, 24],
    prefetchChunks: [
        0, 1, 2, 3, 515, 516, 517, 518, 519, 520, 521, 522, 523, 524, 525, 526,
        527, 528, 529, 530, 531, 532, 533, 534, 535, 536, 537, 538, 539, 540,
        541, 542, 543, 544, 545, 546, 547, 548, 549, 565, 566, 567, 568, 569,
        570, 571, 572, 573, 574, 575, 576, 577, 578, 579, 580, 581, 582, 583,
        584, 585, 586, 588, 589, 590, 591, 592, 593, 594, 595, 596, 597, 598,
        599, 600, 601, 602, 603, 604, 605, 606, 607, 608, 609, 610, 611, 612,
        613, 614, 615, 618, 619, 620, 624, 625, 626, 627, 628, 629, 631, 633,
        635, 638, 642, 650, 654, 655, 658, 659, 660, 661, 663, 664, 665, 666,
        667, 668, 672, 678, 679, 680, 681, 682, 683, 684, 685, 686, 687, 688,
        689, 690, 692, 693, 694, 695, 696, 697, 699, 700, 701, 703, 705, 706,
        713, 737, 740, 757, 763, 770, 771, 772, 773, 774, 775, 776, 777, 778,
        779, 986, 989, 1177, 1179, 1180, 1183, 1184, 1186, 1189, 1190, 1191,
        1192, 1194, 1195, 1197, 1199, 1226, 1227, 1249, 1288, 1289, 1290, 1291,
        1292, 1315, 1316, 1317, 1318, 1319, 1320, 1321, 1322, 1323, 1324, 1325,
        1326, 1327, 1362, 1363, 1396, 1447, 1455, 1461, 1462, 1491, 1500, 1510,
        1512, 1537, 1541, 1564, 1565, 1566, 1568, 1569, 1571, 1578, 1582, 1583,
        1584, 1588, 1589, 1590, 1591, 1612, 1614, 1615, 1617, 1620, 1621, 1622,
        1623, 1625, 1634, 1635, 1638, 1639, 1643, 1656, 1660, 1661, 1666, 1667,
        1670, 1673, 1688, 1692, 1693, 1695, 1696, 1703, 1713, 1715, 1718, 1731,
        1732, 1734, 1784, 1785, 1788, 1789, 1801, 1816, 1817, 1818, 1819, 1826,
        1886, 1898, 1900, 1901, 1921, 1922, 1925, 1926, 1927, 1930, 1931, 1932,
        1933, 1934, 1937, 1938, 1944, 1945, 1946, 1947, 1952, 1961, 1979, 1981,
        1991, 1992, 1993, 1994, 1995, 1996, 1997, 2007, 2008, 2009, 2010, 2012,
        2013, 2014, 2015, 2016, 2018, 2019, 2024, 2025, 2026, 2028, 2029, 2036,
        2043, 2048, 2049, 2055, 2071, 2100, 2150, 2152, 2160, 2276, 2278, 2316,
        2317, 2318, 2319, 2320, 2322, 2323, 2362, 2363, 2364, 2365, 2366, 2367,
        2368, 2386, 2395, 2396, 2397, 2409, 2410, 2411, 2412, 2413, 2414, 2415,
        2416, 2417, 2418, 2419, 2420, 2421, 2422, 2423, 2424, 2425, 2426, 2427,
        2428, 2429, 2430, 2431, 2432, 2433, 2434, 2436, 2437, 2438, 2439, 2448,
        2451, 2497, 2508, 2509, 2510, 2538, 2539, 2541, 2546, 2547, 2556, 2557,
        2558, 2564, 2571, 2578, 2608, 2609, 2613, 2614, 2615, 2616, 2617, 2620,
        2623, 2624, 2625, 2705, 2719, 2727, 2728, 2766, 2810, 2852, 2853, 2869,
        2881, 2894, 2896, 2922, 3012, 3031, 3043, 3055, 3073, 3075, 3077, 3078,
        3083, 3093, 3151, 3152, 3214, 3260, 3261, 3262, 3263, 3273, 3334, 3336,
        3348, 3351, 3367, 3369, 3375, 3376, 3377, 3391, 3437, 3459, 3460, 3462,
        3463, 3467, 3468, 3474, 3476, 3477, 3478, 3479, 3480, 3481, 3482, 3492,
        3497, 3498, 3506, 3541, 3583, 3595, 3598, 3602, 3605, 3606, 3610, 3611,
        3658, 3665, 3678, 3682, 3683, 3684, 3685, 3686, 3764, 3801, 3803, 3811,
        3822, 3840, 3881, 3882, 3883, 3887, 3904, 3905, 3932, 3936, 4216, 4217,
        4245, 4246, 4248, 4315, 4505, 4506, 4534, 4535, 4536, 4537, 4761, 5177,
        5269, 5270, 5441, 5444, 5653, 5848, 5851, 5963, 5964, 5965, 5988, 5989,
        5990, 5991, 5992, 5993, 5994, 5995, 5996, 5997, 5998, 5999, 6000, 6001,
        6002, 6003, 6004, 6005, 6006, 6007, 6008, 6009, 6010, 6052, 6065, 6066,
        6067, 6107, 6108, 6109, 6110, 6113, 6114, 6115, 6116, 6117, 6118, 6166,
        6190, 6191, 6192, 6193, 6195, 6198, 6199, 6200, 6209, 6215, 6216, 6219,
        6220, 6221, 6222, 6223, 6224, 6225, 6226, 6227, 6228, 6229, 6230, 6231,
        6232, 6236, 6237, 6239, 6256, 6257, 6260, 6261, 6262, 6263, 6264, 6266,
        6267, 6268, 6269, 6270, 6271, 6272, 6273, 6274, 6339, 6340, 6341, 6342,
        6343, 6344, 6345, 6346, 6347, 6348, 6349, 6350, 6351, 6352, 6353, 6354,
        6355, 6356, 6357, 6358, 6359, 6360, 6361, 6362, 6363, 6364, 6365, 6366,
        6367, 6368, 6369, 6370, 6371, 6372, 6373, 6374, 6375, 6533, 6535, 6536,
        6540, 6541, 6556, 6557, 6558, 6559, 6560, 6561, 6562, 6563, 6564, 6565,
        6566, 6706, 6915, 7140, 7717, 7751, 7804, 7805, 7830, 7860, 7887, 7914,
        7915, 7966, 8026, 8087, 8088, 8154, 8178, 8179, 8219, 8224, 8260, 8261,
        8278, 8279, 8325, 8345, 8369, 8375, 8415, 8436, 8437, 8438, 8441, 8465,
        8830, 8838, 8839, 8840, 8841, 8842, 8857, 8860, 8878, 8880, 8881, 8915,
        8916, 8917, 8927, 8929, 8931, 8933, 8934, 8935, 8936, 8937, 8938, 8939,
        8940, 8941, 8942, 8943, 8944, 8945, 8946, 8947, 8948, 8949, 8950, 8951,
        8952, 8954, 8955, 8956, 8957, 8958, 8959, 8961, 8962, 8963, 8964, 8965,
        8966, 8968, 8969, 8970, 8971, 8979, 8983, 8984, 8985, 8988, 8989, 8990,
        8991, 8992, 8993, 8994, 8995, 8997, 8998, 8999, 9000, 9003, 9004, 9005,
        9013, 9014, 9018, 9023, 9025, 9026, 9038, 9039, 9040, 9055, 9060, 9063,
        9076, 9080, 9081, 9086, 9099, 9100, 9109, 9111, 9112, 9113, 9115, 9116,
        9123, 9125, 9126, 9131, 9135, 9137, 9171, 9172, 9173, 9178, 9182, 9183,
        9196, 9197, 9203, 9204, 9205, 9206, 9213, 9216, 9233, 9237, 9239, 9252,
        9263, 9274, 9276, 9278, 9282, 9288, 9304, 9324, 9333, 9334, 9335, 9336,
        9353, 9354, 9362, 9364, 9365, 9366, 9367, 9369, 9370, 9377, 9378, 9379,
        9383, 9384, 9385, 9386, 9388, 9389, 9390, 9391, 9392, 9394, 9395, 9396,
        9397, 9398, 9399, 9401, 9402, 9403, 9404, 9405, 9406, 9407, 9408, 9411,
        9412, 9415, 9416, 9419, 9421, 9422, 9425, 9438, 9440, 9441, 9491, 9492,
        9493, 9522, 9558, 9567, 9568, 9573, 9574, 9575, 9582, 9587, 9595, 9596,
        9607, 9608, 9611, 9613, 9614, 9629, 9633, 9657, 9658, 9727, 9729, 9732,
        9736, 9756, 9760, 9764, 9776, 9790, 9794, 9796, 9807, 9813, 9814, 9816,
        9818, 9822, 9826, 9830, 9839, 9843, 9864, 9868, 9870, 9871, 9930, 9932,
        9933, 9934, 9936, 9939, 9946, 9948, 9956, 9962, 9963, 9968, 9987, 9997,
        9998, 9999, 10010, 10013, 10014, 10015, 10016, 10017, 10021, 10044,
        10090, 10147, 10152, 10165, 10166, 10168, 10169, 10170, 10171, 10172,
        10173, 10174, 10175, 10176, 10177, 10178, 10179, 10180, 10181, 10182,
        10183, 10184, 10185, 10186, 10187, 10190, 10207, 10208, 10209, 10210,
        10211, 10212, 10213, 10214, 10216, 10217, 10218, 10219, 10220, 10221,
        10222, 10223, 10224, 10225, 10226, 10227, 10231, 10232, 10233, 10245,
        10246, 10258, 10266, 10277, 10295, 10296, 10298, 10299, 10300, 10307,
        10309, 10310, 10314, 10315, 10320, 10322, 10330, 10331, 10336, 10337,
        10343, 10347, 10348, 10349, 10354, 10356, 10375, 10376, 10377, 10378,
        10379, 10380, 10387, 10388, 10389, 10390, 10391, 10395, 10397, 10398,
        10399, 10402, 10403, 10411, 10412, 10419, 10422, 10423, 10424, 10425,
        10426, 10427, 10428, 10429, 10432, 10433, 10436, 10438, 10452, 10453,
        10454, 10456, 10507, 10508, 10509, 10510, 10511, 10512, 10518, 10519,
        10522, 10523, 10525, 10526, 10527, 10536, 10549, 10550, 10551, 10554,
        10555, 10559, 10561, 10562, 10608, 10609, 10610, 10611, 10612, 10613,
        10614, 10615, 10616, 10617, 10618, 10619, 10620, 10621, 10622, 10623,
        10624, 10625, 10626, 10627, 10628, 10629, 10633, 10634, 10635, 10636,
        10638, 10639, 10640, 10641, 10644, 10645, 10646, 10647, 10648, 10649,
        10650, 10651, 10652, 10653, 10656, 10657, 10658, 10659, 10660, 10668,
        10677, 10678, 10679, 10680, 10682, 10683, 10684, 10685, 10686, 10687,
        10688, 10689, 10691, 10692, 10693, 10694, 10695, 10696, 10697, 10698,
        10699, 10700, 10701, 10702, 10703, 10704, 10705, 10706, 10707, 10708,
        10712, 10713, 10714, 10715, 10716, 10718, 10719, 10720, 10721, 10722,
        10724, 10725, 10726, 10727, 10728, 10729, 10730, 10731, 10733, 10752,
        10753, 10754, 10755, 10756, 10757, 10758, 10759, 10760, 10761, 10764,
        10765, 10773, 10774, 10775, 10776, 10777, 10778, 10779, 10780, 10784,
        10785, 10786, 10787, 10788, 10798, 10800, 10801, 10802, 10803, 10804,
        10805, 10806, 10807, 10808, 10809, 10810, 10814, 10815, 10816, 10835,
        10836, 10837, 10839, 10840, 10841, 10842, 10843, 10847, 10848, 10849,
        10850, 10851, 10852, 10853, 10854, 10855, 10856, 10857, 10858, 10859,
        10860, 10861, 10862, 10864, 10865, 10893, 10894, 10895, 10896, 10974,
        10975, 10976, 10977, 10978, 10979, 10980, 10981, 10982, 10983, 10985,
        10986, 10987, 10988, 10989, 10990, 10991, 10992, 10993, 10994, 10995,
        10996, 10999, 11000, 11003, 11004, 11005, 11008, 11009, 11011, 11012,
        11013, 11014, 11016, 11017, 11021, 11027, 11029, 11030, 11031, 11034,
        11035, 11040, 11041, 11044, 11055, 11056, 11057, 11058, 11059, 11060,
        11061, 11066, 11067, 11075, 11081, 11082, 11083, 11084, 11085, 11086,
        11156, 11157, 11158, 11159, 11160, 11175, 11176, 11180, 11181, 11230,
        11232, 11233, 11234, 11235, 11236, 11237, 11238, 11239, 11299, 11350,
        11351, 11376, 11377, 11378, 11379, 11380, 11381, 11382, 11383, 11384,
        11385, 11386, 11387, 11388, 11389, 11455, 11714, 11715, 11725, 11731,
        11732, 11764, 1638,
    ],
    preferredMachine: POWER_MACINTOSH_G4_PEARPC,
    appearance: "Aqua",
    generatedSpec: () => import("./Data/Mac OS X 10.3.9 HD.dsk.json"),
    extraMachineFiles: dppcExtraMachineFiles,
    notable: true,
    infiniteHdSubset: "macosx",
    hasDeviceImageHeader: true,
};

const MAC_OS_X_10_4_11: SystemDiskDef = {
    displayName: "Mac OS X 10.4",
    displaySubtitle: "Tiger",
    description:
        "Introduced Spotlight, Dashboard, a “unified” appearance, Safari RSS, Automator, VoiceOver, QuickTime 7 and an updated Mail application.",
    releaseDate: [2005, 4, 29],
    prefetchChunks: [
        0, 1, 2, 3, 515, 517, 518, 519, 520, 521, 522, 523, 524, 525, 526, 527,
        528, 529, 530, 531, 532, 533, 534, 535, 536, 537, 538, 539, 540, 541,
        542, 543, 544, 545, 546, 547, 548, 549, 550, 566, 568, 569, 570, 571,
        572, 573, 574, 575, 576, 577, 578, 579, 580, 581, 582, 583, 584, 585,
        586, 587, 588, 589, 590, 591, 592, 593, 594, 595, 596, 597, 598, 599,
        600, 601, 602, 603, 604, 605, 606, 607, 609, 611, 612, 614, 615, 616,
        618, 619, 622, 625, 627, 629, 631, 633, 635, 636, 637, 638, 646, 647,
        669, 670, 680, 681, 683, 687, 688, 691, 692, 693, 694, 696, 697, 699,
        700, 711, 712, 714, 715, 716, 718, 719, 720, 721, 722, 728, 729, 730,
        731, 732, 733, 738, 742, 743, 745, 746, 747, 749, 753, 754, 755, 761,
        764, 767, 788, 1239, 1240, 1241, 1242, 1243, 1244, 1278, 1279, 1284,
        1301, 1302, 1304, 1305, 1306, 1308, 1311, 1313, 1332, 1333, 1334, 1352,
        1353, 1377, 1382, 1384, 1450, 1451, 1453, 1454, 1467, 1468, 1469, 1470,
        1471, 1472, 1473, 1474, 1475, 1485, 1486, 1488, 1489, 1510, 1515, 1516,
        1517, 1519, 1520, 1788, 1833, 1854, 1856, 1882, 1887, 1912, 1915, 1916,
        1919, 1931, 1932, 1934, 1941, 1946, 1947, 1952, 1953, 1954, 1956, 1979,
        1980, 1981, 2009, 2030, 2032, 2038, 2040, 2050, 2053, 2055, 2062, 2063,
        2064, 2067, 2070, 2075, 2088, 2090, 2091, 2094, 2097, 2101, 2102, 2103,
        2108, 2110, 2127, 2129, 2136, 2159, 2171, 2229, 2245, 2294, 2295, 2318,
        2320, 2321, 2322, 2323, 2324, 2325, 2341, 2350, 2355, 2356, 2397, 2438,
        2439, 2442, 2448, 2449, 2450, 2451, 2455, 2456, 2495, 2517, 2518, 2519,
        2520, 2523, 2524, 2525, 2526, 2539, 2541, 2557, 2580, 2581, 2582, 2583,
        2584, 2585, 2586, 2590, 2591, 2595, 2596, 2597, 2598, 2603, 2604, 2605,
        2607, 2608, 2616, 2617, 2626, 2627, 2630, 2631, 2632, 2633, 2640, 2647,
        2649, 2650, 2654, 2655, 2658, 2660, 2674, 2675, 2677, 2688, 2690, 2691,
        2752, 2938, 2939, 2973, 2974, 2978, 2980, 2982, 2983, 2984, 2985, 2986,
        2988, 2989, 2991, 2998, 3027, 3028, 3031, 3032, 3034, 3036, 3045, 3047,
        3065, 3066, 3067, 3068, 3070, 3071, 3126, 3127, 3144, 3146, 3221, 3222,
        3233, 3243, 3245, 3246, 3247, 3248, 3260, 3261, 3262, 3263, 3268, 3269,
        3270, 3279, 3280, 3287, 3288, 3289, 3290, 3293, 3303, 3311, 3358, 3360,
        3361, 3362, 3366, 3367, 3368, 3369, 3371, 3372, 3373, 3376, 3378, 3626,
        3627, 3632, 3633, 3653, 3676, 3783, 3784, 3796, 3798, 3799, 3802, 3803,
        3804, 3889, 3901, 4068, 4072, 4076, 4078, 4092, 4121, 4122, 4136, 4140,
        4142, 4149, 4150, 4168, 4172, 4190, 4191, 4192, 4293, 4296, 4302, 4305,
        4306, 4311, 4323, 4329, 4336, 4342, 4380, 4381, 4390, 4391, 4392, 4393,
        4396, 4400, 4403, 4406, 4407, 4408, 4451, 4465, 4478, 4480, 4481, 4486,
        4487, 4488, 4489, 4497, 4500, 4501, 4502, 4604, 4613, 4641, 4658, 4662,
        4665, 4669, 4676, 4684, 4695, 4702, 4711, 4856, 4961, 4964, 5006, 5012,
        5016, 5051, 5093, 5099, 5103, 5540, 5558, 5635, 5767, 5770, 5924, 6388,
        6389, 6424, 6708, 6748, 6749, 6750, 6797, 6798, 6799, 6800, 6801, 7609,
        7613, 8160, 8191, 9355, 9445, 9446, 9962, 10035, 10036, 10151, 10152,
        10527, 10528, 10529, 10530, 10531, 10532, 10533, 10534, 10555, 10557,
        10560, 10561, 10562, 10565, 10566, 10567, 10568, 10571, 10572, 10573,
        10574, 10575, 10576, 10577, 10578, 10579, 10580, 10581, 10582, 10583,
        10584, 10585, 10586, 10588, 10590, 10603, 10605, 10644, 10645, 10646,
        10704, 10705, 10706, 10716, 10717, 10718, 10720, 10730, 10731, 10732,
        10733, 10734, 10735, 10736, 10739, 10740, 10741, 10742, 10743, 10744,
        10745, 10746, 10747, 10748, 10749, 10751, 10752, 10753, 10754, 10755,
        10756, 10757, 10761, 10762, 10766, 10767, 10771, 10772, 10773, 10789,
        10790, 10791, 10794, 10795, 10796, 10797, 10798, 10799, 10800, 10801,
        10829, 10863, 10864, 10872, 10873, 10874, 10875, 10879, 10880, 10881,
        10883, 10884, 10885, 10906, 10907, 10909, 10910, 10914, 10915, 10917,
        10918, 10923, 10924, 10944, 10949, 10950, 10962, 10963, 10969, 11158,
        11159, 11166, 11169, 11170, 11171, 11176, 11177, 11178, 11179, 11181,
        11182, 11185, 11214, 11215, 11265, 11266, 11268, 11301, 11365, 11410,
        11538, 11539, 11576, 11581, 11582, 11583, 13812, 14027, 14028, 14050,
        14056, 14057, 14058, 14062, 14065, 14071, 14075, 14076, 14077, 14078,
        14079, 14081, 14082, 14087, 14089, 14113, 14137, 14138, 14139, 14140,
        14144, 14145, 14146, 14190, 14191, 14193, 14195, 14198, 14199, 14200,
        14201, 14202, 14203, 14204, 14205, 14206, 14207, 14208, 14209, 14210,
        14211, 14212, 14213, 14214, 14215, 14216, 14217, 14218, 14219, 14220,
        14221, 14222, 14223, 14224, 14225, 14228, 14229, 14230, 14231, 14232,
        14233, 14234, 14235, 14236, 14237, 14238, 14245, 14246, 14248, 14249,
        14250, 14251, 14253, 14254, 14255, 14256, 14257, 14270, 14271, 14280,
        14302, 14303, 14307, 14308, 14309, 14324, 14326, 14331, 14344, 14345,
        14350, 14354, 14357, 14368, 14386, 14391, 14394, 14398, 14399, 14402,
        14407, 14408, 14409, 14411, 14412, 14414, 14424, 14490, 14491, 14492,
        14493, 14494, 14495, 14501, 14503, 14529, 14530, 14531, 14532, 14533,
        14534, 14539, 14552, 14557, 14558, 14559, 14560, 14561, 14562, 14563,
        14564, 14565, 14566, 14567, 14569, 14571, 14572, 14573, 14593, 14612,
        14616, 14617, 14635, 14639, 14641, 14653, 14665, 14678, 14680, 14682,
        14684, 14691, 14703, 14721, 14722, 14723, 14724, 14729, 14730, 14731,
        14732, 14736, 14737, 14738, 14742, 14749, 14750, 14755, 14758, 14761,
        14762, 14766, 14785, 14789, 14790, 14791, 14792, 14793, 14794, 14800,
        14823, 14824, 14825, 14826, 14827, 14828, 14829, 14832, 14833, 14841,
        14842, 14843, 14844, 14845, 14846, 14847, 14848, 14849, 14850, 14851,
        14852, 14853, 14854, 14855, 14856, 14858, 14859, 14860, 14861, 14862,
        14863, 14864, 14867, 14868, 14869, 14870, 14871, 14872, 14873, 14877,
        14878, 14879, 14880, 14881, 14883, 14898, 14905, 14906, 14908, 14909,
        14910, 14911, 14912, 14984, 14988, 14992, 14998, 15005, 15066, 15077,
        15080, 15083, 15084, 15085, 15089, 15106, 15107, 15108, 15109, 15140,
        15141, 15142, 15143, 15145, 15153, 15161, 15162, 15166, 15172, 15173,
        15183, 15184, 15200, 15202, 15205, 15217, 15219, 15221, 15224, 15225,
        15249, 15250, 15290, 15291, 15294, 15340, 15341, 15346, 15347, 15351,
        15363, 15366, 15374, 15380, 15384, 15388, 15390, 15524, 15528, 15538,
        15550, 15551, 15552, 15553, 15555, 15573, 15574, 15593, 15599, 15610,
        15611, 15612, 15613, 15619, 15624, 15637, 15753, 15758, 15773, 15779,
        15823, 15824, 15826, 15827, 15828, 15870, 15871, 15873, 15874, 15875,
        15876, 15877, 15878, 15879, 15880, 15881, 15882, 15883, 15884, 15885,
        15891, 15894, 15898, 15928, 15954, 15955, 15956, 15964, 15965, 15966,
        15967, 15970, 15971, 15979, 15980, 15981, 15985, 15986, 16000, 16002,
        16003, 16090, 16091, 16092, 16093, 16094, 16095, 16096, 16098, 16099,
        16102, 16104, 16107, 16110, 16113, 16121, 16208, 16210, 16211, 16212,
        16213, 16214, 16215, 16216, 16217, 16218, 16219, 16220, 16221, 16222,
        16223, 16224, 16225, 16226, 16227, 16228, 16229, 16230, 16523, 16524,
        16525, 16526, 16527, 16528, 16529, 16530, 16531, 16532, 16540, 16541,
        16542, 16543, 16544, 16545, 16546, 16547, 16548, 16549, 16550, 16551,
        16552, 16553, 16558, 16559, 16560, 16561, 16562, 16563, 16564, 16565,
        16566, 16567, 16568, 16569, 16570, 16571, 16572, 16573, 16574, 16575,
        16576, 16577, 16578, 16579, 16582, 16583, 16584, 16585, 16587, 16588,
        16590, 16591, 16592, 16593, 16594, 16595, 16596, 16597, 16598, 16600,
        16601, 16603, 16604, 16606, 16607, 16608, 16610, 16611, 16612, 16613,
        16614, 16615, 16617, 16618, 16619, 16620, 16629, 16630, 16631, 16632,
        16633, 16634, 16636, 16637, 16638, 16639, 16640, 16641, 16642, 16643,
        16644, 16645, 16646, 16649, 16650, 16658, 16659, 16660, 16661, 16662,
        16663, 16664, 16665, 16666, 16667, 16668, 16669, 16670, 16671, 16672,
        16673, 16676, 16677, 16678, 16679, 16680, 16681, 16682, 16683, 16684,
        16687, 16688, 16689, 16690, 16691, 16692, 16693, 16694, 16695, 16696,
        16699, 16700, 16701, 16702, 16703, 16704, 16705, 16709, 16714, 16715,
        16719, 16720, 16721, 16722, 16723, 16724, 16725, 16726, 16730, 16731,
        16732, 16733, 16734, 16735, 16736, 16737, 16738, 16739, 16755, 16756,
        16757, 16761, 16762, 16763, 16764, 16765, 16766, 16767, 16768, 16769,
        16770, 16771, 16772, 16773, 16774, 16776, 16777, 16778, 16788, 16810,
        16837, 16849, 16865, 16867, 16868, 16870, 16906, 16907, 16908, 16909,
        16910, 16911, 16912, 16914, 16915, 16916, 16917, 16921, 16922, 16925,
        16926, 16927, 16931, 16932, 16933, 16934, 16936, 16957, 16958, 16960,
        16961, 16962, 16963, 16964, 16965, 16966, 16967, 16968, 16969, 16970,
        16974, 16977, 16981, 16982, 16983, 16984, 16985, 16986, 16994, 16995,
        17015, 17020, 17021, 17033, 17034, 17036, 17038, 17039, 17040, 17041,
        17042, 17043, 17044, 17045, 17051, 17053, 17054, 17057, 17059, 17063,
        17066, 17067, 17068, 17073, 17074, 17075, 17076, 17078, 17079, 17082,
        17111, 17112, 17155, 17157, 17166, 17167, 17231, 17275, 17388, 17389,
        17397, 17689, 17690, 17691, 17692, 17693, 17694, 17695, 17696, 17697,
        17699, 17700, 17958, 17959, 17963, 17990, 18086, 18128, 18134, 18135,
        18488, 18509, 18511, 19398, 20028, 20096, 20099, 20162, 20327, 20395,
        20396, 20397, 20428, 20429, 20430, 20442, 20587, 20588, 20589, 20590,
        20591, 20592, 20593, 20594, 20595, 20596, 20597, 20598, 20599, 20600,
        20601, 20602, 20603, 20604, 20605, 21389, 21485, 21528, 21534, 21535,
        21899, 22786, 23414, 23415, 24575,
    ],
    preferredMachine: POWER_MACINTOSH_G4_PEARPC,
    appearance: "Aqua",
    generatedSpec: () => import("./Data/Mac OS X 10.4.11 HD.dsk.json"),
    extraMachineFiles: dppcExtraMachineFiles,
    notable: true,
    infiniteHdSubset: "macosx",
    isUnstable: true,
    hasDeviceImageHeader: true,
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
    preferredMachine: NEXT_COMPUTER,
    appearance: "NeXT",
    generatedSpec: () => import("./Data/NeXTStep 0.8 HD.dsk.json"),
    notable: true,
};

const NEXTSTEP_0_9: SystemDiskDef = {
    displayName: "NeXTStep 0.9",
    description:
        "Introduces the Preferences application, a window resize control, indicator in the dock of running apps, and other UI polish. Bundles FrameMaker, Mathematica and additional demo apps.",
    releaseDate: [1989, 5, 1],
    prefetchChunks: [
        0, 1, 2, 3, 9, 10, 11, 12, 13, 14, 16, 17, 435, 436, 437, 438, 442, 443,
        444, 445, 446, 450, 451, 452, 458, 459, 460, 461, 462, 464, 465, 466,
        467, 468, 474, 475, 489, 490, 491, 495, 496, 497, 498, 513, 514, 520,
        521, 528, 536, 543, 544, 551, 552, 553, 554, 559, 560, 575, 576, 599,
        691, 753, 754, 776, 784, 807, 808, 815, 816, 822, 823, 824, 830, 831,
        832, 833, 834, 837, 838, 839, 840, 841, 846, 854, 855, 856, 884, 885,
        886, 900, 901, 1001, 1002, 1003, 1133, 1134, 1148, 1149, 1150, 1151,
        1152, 1156, 1157, 1158, 1159, 1160, 1163, 1164, 1165, 1166, 1188, 1189,
        1242, 1244, 1257, 1258, 1287, 1289, 1311, 1318, 1326, 1327, 1334, 1335,
        1342, 1343, 1351, 1354, 1355, 1356, 1357, 1358, 1359, 1360, 1361, 1362,
        1363, 1364, 1365, 1366, 1367, 1371, 1372, 1373, 1374, 1377, 1388, 1389,
        1390, 1391, 1423, 1424, 1427, 1428, 1652, 1659, 1660, 1667, 1668, 1683,
        1684, 1690, 1691, 1692, 1698, 1699, 1700, 1706, 1707, 1714, 1715, 1721,
        1722, 1723, 1729, 1731, 1745, 1746, 1752, 1753, 1760, 1761, 1776, 1783,
        1784, 1800, 1892, 1893, 1907, 1908, 1910, 2109, 3070, 3071, 3079, 3080,
        3081, 3082, 3087, 3088, 3089, 3093, 3094, 3095, 3098, 3099, 3100, 3233,
        3234, 3241, 3807,
    ],
    preferredMachine: NEXT_COMPUTER,
    appearance: "NeXT",
    generatedSpec: () => import("./Data/NeXTStep 0.9 HD.dsk.json"),
};

const NEXTSTEP_1_0: SystemDiskDef = {
    displayName: "NeXTStep 1.0",
    description:
        "Includes the ability to kill applications from Workspace Manager, a redesigned Preferences application with additional features and other polish.",
    releaseDate: [1989, 9, 11],
    prefetchChunks: [
        0, 1, 2, 9, 10, 11, 12, 13, 14, 15, 16, 17, 125, 141, 142, 143, 144,
        149, 156, 158, 159, 160, 162, 164, 166, 168, 334, 336, 342, 343, 344,
        350, 351, 352, 365, 367, 373, 381, 382, 383, 384, 386, 387, 388, 389,
        391, 392, 393, 397, 398, 401, 402, 403, 404, 405, 406, 412, 413, 414,
        427, 428, 435, 436, 443, 444, 450, 451, 452, 474, 475, 489, 491, 512,
        513, 520, 521, 536, 543, 544, 551, 552, 576, 590, 591, 598, 599, 615,
        714, 715, 723, 724, 725, 726, 731, 732, 736, 737, 738, 739, 740, 743,
        744, 745, 746, 747, 748, 749, 750, 753, 754, 784, 838, 839, 900, 901,
        902, 903, 915, 916, 924, 931, 932, 939, 940, 941, 942, 943, 946, 947,
        948, 954, 955, 962, 963, 970, 971, 1016, 1017, 1024, 1026, 1032, 1035,
        1039, 1041, 1042, 1047, 1048, 1055, 1056, 1194, 1196, 1202, 1203, 1204,
        1241, 1264, 1265, 1304, 1307, 1583, 1587, 1589, 1594, 1791, 1792, 1800,
        1808, 1822, 1824, 1825, 1826, 1827, 1828, 1830, 1831, 1832, 1838, 1839,
        1845, 1846, 1847, 1853, 1854, 1855, 1861, 1862, 1863, 1870, 1876, 1877,
        1878, 1884, 1885, 1886, 1892, 1893, 1895, 1900, 1907, 1908, 1915, 1916,
        1928, 1954, 1955, 2481, 2482, 2483, 2489, 2490, 3318, 3319, 3807,
    ],
    preferredMachine: NEXT_COMPUTER,
    appearance: "NeXT",
    generatedSpec: () => import("./Data/NeXTStep 1.0 HD.dsk.json"),
    notable: true,
};

const NEXTSTEP_1_0a: SystemDiskDef = {
    displayName: "NeXTStep 1.0a",
    description: "Bugfix release.",
    releaseDate: [1989, 12, 21],
    prefetchChunks: [
        0, 1, 2, 3, 4, 5, 6, 7, 9, 24, 25, 156, 164, 172, 174, 175, 179, 180,
        182, 184, 185, 186, 188, 357, 359, 365, 367, 373, 389, 390, 391, 392,
        394, 395, 396, 397, 399, 400, 401, 404, 405, 406, 409, 410, 411, 412,
        413, 414, 420, 421, 422, 435, 436, 443, 444, 450, 452, 458, 459, 460,
        481, 483, 497, 520, 521, 528, 543, 544, 551, 552, 559, 560, 598, 599,
        621, 722, 723, 731, 732, 733, 734, 738, 739, 742, 743, 745, 746, 747,
        748, 751, 752, 753, 754, 755, 756, 757, 758, 761, 776, 777, 778, 779,
        791, 792, 847, 848, 924, 932, 940, 946, 947, 948, 949, 950, 954, 955,
        956, 962, 970, 971, 977, 978, 979, 1032, 1039, 1040, 1041, 1047, 1049,
        1055, 1063, 1070, 1071, 1204, 1210, 1211, 1256, 1257, 1272, 1273, 1312,
        1314, 1591, 1595, 1597, 1602, 1800, 1808, 1816, 1830, 1831, 1832, 1833,
        1834, 1835, 1836, 1839, 1840, 1845, 1846, 1847, 1853, 1855, 1861, 1862,
        1863, 1869, 1870, 1871, 1877, 1884, 1885, 1886, 1892, 1893, 1900, 1901,
        1903, 1907, 1908, 1915, 1916, 1923, 1924, 1935, 1963, 2489, 2490, 2496,
        2497, 2498, 2504, 2505, 3807,
    ],
    preferredMachine: NEXT_COMPUTER,
    appearance: "NeXT",
    generatedSpec: () => import("./Data/NeXTStep 1.0a HD.dsk.json"),
};

const NEXTSTEP_2_0: SystemDiskDef = {
    displayName: "NeXTStep 2.0",
    description:
        "Added support for the NeXTstation and NeXTCube and associated hardware (floppy disks, CD-ROM drives). Also included a revamped Workspace Manager with the Recycler replacing the black hole and an improved browser.",
    releaseDate: [1990, 9, 18],
    prefetchChunks: [
        0, 1, 2, 3, 4, 5, 16, 64, 65, 864, 865, 866, 867, 868, 869, 870, 871,
        872, 897, 900, 901, 902, 903, 912, 913, 929, 960, 961, 976, 977, 993,
        1008, 1009, 1010, 1056, 1088, 1089, 1136, 1137, 1152, 1153, 1184, 1185,
        1200, 1201, 1216, 1217, 1296, 1344, 1345, 1472, 1473, 1552, 1568, 1569,
        1570, 1571, 1584, 1590, 1591, 1592, 1594, 1600, 1601, 1602, 1603, 1604,
        1605, 1606, 1616, 1617, 1632, 1633, 1648, 1649, 1651, 1652, 1665, 1680,
        1681, 1682, 1683, 1685, 1697, 1700, 1703, 1713, 1714, 1745, 1746, 1760,
        1761, 1762, 1763, 1765, 1766, 1767, 1770, 1776, 1777, 1778, 1779, 1780,
        1781, 1792, 1793, 1794, 1795, 1796, 1797, 1824, 1826, 1840, 1856, 1858,
        1872, 1874, 1904, 1905, 1906, 1920, 1921, 1922, 1969, 2016, 2033, 2192,
        2193, 2256, 2257, 2272, 2273, 2288, 2289, 2291, 2688, 2689, 2690, 3745,
        3749, 3760, 3761, 3766, 3770, 3792, 3793, 3808, 3809, 3824, 3825, 3840,
        3856, 3872, 3888, 3937, 3984, 3985, 4001, 4032, 4033, 4624, 5825, 5873,
        7665,
    ],
    preferredMachine: NEXT_STATION,
    appearance: "NeXT",
    generatedSpec: () => import("./Data/NeXTStep 2.0 HD.dsk.json"),
    notable: true,
};

const NEXTSTEP_2_1: SystemDiskDef = {
    displayName: "NeXTStep 2.1",
    description:
        "Added support for the NeXTdimension board and improved internationalization support.",
    releaseDate: [1991, 3, 25],
    prefetchChunks: [
        0, 1, 2, 3, 4, 5, 6, 7, 32, 64, 65, 96, 97, 128, 129, 160, 161, 288,
        289, 320, 322, 705, 834, 835, 1184, 1185, 1504, 1505, 1506, 1536, 1539,
        1540, 1760, 1761, 1762, 1763, 1764, 1765, 1766, 1767, 1768, 1769, 1770,
        1825, 1828, 1829, 1830, 1831, 1857, 1858, 1889, 1890, 1920, 1921, 1954,
        1986, 1987, 2016, 2018, 2048, 2049, 2050, 2144, 2145, 2208, 2209, 2304,
        2305, 2336, 2337, 2400, 2402, 2432, 2434, 2435, 2464, 2466, 2624, 2625,
        2626, 2720, 2721, 2976, 2978, 3136, 3137, 3168, 3169, 3170, 3172, 3201,
        3206, 3207, 3209, 3215, 3218, 3232, 3233, 3234, 3235, 3236, 3264, 3265,
        3296, 3297, 3329, 3330, 3331, 3361, 3362, 3363, 3424, 3425, 3426, 3427,
        3428, 3458, 3459, 3460, 3490, 3491, 3520, 3521, 3522, 3523, 3524, 3553,
        3554, 3555, 3556, 3557, 3584, 3585, 3648, 3649, 3650, 3651, 3652, 3653,
        3654, 3712, 3714, 3776, 3778, 3809, 3840, 3841, 3905, 3936, 3937, 3938,
        3939, 3940, 3941, 3942, 3943, 3944, 3947, 3968, 3969, 3970, 4064, 4225,
        4544, 4546, 4672, 4673, 4704, 4705, 4706, 4708, 4737, 4865, 4867, 4896,
        4897, 4928, 4929, 4930, 4962, 5120, 5216, 5217, 5248, 5249, 5280, 5281,
        5282, 5312, 5313, 5536, 5537, 5538, 5761, 7618, 7620, 7649, 7650, 7654,
        7657,
    ],
    preferredMachine: NEXT_STATION,
    appearance: "NeXT",
    generatedSpec: () => import("./Data/NeXTStep 2.1 HD.dsk.json"),
};

const NEXTSTEP_2_2: SystemDiskDef = {
    displayName: "NeXTStep 2.2",
    description: "Added support for the NeXTstation Turbo.",
    releaseDate: [1992, 3, 25],
    prefetchChunks: [
        0, 1, 2, 3, 4, 5, 6, 32, 64, 65, 768, 769, 962, 992, 994, 1024, 1056,
        1057, 1089, 1184, 1185, 1216, 1217, 1248, 1249, 1280, 1281, 1664, 1665,
        1666, 1667, 1669, 1670, 1671, 1672, 1673, 1674, 1728, 1729, 1730, 1731,
        1732, 1733, 1761, 1792, 1793, 1856, 1858, 1888, 1890, 1920, 1922, 1952,
        1953, 1954, 2048, 2112, 2113, 2208, 2209, 2240, 2241, 2304, 2305, 2336,
        2337, 2368, 2369, 2370, 2528, 2530, 2560, 2624, 2625, 2880, 2882, 3040,
        3042, 3072, 3073, 3074, 3076, 3104, 3105, 3106, 3107, 3109, 3110, 3136,
        3137, 3138, 3139, 3140, 3168, 3169, 3200, 3201, 3232, 3233, 3234, 3264,
        3265, 3328, 3329, 3330, 3331, 3333, 3361, 3362, 3364, 3394, 3395, 3458,
        3459, 3460, 3461, 3462, 3490, 3491, 3552, 3553, 3554, 3618, 3648, 3651,
        3713, 3715, 3744, 3745, 3746, 3776, 3777, 3778, 3779, 3780, 3781, 3782,
        3783, 3784, 3785, 3788, 3808, 3809, 3810, 3811, 3812, 3813, 3814, 3840,
        3841, 3842, 3843, 3844, 3845, 3872, 3873, 3904, 4128, 4448, 4450, 4576,
        4578, 4608, 4609, 4610, 4611, 5024, 5025, 5026, 5793, 5798, 5801, 5825,
        5829, 5920, 5921, 5952, 5954, 5984, 5985, 5986, 6016, 6018, 6048, 6050,
        6498, 6562, 6563, 6944, 6945, 7200, 7201, 7202, 7232, 7233, 7234, 7392,
        7393, 7520, 7521, 7522, 7650,
    ],
    preferredMachine: NEXT_STATION_TURBO_COLOR,
    appearance: "NeXT",
    generatedSpec: () => import("./Data/NeXTStep 2.2 HD.dsk.json"),
};

const NEXTSTEP_3_0: SystemDiskDef = {
    displayName: "NeXTStep 3.0",
    description:
        "Introduced Distributed Objects, Project Builder and several development kits. Improved compatibility with other networking and file systems.",
    releaseDate: [1992, 9, 8],
    prefetchChunks: [
        0, 1, 2, 16, 17, 18, 19, 20, 21, 22, 32, 48, 96, 97, 240, 241, 288, 289,
        290, 384, 385, 464, 465, 496, 512, 513, 514, 515, 518, 519, 528, 530,
        531, 544, 546, 547, 560, 561, 562, 563, 564, 565, 566, 567, 568, 569,
        570, 571, 572, 608, 609, 610, 611, 612, 613, 672, 673, 784, 785, 880,
        881, 960, 961, 1024, 1025, 1184, 1185, 1200, 1201, 1216, 1217, 1218,
        1409, 1410, 1411, 1412, 1472, 1473, 1520, 1521, 1536, 1584, 1616, 1617,
        1632, 1633, 1680, 1681, 1696, 1697, 1712, 1824, 1840, 1872, 1874, 2064,
        2065, 2176, 2177, 2192, 2800, 2801, 2832, 2833, 2944, 2945, 2960, 3088,
        3104, 3120, 3184, 3185, 3232, 3233, 3376, 3377, 3408, 3409, 3456, 3457,
        3760, 3761, 3840, 3841, 3888, 3889, 3936, 3937, 4064, 4065, 4080, 4081,
        4096, 4112, 4144, 4272, 4273, 4288, 4289, 4304, 4305, 4320, 4321, 4336,
        4337, 4400, 4401, 4402, 4403, 4404, 4405, 4416, 4417, 4432, 4433, 4448,
        4449, 4464, 4465, 4480, 4481, 4528, 4529, 4576, 4577, 4592, 4593, 4608,
        4609, 4624, 4625, 4640, 4641, 4642, 4656, 4672, 4673, 4704, 4705, 4720,
        4721, 4784, 4785, 4848, 4849, 4880, 4992, 4993, 5008, 5009, 5088, 5089,
        5216, 5217, 5232, 5233, 5249, 5265, 5266, 5269, 5270, 5273, 5274, 5275,
        5285, 5287, 5297, 5298, 5299, 5300, 5301, 5302, 5303, 5304, 5305, 5306,
        5307, 5308, 5309, 5310, 5314, 5315, 5329, 5330, 5345, 5346, 5360, 5361,
        5376, 5377, 5378, 5392, 5393, 5394, 5395, 5396, 5440, 5441, 5442, 5443,
        5696, 5697, 5698, 5712, 5713, 5728, 5729, 5745, 5746, 5760, 5761, 5762,
        5776, 5777, 5808, 5809, 5810, 5811, 5812, 5813, 5814, 5815, 5816, 6048,
        6049, 6304, 6305, 6320, 6321, 6352, 6353, 6354, 6355, 6356, 6368, 6369,
        6385, 6386, 6387, 6388, 6389, 6390, 6464, 6465, 6496, 6497, 6512, 6513,
        6592, 6593, 6672, 6720, 6721, 6864, 6865, 6880, 6881, 7040, 7041, 7056,
        7057, 7152, 7153, 7280, 7281, 7296, 7440, 7441, 7520, 7521, 7536, 7537,
        7539, 7552, 7553, 7554, 7555, 7568, 7569, 7570, 7665,
    ],
    preferredMachine: NEXT_STATION_TURBO_COLOR,
    appearance: "NeXT",
    generatedSpec: () => import("./Data/NeXTSTEP 3.0 HD.dsk.json"),
    notable: true,
};

const NEXTSTEP_3_1: SystemDiskDef = {
    displayName: "NeXTSTEP 3.1",
    description:
        "Added support for the Intel architecture and introduced Multiple Architecture Binaries.",
    releaseDate: [1993, 5, 25],
    prefetchChunks: [
        0, 1, 16, 32, 48, 64, 65, 112, 113, 144, 145, 160, 161, 162, 163, 176,
        177, 178, 192, 193, 272, 273, 320, 321, 352, 353, 496, 497, 576, 577,
        608, 720, 721, 722, 723, 724, 736, 738, 752, 754, 755, 769, 770, 771,
        772, 773, 774, 775, 776, 777, 779, 780, 781, 784, 800, 801, 802, 864,
        865, 866, 867, 868, 869, 896, 897, 928, 929, 960, 961, 992, 1120, 1121,
        1136, 1137, 1152, 1153, 1408, 1409, 1440, 1552, 1553, 1568, 1617, 1618,
        1620, 1696, 1697, 1712, 1713, 1728, 1729, 1744, 1745, 1760, 1761, 1808,
        1840, 1856, 1857, 1872, 1874, 2080, 2081, 2112, 2192, 2193, 2208, 2816,
        2817, 2848, 2880, 2881, 2960, 2961, 2976, 3104, 3120, 3136, 3137, 3200,
        3201, 3248, 3249, 3264, 3392, 3393, 3440, 3441, 3488, 3489, 3792, 3793,
        3872, 3873, 3920, 3921, 3968, 3969, 4096, 4097, 4112, 4128, 4144, 4176,
        4177, 4336, 4337, 4352, 4368, 4384, 4400, 4465, 4466, 4467, 4468, 4469,
        4470, 4481, 4496, 4497, 4512, 4513, 4528, 4529, 4576, 4577, 4624, 4640,
        4656, 4672, 4673, 4688, 4689, 4690, 4704, 4705, 4720, 4721, 4752, 4753,
        4768, 4769, 4816, 4817, 4880, 4912, 5024, 5025, 5040, 5041, 5120, 5217,
        5218, 5232, 5233, 5234, 5235, 5236, 5237, 5238, 5248, 5249, 5264, 5265,
        5280, 5281, 5313, 5315, 5317, 5318, 5322, 5324, 5344, 5345, 5346, 5347,
        5348, 5349, 5350, 5351, 5352, 5353, 5355, 5376, 5392, 5393, 5408, 5409,
        5424, 5425, 5426, 5440, 5441, 5442, 5443, 5520, 5521, 5522, 5523, 5872,
        5873, 5874, 5888, 5904, 5905, 5906, 5920, 5921, 5936, 5952, 5953, 5954,
        5955, 5956, 5957, 5958, 5959, 5960, 5961, 5968, 5969, 5984, 5985, 5986,
        6272, 6273, 6528, 6529, 6544, 6545, 6576, 6577, 6578, 6579, 6580, 6592,
        6593, 6608, 6609, 6610, 6611, 6612, 6613, 6704, 6736, 6737, 6752, 6753,
        6832, 6833, 6912, 6913, 7088, 7089, 7104, 7105, 7264, 7265, 7280, 7281,
        7376, 7377, 7504, 7505, 7506, 7520, 7521, 7665,
    ],
    preferredMachine: NEXT_STATION_TURBO_COLOR,
    appearance: "NeXT",
    generatedSpec: () => import("./Data/NeXTSTEP 3.1 HD.dsk.json"),
};

const NEXTSTEP_3_2: SystemDiskDef = {
    displayName: "NeXTSTEP 3.2",
    description:
        "New startup progress display, improved Intel hardware support.",
    releaseDate: [1993, 10, 18],
    prefetchChunks: [
        0, 1, 16, 17, 32, 48, 112, 113, 160, 161, 176, 177, 272, 273, 320, 321,
        352, 353, 368, 384, 385, 480, 481, 496, 497, 498, 512, 513, 529, 531,
        544, 545, 576, 577, 784, 785, 896, 897, 960, 961, 1056, 1057, 1058,
        1059, 1060, 1072, 1075, 1088, 1090, 1091, 1104, 1105, 1106, 1107, 1108,
        1109, 1110, 1111, 1112, 1113, 1115, 1116, 1117, 1120, 1121, 1122, 1123,
        1136, 1137, 1152, 1153, 1216, 1217, 1218, 1219, 1220, 1221, 1408, 1409,
        1552, 1553, 1568, 1696, 1697, 1712, 1713, 1728, 1856, 1857, 1872, 1873,
        1888, 1890, 2064, 2066, 2069, 2096, 2097, 2128, 2176, 2177, 2192, 2193,
        2208, 2209, 2224, 2240, 2241, 2242, 2832, 2833, 2880, 2881, 2928, 3024,
        3025, 3040, 3168, 3169, 3184, 3185, 3200, 3201, 3264, 3265, 3312, 3313,
        3456, 3457, 3536, 3537, 3584, 4064, 4065, 4144, 4145, 4192, 4193, 4368,
        4369, 4384, 4400, 4416, 4417, 4448, 4449, 4608, 4624, 4625, 4640, 4656,
        4672, 4673, 4737, 4738, 4739, 4740, 4741, 4742, 4753, 4768, 4769, 4784,
        4785, 4800, 4801, 4848, 4849, 4976, 4977, 4992, 4993, 5008, 5009, 5024,
        5025, 5040, 5041, 5056, 5057, 5072, 5073, 5104, 5105, 5120, 5168, 5232,
        5233, 5264, 5265, 5376, 5392, 5472, 5473, 5568, 5569, 5584, 5585, 5586,
        5587, 5588, 5589, 5601, 5602, 5616, 5617, 5632, 5648, 5649, 5650, 5651,
        5653, 5654, 5658, 5659, 5660, 5661, 5680, 5681, 5682, 5683, 5684, 5685,
        5686, 5687, 5688, 5691, 5712, 5713, 5728, 5729, 5745, 5760, 5761, 5762,
        5776, 5777, 5778, 5779, 5856, 5857, 5858, 5859, 6192, 6193, 6194, 6208,
        6209, 6224, 6225, 6240, 6241, 6242, 6257, 6258, 6272, 6273, 6304, 6305,
        6306, 6307, 6308, 6309, 6310, 6311, 6312, 6544, 6545, 6800, 6801, 6816,
        6817, 6848, 6849, 6850, 6851, 6852, 6864, 6865, 6880, 6881, 6882, 6883,
        6976, 6977, 7008, 7009, 7024, 7025, 7104, 7105, 7184, 7185, 7376, 7377,
        7568, 7569, 7664, 7665,
    ],
    preferredMachine: NEXT_STATION_TURBO_COLOR,
    appearance: "NeXT",
    generatedSpec: () => import("./Data/NeXTSTEP 3.2 HD.dsk.json"),
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
    preferredMachine: NEXT_STATION_TURBO_COLOR,
    appearance: "NeXT",
    generatedSpec: () => import("./Data/NeXTSTEP 3.3 HD.dsk.json"),
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
    preferredMachine: NEXT_STATION_TURBO_COLOR,
    appearance: "NeXT",
    generatedSpec: () => import("./Data/NeXTSTEP 4.0 HD.dsk.json"),
    notable: true,
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
    preferredMachine: NEXT_STATION_TURBO_COLOR,
    appearance: "NeXT",
    generatedSpec: () => import("./Data/OPENSTEP 4.0 HD.dsk.json"),
    notable: true,
};

const OPENSTEP_4_1: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "OPENSTEP 4.1",
    releaseDate: [1996, 10, 23],
    description: "Bug fix release.",
    preferredMachine: NEXT_STATION_TURBO_COLOR,
    appearance: "NeXT",
};

const OPENSTEP_4_2: SystemDiskDef = {
    displayName: "OPENSTEP 4.2",
    description: "Final OPENSTEP release, primarily with bug fixes.",
    releaseDate: [1997, 1, 24],
    prefetchChunks: [
        0, 1, 2, 3, 16, 17, 18, 19, 20, 21, 22, 23, 32, 48, 49, 65, 112, 113,
        128, 129, 144, 145, 160, 161, 162, 192, 193, 208, 209, 224, 225, 240,
        241, 256, 288, 336, 337, 385, 400, 401, 432, 433, 512, 513, 528, 529,
        560, 576, 577, 657, 672, 673, 688, 689, 690, 692, 693, 694, 704, 705,
        706, 720, 721, 736, 737, 769, 770, 784, 785, 786, 787, 788, 789, 791,
        792, 794, 795, 800, 801, 816, 817, 818, 864, 865, 880, 881, 928, 929,
        944, 945, 1024, 1025, 1026, 1056, 1057, 1168, 1169, 1185, 1264, 1265,
        1280, 1281, 1296, 1298, 1312, 1313, 1314, 1315, 1328, 1329, 1344, 1345,
        1349, 1360, 1361, 1376, 1377, 1378, 1392, 1393, 1394, 1395, 1396, 1397,
        1408, 1409, 1424, 1425, 1426, 1427, 1440, 1441, 1456, 1457, 1472, 1473,
        1488, 1489, 1520, 1521, 1552, 1568, 1569, 1570, 1616, 1617, 1648, 1649,
        1664, 1665, 1728, 1729, 1760, 1761, 1776, 1777, 1888, 1889, 1890, 1920,
        1921, 1968, 1969, 1985, 1987, 2000, 2001, 2016, 2017, 2032, 2033, 2048,
        2049, 2064, 2080, 2096, 2097, 2112, 2113, 2128, 2129, 2144, 2145, 2160,
        2161, 2176, 2177, 2192, 2193, 2208, 2209, 2256, 2257, 2272, 2273, 2288,
        2289, 2304, 2320, 2321, 2336, 2337, 2352, 2368, 2369, 2385, 2480, 2481,
        2560, 2561, 2592, 2593, 2594, 2672, 2673, 2736, 2737, 2738, 2739, 2753,
        2754, 2800, 2801, 2802, 2832, 2833, 2848, 2849, 2880, 2881, 2912, 2913,
        2929, 2930, 3072, 3088, 3089, 3104, 3105, 3106, 3216, 3217, 3218, 3312,
        3313, 3314, 3315, 3316, 3317, 3318, 3319, 3320, 3329, 3360, 3361, 3440,
        3441, 3456, 3457, 3504, 3505, 3744, 3745, 3824, 3825, 3826, 3904, 3905,
        3936, 3937, 4096, 4097, 4112, 4113, 4144, 4145, 4240, 4241, 4288, 4289,
        4384, 4385, 4497, 4499, 4502, 4512, 4513, 4516, 4522, 4523, 4529, 4530,
        4531, 4532, 4533, 4535, 4536, 4537, 4538, 4539, 4540, 4542, 4543, 4544,
        4545, 4548, 4549, 4550, 4551, 4553, 4560, 4561, 4562, 4563, 4564, 4566,
        4567, 4576, 4577, 4608, 4609, 4610, 4611, 4612, 4613, 4614, 4640, 4641,
        4656, 4657, 4658, 4659, 4660, 4661, 4662, 4663, 4664, 4665, 4666, 4667,
        4668, 4669, 4672, 4673, 4674, 4675, 4688, 4691, 4704, 4705, 4706, 4721,
        4722, 4736, 4737, 4738, 4739, 4740, 4752, 4753, 4754, 4769, 4770, 4771,
        4784, 4785, 4800, 4801, 4816, 4817, 4832, 4833, 4848, 4849, 4865, 4866,
        4867, 4868, 4869, 4870, 4871, 4872, 4880, 4896, 4897, 4898, 4912, 4914,
        4915, 4928, 4929, 4930, 4931, 4932, 4933, 4934, 4935, 4937, 4976, 4977,
        4978, 5296, 5297, 5312, 5313, 5344, 5345, 5376, 5408, 5424, 5426, 5456,
        5457, 5472, 5473, 5488, 5489, 5504, 5505, 5520, 5521, 5522, 5536, 5537,
        5712, 5713, 5792, 5793, 5808, 5809, 5856, 5857, 5872, 5873, 5952, 5953,
        5969, 6000, 6001, 6002, 6016, 6017, 6128, 6129, 6144, 6160, 6161, 6176,
        6177, 6178, 6180, 6181, 6448, 6449, 6512, 6513, 6514, 6515, 6529, 6608,
        6609, 6672, 6673, 6752, 6753, 6768, 6769, 6864, 6865, 6880, 6881, 6896,
        6897, 6912, 6928, 6929, 6960, 6961, 6976, 6977, 6992, 6993, 7008, 7009,
        7152, 7153, 7232, 7233, 7248, 7249, 7265, 7266, 7280, 7281, 7377, 7378,
        7392, 7393, 7584, 7585, 7665,
    ],
    preferredMachine: NEXT_STATION_TURBO_COLOR,
    appearance: "NeXT",
    generatedSpec: () => import("./Data/OPENSTEP 4.2 HD.dsk.json"),
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
    MAC_OS_9_1,
    MAC_OS_9_2,
    MAC_OS_9_2_1,
    MAC_OS_9_2_2,

    MAC_OS_X_10_0_PUBLIC_BETA,
    MAC_OS_X_10_0_4,
    MAC_OS_X_10_1_5,
    MAC_OS_X_10_2_8,
    MAC_OS_X_10_3_9,
    MAC_OS_X_10_4_11,

    NEXTSTEP_0_8,
    NEXTSTEP_0_9,
    NEXTSTEP_1_0,
    NEXTSTEP_1_0a,
    NEXTSTEP_2_0,
    NEXTSTEP_2_1,
    NEXTSTEP_2_2,
    NEXTSTEP_3_0,
    NEXTSTEP_3_1,
    NEXTSTEP_3_2,
    NEXTSTEP_3_3,
    NEXTSTEP_4_0,
    OPENSTEP_4_0,
    OPENSTEP_4_1,
    OPENSTEP_4_2,
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
export const MAC_OS_X_DISKS: SystemDiskDef[] = [];

export const DISKS_BY_YEAR: {
    [year: number]: (SystemDiskDef | PlaceholderDiskDef)[];
} = {};
export const NOTABLE_DISKS_BY_YEAR: {
    [year: number]: (SystemDiskDef | PlaceholderDiskDef)[];
} = {};
export const NEXT_DISKS_BY_YEAR: {
    [year: number]: (SystemDiskDef | PlaceholderDiskDef)[];
} = {};
export const MAC_OS_X_DISKS_BY_YEAR: {
    [year: number]: SystemDiskDef[];
} = {};

ALL_DISKS.forEach(disk => {
    if ("hiddenInBrowser" in disk && disk.hiddenInBrowser) {
        return;
    }
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
    if (disk.preferredMachine.platform === "NeXT") {
        NEXT_DISKS.push(disk);
        if (!NEXT_DISKS_BY_YEAR[year]) {
            NEXT_DISKS_BY_YEAR[year] = [];
        }
        NEXT_DISKS_BY_YEAR[year].push(disk);
    }
    if ("infiniteHdSubset" in disk && disk.infiniteHdSubset === "macosx") {
        MAC_OS_X_DISKS.push(disk);
        if (!MAC_OS_X_DISKS_BY_YEAR[year]) {
            MAC_OS_X_DISKS_BY_YEAR[year] = [];
        }
        MAC_OS_X_DISKS_BY_YEAR[year].push(disk);
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

export const INFINITE_HDX: EmulatorDiskDef = {
    prefetchChunks: [0, 17, 7999],
    generatedSpec: () => import("./Data/Infinite HDX.dsk.json"),
};

export const INFINITE_HD_MFS: EmulatorDiskDef = {
    prefetchChunks: [0, 1, 2],
    generatedSpec: () => import("./Data/Infinite HD (MFS).dsk.json"),
};

export const INFINITE_HD_NEXT: EmulatorDiskDef = {
    prefetchChunks: [0, 1, 2],
    generatedSpec: () => import("./Data/Infinite HD (NeXT).dsk.json"),
};

export const SAVED_HD: EmulatorDiskDef = {
    prefetchChunks: [0],
    generatedSpec: () => import("./Data/Saved HD.dsk.json"),
    persistent: true,
};
