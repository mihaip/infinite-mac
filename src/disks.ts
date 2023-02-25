import infiniteHdManifest from "./Data/Infinite HD.dsk.json";
import system10Manifest from "./Data/System 1.0.dsk.json";
import system608HdManifest from "./Data/System 6.0.8 HD.dsk.json";
import system753HdManifest from "./Data/System 7.5.3 HD.dsk.json";
import system753PpcHdManifest from "./Data/System 7.5.3 (PPC) HD.dsk.json";
import kanjiTalk753HdManifest from "./Data/KanjiTalk 7.5.3 HD.dsk.json";
import macos81HdManifest from "./Data/Mac OS 8.1 HD.dsk.json";
import macos904HdManifest from "./Data/Mac OS 9.0.4 HD.dsk.json";
import type {EmulatorChunkedFileSpec} from "./emulator/emulator-common";
import type {MachineDef} from "./machines";
import {
    MAC_128K,
    MAC_II,
    MAC_PLUS,
    NEW_WORLD_POWERMAC,
    OLD_WORLD_POWERMAC,
    QUADRA,
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
    bezelStyle: "Beige" | "Platinum" | "Pinstripes";
};

const SYSTEM_1_0: DiskDef = {
    displayName: "System 1.0",
    description: "Initial system software release, shipped with the Mac 128K.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1],
    machines: [MAC_128K],
    bezelStyle: "Beige",
    mfsOnly: true,
    ...system10Manifest,
};

const SYSTEM_6_0_8: DiskDef = {
    displayName: "System 6.0.8",
    description:
        "Final release of System 6, updated printing software to match the printing software of System 7.",
    baseUrl: "/Disk",
    prefetchChunks: [0, 1, 2, 3, 4, 5, 6, 8],
    machines: [MAC_PLUS, MAC_II],
    bezelStyle: "Beige",
    ...system608HdManifest,
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
    machines: [QUADRA, MAC_II, MAC_PLUS],
    appleTalkSupported: true,
    bezelStyle: "Beige",
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
    machines: [OLD_WORLD_POWERMAC],
    appleTalkSupported: true,
    bezelStyle: "Beige",
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
    bezelStyle: "Beige",
    machines: [QUADRA, MAC_II, MAC_PLUS],
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
    bezelStyle: "Platinum",
    machines: [QUADRA, OLD_WORLD_POWERMAC],
    appleTalkSupported: true,
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
    machines: [NEW_WORLD_POWERMAC, OLD_WORLD_POWERMAC],
    bezelStyle: "Pinstripes",
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
    1984: [SYSTEM_1_0],
    1991: [SYSTEM_6_0_8],
    1996: [SYSTEM_7_5_3, SYSTEM_7_5_3_PPC, KANJITALK_7_5_3],
    1998: [MAC_OS_8_1],
    2000: [MAC_OS_9_0_4],
};

export const ALL_DISKS = [
    SYSTEM_1_0,
    SYSTEM_6_0_8,
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
    prefetchChunks: [0, 3346, 3350, 3351, 3352],
    ...infiniteHdManifest,
};
