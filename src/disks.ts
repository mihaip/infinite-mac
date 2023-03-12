import infiniteHdManifest from "./Data/Infinite HD.dsk.json";
import system10Manifest from "./Data/System 1.0.dsk.json";
import system11Manifest from "./Data/System 1.1.dsk.json";
import system20Manifest from "./Data/System 2.0.dsk.json";
import system21Manifest from "./Data/System 2.1.dsk.json";
import system30Manifest from "./Data/System 3.0.dsk.json";
import system32Manifest from "./Data/System 3.2.dsk.json";
import system33Manifest from "./Data/System 3.3.dsk.json";
import system40Manifest from "./Data/System 4.0.dsk.json";
import system41Manifest from "./Data/System 4.1.dsk.json";
import system50Manifest from "./Data/System 5.0 HD.dsk.json";
import system51Manifest from "./Data/System 5.1 HD.dsk.json";
import system60HdManifest from "./Data/System 6.0 HD.dsk.json";
import system602HdManifest from "./Data/System 6.0.2 HD.dsk.json";
import system603HdManifest from "./Data/System 6.0.3 HD.dsk.json";
import system604HdManifest from "./Data/System 6.0.4 HD.dsk.json";
import system605HdManifest from "./Data/System 6.0.5 HD.dsk.json";
import system607HdManifest from "./Data/System 6.0.7 HD.dsk.json";
import system608HdManifest from "./Data/System 6.0.8 HD.dsk.json";
import system70HdManifest from "./Data/System 7.0 HD.dsk.json";
import system71HdManifest from "./Data/System 7.1 HD.dsk.json";
import system711HdManifest from "./Data/System 7.1.1 HD.dsk.json";
import system75HdManifest from "./Data/System 7.5 HD.dsk.json";
import system753HdManifest from "./Data/System 7.5.3 HD.dsk.json";
import system753PpcHdManifest from "./Data/System 7.5.3 (PPC) HD.dsk.json";
import kanjiTalk753HdManifest from "./Data/KanjiTalk 7.5.3 HD.dsk.json";
import macos81HdManifest from "./Data/Mac OS 8.1 HD.dsk.json";
import macos904HdManifest from "./Data/Mac OS 9.0.4 HD.dsk.json";
import type {EmulatorChunkedFileSpec} from "./emulator/emulator-common";
import type {MachineDef} from "./machines";
import {
    MAC_128K,
    MAC_512KE,
    MAC_SE,
    MAC_II,
    MAC_IIFX,
    MAC_PLUS,
    POWER_MACINTOSH_G3,
    POWER_MACINTOSH_9500,
    QUADRA_650,
} from "./machines";

// prefetchChunks are semi-automatically generated -- we will get a
// warning via validateSpecPrefetchChunks() if these are incorrect.
export type DiskDef = EmulatorChunkedFileSpec & {
    displayName: string;
    displaySubtitle?: string;
    description: string;
    machines: MachineDef[];
    appleTalkSupported?: boolean;
    mfsOnly?: boolean;
    hasPlatinumAppearance?: boolean;
};

const SYSTEM_1_0: DiskDef = {
    displayName: "System 1.0",
    description: "Initial system software release, shipped with the Mac 128K.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1],
    machines: [MAC_128K],
    mfsOnly: true,
    ...system10Manifest,
};

const SYSTEM_1_1: DiskDef = {
    displayName: "System 1.1",
    description:
        "Maintenance release that improved disk copying speeds and added the “Clean Up” command and the Finder about box.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1],
    machines: [MAC_128K],
    mfsOnly: true,
    ...system11Manifest,
};

const SYSTEM_2_0: DiskDef = {
    displayName: "System 2.0",
    description:
        "Introduced the ”New Folder” and ”Shut Down” commands, the MiniFinder, and Chooser. Also added the Command-Shift-3 screenshot command.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1],
    machines: [MAC_128K],
    mfsOnly: true,
    ...system20Manifest,
};

const SYSTEM_2_1: DiskDef = {
    displayName: "System 2.1",
    description:
        "Added support for the Hard Disk 20 drive and the HFS file system.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1],
    // The Mac 128K is supported, but HFS is not loaded in that case.
    machines: [MAC_512KE, MAC_128K],
    ...system21Manifest,
};

const SYSTEM_3_0: DiskDef = {
    displayName: "System 3.0",
    description:
        "Added more complete support for HFS, zoom boxes for windows and a redesigned control panel.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1, 2],
    machines: [MAC_PLUS, MAC_512KE],
    ...system30Manifest,
};

const SYSTEM_3_2: DiskDef = {
    displayName: "System 3.2",
    description:
        "Includes redesigned Calculator and Chooser desktop accessories (System 3.1 was very buggy and was superseded by 3.2 shortly after release).",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1, 2],
    machines: [MAC_PLUS, MAC_512KE],
    ...system32Manifest,
};

const SYSTEM_3_3: DiskDef = {
    displayName: "System 3.3",
    description:
        "Enhanced AppleShare file serving support. The Trash can icon now bulges when it's not empty.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1, 2],
    machines: [MAC_PLUS, MAC_512KE],
    ...system33Manifest,
};

const SYSTEM_4_0: DiskDef = {
    displayName: "System 4.0",
    description:
        "Added the Find File desktop accessory and the Restart command. Features a redesigned control panel. Released with the Mac SE.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1, 2],
    machines: [MAC_SE],
    ...system40Manifest,
};

const SYSTEM_4_1: DiskDef = {
    displayName: "System 4.1",
    description:
        "Added Easy Access accessibility features. Improved compatibility with larger hard drives. Released with the Mac II.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1, 2],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    ...system41Manifest,
};

const SYSTEM_5_0: DiskDef = {
    displayName: "System 5.0",
    description:
        "Introduced the MultiFinder, revised the Finder about box, and improved printing support.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1, 2],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    ...system50Manifest,
};

const SYSTEM_5_1: DiskDef = {
    displayName: "System 5.1",
    description: "Updated the LaserWriter Driver and Apple HD SC Setup.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1, 2],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    ...system51Manifest,
};

const SYSTEM_6_0: DiskDef = {
    displayName: "System 6.0",
    description: "Added MacroMaker, Map and CloseView utilities.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    ...system60HdManifest,
};

const SYSTEM_6_0_2: DiskDef = {
    displayName: "System 6.0.2",
    description:
        "Updated LaserWriter and other printing-related utilites. System 6.0.1 was released with the Mac IIx but was buggy and short-lived.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    ...system602HdManifest,
};

const SYSTEM_6_0_3: DiskDef = {
    displayName: "System 6.0.3",
    description: "Added support for the Mac IIcx and SE/30.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    ...system603HdManifest,
};

const SYSTEM_6_0_4: DiskDef = {
    displayName: "System 6.0.4",
    description:
        "Added support for the Mac IIci and Portable. Improved the installer. Holding down the option key when double-clicking in the Finder closes the parent window.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    ...system604HdManifest,
};

const SYSTEM_6_0_5: DiskDef = {
    displayName: "System 6.0.5",
    description:
        "Bundled 32-bit QuidckDraw (previously a separate package). Added support for the Mac IIfx.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    ...system605HdManifest,
};

const SYSTEM_6_0_7: DiskDef = {
    displayName: "System 6.0.7",
    description:
        "First release to ship on 1440K disks. Added support for the Classic, LC and IIsi. System 6.0.6 was never officially released due to an AppleTalk bug.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    ...system607HdManifest,
};

const SYSTEM_6_0_8: DiskDef = {
    displayName: "System 6.0.8",
    description:
        "Final release of System 6, updated printing software to match the printing software of System 7.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_SE, MAC_II, MAC_PLUS, MAC_512KE],
    ...system608HdManifest,
};

const SYSTEM_7_0: DiskDef = {
    displayName: "System 7.0",
    description:
        "Fully 32-bit clean, the MultiFinder is now mandatory, reorganized the System Folder into subfolders, made the Apple menu customizable, revamped the window appearance, and much more.",
    baseUrl: "/Disk",
    prefetchChunks: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19,
    ],
    machines: [MAC_IIFX, MAC_PLUS, MAC_SE, MAC_II],
    appleTalkSupported: true,
    ...system70HdManifest,
};

const SYSTEM_7_1: DiskDef = {
    displayName: "System 7.1",
    description:
        "Added the Fonts folder, introduced system enablers to support new Mac models and improved internationalization support.",
    baseUrl: "/Disk",
    prefetchChunks: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 23,
        24, 25, 26, 27,
    ],
    machines: [QUADRA_650, MAC_IIFX, MAC_PLUS, MAC_SE, MAC_II],
    appleTalkSupported: true,
    ...system71HdManifest,
};

const SYSTEM_7_1_1: DiskDef = {
    displayName: "System 7.1.1",
    displaySubtitle: "Pro",
    description: "Bundled PowerTalk and AppleScript.",
    baseUrl: "/Disk",
    prefetchChunks: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 21, 22, 23,
        24, 25, 26, 27, 28, 29, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43,
        44,
    ],
    machines: [QUADRA_650, MAC_IIFX, MAC_PLUS, MAC_SE, MAC_II],
    appleTalkSupported: true,
    ...system711HdManifest,
};

const SYSTEM_7_5: DiskDef = {
    displayName: "System 7.5",
    description:
        "Featured a new startup screen, drag-and-drop support and the Launcher. Included a hierarchical Apple menu, Extensions Manager, menu bar clock, Find File, Stickies, WindowShade, all based on licensed third-party utilities.",
    baseUrl: "/Disk",
    prefetchChunks: [
        0, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
        23, 25, 26, 27, 28, 29, 30, 31, 34, 35, 41, 42, 43, 45, 46, 47, 48, 49,
        50, 53, 55, 57, 63, 64, 65, 67, 68, 69, 70, 71, 72, 73, 75,
    ],
    machines: [QUADRA_650, MAC_IIFX, MAC_PLUS, MAC_SE, MAC_II],
    appleTalkSupported: true,
    ...system75HdManifest,
};

const SYSTEM_7_5_3: DiskDef = {
    displayName: "System 7.5.3",
    description:
        "Brought Open Transport and other improvements released with the PCI Power Mac-only 7.5.2 release to a broader set of Macs.",
    baseUrl: "/Disk",
    prefetchChunks: [
        0, 3, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24,
        25, 26, 27, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58,
        59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 79, 80, 88, 89, 90, 92, 93,
        94, 96, 98, 99, 100, 102, 103, 104, 106, 107, 108, 109, 110, 111, 113,
        114, 116, 117, 166,
    ],
    machines: [QUADRA_650, MAC_PLUS, MAC_SE, MAC_II, MAC_IIFX],
    appleTalkSupported: true,
    ...system753HdManifest,
};

const SYSTEM_7_5_3_PPC: DiskDef = {
    displayName: "System 7.5.3",
    displaySubtitle: "PowerPC",
    description:
        "Installation with OpenDoc, QuickDraw GX and other PowerPC-only software.",
    baseUrl: "/Disk",
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
    ...system753PpcHdManifest,
};

const KANJITALK_7_5_3: DiskDef = {
    displayName: "KanjiTalk 7.5.3",
    description: "Japanese edition of System 7.5.3.",
    baseUrl: "/Disk",
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
    ...kanjiTalk753HdManifest,
};

const MAC_OS_8_1: DiskDef = {
    displayName: "Mac OS 8.1",
    description: "Added support for the HFS+ file system.",
    baseUrl: "/Disk",
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
    hasPlatinumAppearance: true,
    ...macos81HdManifest,
};

const MAC_OS_9_0_4: DiskDef = {
    displayName: "Mac OS 9.0.4",
    description: "Bug fix release.",
    baseUrl: "/Disk",
    prefetchChunks: [
        0, 3, 6, 7, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24,
        25, 26, 27, 28, 29, 30, 31, 32, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44,
        45, 46, 47, 48, 49, 50, 51, 52, 53, 55, 57, 60, 64, 65, 66, 67, 68, 69,
        70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87,
        88, 89, 90, 91, 92, 93, 94, 102, 103, 104, 105, 106, 107, 108, 109, 110,
        111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 124, 125, 126, 127,
        128, 131, 132, 133, 135, 136, 137, 139, 140, 141, 142, 143, 144, 145,
        146, 147, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160,
        161, 162, 163, 164, 165, 166, 167, 168, 169, 202, 203, 205, 206, 208,
        210, 211, 213, 214, 215, 216, 218, 219, 220, 221, 222, 224, 225, 226,
        227, 228, 229, 230, 232, 233, 243, 244, 245, 247, 249, 253, 254, 255,
        257, 258, 259, 260, 261, 262, 270, 277, 280, 281, 282, 283, 303, 304,
        305, 309, 310, 312, 314, 319, 320, 321, 322, 323, 325, 327, 328, 334,
        335, 336, 339, 343, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355,
        356, 357, 358, 359, 361, 362, 363, 366, 370, 371, 372, 373, 374, 375,
        379,
    ],
    machines: [POWER_MACINTOSH_G3, POWER_MACINTOSH_9500],
    hasPlatinumAppearance: true,
    ...macos904HdManifest,
};

export const DISKS_BY_DOMAIN: {
    [domain: string]: DiskDef;
} = {
    "system6.app": SYSTEM_6_0_8,
    "system7.app": SYSTEM_7_5_3,
    "system7-ppc.app": SYSTEM_7_5_3_PPC,
    "kanjitalk7.app": KANJITALK_7_5_3,
    "macos8.app": MAC_OS_8_1,
    "macos9.app": MAC_OS_9_0_4,
};

export const DISKS_BY_YEAR: {
    [year: number]: DiskDef[];
} = {
    1984: [SYSTEM_1_0, SYSTEM_1_1],
    1985: [SYSTEM_2_0, SYSTEM_2_1],
    1986: [SYSTEM_3_0, SYSTEM_3_2],
    1987: [SYSTEM_3_3, SYSTEM_4_0, SYSTEM_4_1, SYSTEM_5_0, SYSTEM_5_1],
    1988: [SYSTEM_6_0, SYSTEM_6_0_2],
    1989: [SYSTEM_6_0_3, SYSTEM_6_0_4],
    1990: [SYSTEM_6_0_5, SYSTEM_6_0_7],
    1991: [SYSTEM_6_0_8, SYSTEM_7_0],
    1992: [SYSTEM_7_1],
    1993: [SYSTEM_7_1_1],
    1994: [SYSTEM_7_5],
    1996: [SYSTEM_7_5_3, SYSTEM_7_5_3_PPC, KANJITALK_7_5_3],
    1998: [MAC_OS_8_1],
    2000: [MAC_OS_9_0_4],
};

export const ALL_DISKS = [
    SYSTEM_1_0,
    SYSTEM_1_1,
    SYSTEM_2_0,
    SYSTEM_2_1,
    SYSTEM_3_0,
    SYSTEM_3_2,
    SYSTEM_3_3,
    SYSTEM_4_0,
    SYSTEM_4_1,
    SYSTEM_5_0,
    SYSTEM_5_1,
    SYSTEM_6_0,
    SYSTEM_6_0_2,
    SYSTEM_6_0_3,
    SYSTEM_6_0_4,
    SYSTEM_6_0_5,
    SYSTEM_6_0_7,
    SYSTEM_6_0_8,
    SYSTEM_7_0,
    SYSTEM_7_1,
    SYSTEM_7_1_1,
    SYSTEM_7_5,
    SYSTEM_7_5_3,
    SYSTEM_7_5_3_PPC,
    KANJITALK_7_5_3,
    MAC_OS_8_1,
    MAC_OS_9_0_4,
];

export const DISKS_BY_NAME = Object.fromEntries(
    ALL_DISKS.map(disk => [disk.name, disk])
);

export const INFINITE_HD = {
    baseUrl: "/Disk",
    prefetchChunks: [0, 3345, 3346, 3349, 3350, 3351, 3352],
    ...infiniteHdManifest,
};
