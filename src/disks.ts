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
    POWER_MACINTOSH_G3,
    POWER_MACINTOSH_9500,
    QUADRA_650,
    POWER_MACINTOSH_6100,
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
};

export type SystemDiskDef = EmulatorDiskDef & {
    displayName: string;
    displaySubtitle?: string;
    releaseDate: [year: number, month: number, date: number];
    description: string;
    machines: MachineDef[];
    appleTalkSupported?: boolean;
    mfsOnly?: boolean;
    delayAdditionalDiskMount?: boolean;
    appearance?: Appearance;
    isUnstable?: boolean;
    notable?: boolean;
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
    mfsOnly: true,
    // Loading the Infinite HD disk as part of the initial set of images does
    // appear to work in System 1.0 under Mini vMac, but if we delay it until
    // after the system is booted, it appears to work.
    delayAdditionalDiskMount: true,
    generatedSpec: () => import("./Data/System 1.0.dsk.json"),
    notable: true,
};

const SYSTEM_1_1: SystemDiskDef = {
    displayName: "System 1.1",
    description:
        "Maintenance release that improved disk copying speeds and added the “Set Startup” command and the Finder about box.",
    releaseDate: [1984, 5, 5],
    prefetchChunks: [0, 1],
    machines: [MAC_128K],
    mfsOnly: true,
    generatedSpec: () => import("./Data/System 1.1.dsk.json"),
};

const SYSTEM_2_0: SystemDiskDef = {
    displayName: "System 2.0",
    description:
        "Introduced the ”New Folder” and ”Shut Down” commands, the MiniFinder, and the Choose Printer DA. Also added icons to list view and the Command-Shift-3 screenshot FKEY.",
    releaseDate: [1985, 4, 8],
    prefetchChunks: [0, 1],
    machines: [MAC_128K],
    mfsOnly: true,
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
    generatedSpec: () => import("./Data/System 3.2.dsk.json"),
};

const SYSTEM_3_3: SystemDiskDef = {
    displayName: "System 3.3",
    description:
        "Enhanced AppleShare file serving support. The Trash can icon now bulges when it's not empty.",
    releaseDate: [1987, 1, 12],
    prefetchChunks: [0, 1, 2],
    machines: [MAC_PLUS, MAC_512KE],
    generatedSpec: () => import("./Data/System 3.3.dsk.json"),
};

const SYSTEM_4_0: SystemDiskDef = {
    displayName: "System 4.0",
    description:
        "Added the Find File desktop accessory and the Restart command. Features a redesigned control panel. Released with the Mac SE.",
    releaseDate: [1987, 3, 2],
    prefetchChunks: [0, 1, 2],
    machines: [MAC_SE],
    generatedSpec: () => import("./Data/System 4.0.dsk.json"),
};

const SYSTEM_4_1: SystemDiskDef = {
    displayName: "System 4.1",
    description:
        "Added Easy Access accessibility features. Improved compatibility with larger hard drives. Released with the Mac II.",
    releaseDate: [1987, 4, 14],
    prefetchChunks: [0, 1, 2],
    machines: [MAC_II, MAC_SE, MAC_PLUS, MAC_512KE],
    generatedSpec: () => import("./Data/System 4.1.dsk.json"),
};

const SYSTEM_5_0: SystemDiskDef = {
    displayName: "System 5.0",
    description:
        "Introduced the MultiFinder, revised the Finder about box, and improved printing support.",
    releaseDate: [1987, 10, 8],
    prefetchChunks: [0, 1, 2],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    generatedSpec: () => import("./Data/System 5.0 HD.dsk.json"),
    notable: true,
};

const SYSTEM_5_1: SystemDiskDef = {
    displayName: "System 5.1",
    description: "Updated the LaserWriter Driver and Apple HD SC Setup.",
    releaseDate: [1987, 12, 1],
    prefetchChunks: [0, 1, 2],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    generatedSpec: () => import("./Data/System 5.1 HD.dsk.json"),
};

const SYSTEM_6_0: SystemDiskDef = {
    displayName: "System 6.0",
    description: "Added MacroMaker, Map and CloseView utilities.",
    releaseDate: [1988, 4, 30],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
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
    generatedSpec: () => import("./Data/System 6.0.2 HD.dsk.json"),
};

const SYSTEM_6_0_3: SystemDiskDef = {
    displayName: "System 6.0.3",
    description: "Added support for the Mac IIcx and SE/30.",
    releaseDate: [1989, 3, 7],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    generatedSpec: () => import("./Data/System 6.0.3 HD.dsk.json"),
};

const SYSTEM_6_0_4: SystemDiskDef = {
    displayName: "System 6.0.4",
    description:
        "Added support for the Mac IIci and Portable. Improved the installer. Holding down the option key when double-clicking in the Finder closes the parent window.",
    releaseDate: [1989, 9, 20],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    generatedSpec: () => import("./Data/System 6.0.4 HD.dsk.json"),
};

const SYSTEM_6_0_5: SystemDiskDef = {
    displayName: "System 6.0.5",
    description:
        "Bundled 32-bit QuickDraw (previously a separate package). Added support for the Mac IIfx.",
    releaseDate: [1990, 3, 19],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    generatedSpec: () => import("./Data/System 6.0.5 HD.dsk.json"),
    notable: true,
};

const SYSTEM_6_0_6: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "System 6.0.6.",
    releaseDate: [1990, 10, 15], // Officual release date is not known.
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
    generatedSpec: () => import("./Data/System 6.0.7 HD.dsk.json"),
};

const SYSTEM_6_0_8: SystemDiskDef = {
    displayName: "System 6.0.8",
    description:
        "Final release of System 6, updated printing software to match the printing software of System 7.",
    releaseDate: [1991, 4, 17],
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
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

const SYSTEM_7_1_2: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "System 7.1.2",
    description:
        "Initial system software for the Power Macintosh computers. Does not run under emulation.",
    releaseDate: [1994, 3, 14],
    machines: [POWER_MACINTOSH_9500],
};

const SYSTEM_7_1_2_DISK_TOOLS: SystemDiskDef = {
    displayName: "System 7.1.2 Disk Tools",
    description:
        "Disk Tools startup disk that from the floppy disk version of System 7.1.2.",
    releaseDate: [1994, 3, 14],
    prefetchChunks: [0],
    machines: [POWER_MACINTOSH_6100],
    generatedSpec: () => import("./Data/System 7.1.2 Disk Tools FD.dsk.json"),
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
        "Disk Tools startup disk that from the floppy disk version of System 7.5.",
    releaseDate: [1994, 9, 12],
    prefetchChunks: [0],
    machines: [POWER_MACINTOSH_6100],
    generatedSpec: () => import("./Data/System 7.5 Disk Tools FD.dsk.json"),
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
    machines: [POWER_MACINTOSH_9500, POWER_MACINTOSH_G3],
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
    machines: [POWER_MACINTOSH_9500, POWER_MACINTOSH_G3],
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
    machines: [POWER_MACINTOSH_G3, POWER_MACINTOSH_9500],
    appearance: "Platinum",
    generatedSpec: () => import("./Data/Mac OS 9.0 HD.dsk.json"),
    notable: true,
};

const MAC_OS_9_0_1: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "Mac OS 9.0.1",
    description: "Under development but never released.",
    releaseDate: [2000, 1, 1], // Planned release date unknown
    machines: [POWER_MACINTOSH_G3, POWER_MACINTOSH_9500],
};

const MAC_OS_9_0_2: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "Mac OS 9.0.2",
    description: "Released with the PowerBook G3 (FireWire) only.",
    releaseDate: [2000, 2, 16],
    machines: [POWER_MACINTOSH_G3, POWER_MACINTOSH_9500],
};

const MAC_OS_9_0_3: PlaceholderDiskDef = {
    type: "placeholder",
    displayName: "Mac OS 9.0.3",
    description: "Released with iMacs only.",
    releaseDate: [2000, 3, 1], // Exact date unknown
    machines: [POWER_MACINTOSH_G3, POWER_MACINTOSH_9500],
};

const MAC_OS_9_0_4: SystemDiskDef = {
    displayName: "Mac OS 9.0.4",
    description:
        "Bug fixes, final release supported by the SheepShaver emulator and Infinite Mac as of now.",
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
    machines: [POWER_MACINTOSH_G3, POWER_MACINTOSH_9500],
    appearance: "Platinum",
    generatedSpec: () => import("./Data/Mac OS 9.0.4 HD.dsk.json"),
    notable: true,

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
];

export const HIDDEN_DISKS = [SYSTEM_7_1_2_DISK_TOOLS, SYSTEM_7_5_DISK_TOOLS];

export const SYSTEM_DISKS_BY_NAME: {[name: string]: SystemDiskDef} =
    Object.fromEntries(
        ALL_DISKS.filter(isSystemDiskDef).map(disk => [
            systemDiskName(disk),
            disk,
        ])
    );

export function systemDiskName(disk: SystemDiskDef) {
    return (
        disk.displayName +
        (disk.displaySubtitle ? " - " + disk.displaySubtitle : "")
    );
}

export const NOTABLE_DISKS: SystemDiskDef[] = [];

export const DISKS_BY_YEAR: {
    [year: number]: (SystemDiskDef | PlaceholderDiskDef)[];
} = {};
export const NOTABLE_DISKS_BY_YEAR: {
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
});

export const INFINITE_HD: EmulatorDiskDef = {
    prefetchChunks: [0, 3692, 3696, 3697, 3698],
    generatedSpec: () => import("./Data/Infinite HD.dsk.json"),
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
