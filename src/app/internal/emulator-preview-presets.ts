import {
    SYSTEM_DISKS_BY_NAME,
    SYSTEM_1_0,
    SYSTEM_1_1,
    SYSTEM_3_0,
    SYSTEM_3_2,
    SYSTEM_6_0_8,
    SYSTEM_7_0_1,
    SYSTEM_7_1,
    SYSTEM_7_1_2,
    SYSTEM_7_5_2,
    MAC_OS_7_6,
    MAC_OS_7_6_1,
    MAC_OS_8_1,
    MAC_OS_8_5,
    MAC_OS_9_0_4,
    MAC_OS_9_2_2,
    MAC_OS_X_10_1_5,
    MAC_OS_X_10_2_8,
    MAC_OS_X_10_3_9,
    NEXTSTEP_1_0,
    NEXTSTEP_3_3,
    OPENSTEP_4_2,
    AUX_3_0_1,
    BEOS_R4,
    systemDiskName,
    type SystemDiskDef,
} from "@/defs/disks";
import {
    MAC_128K,
    MAC_128K_SNOW,
    MAC_512K_SNOW,
    MAC_512KE,
    MAC_512KE_SNOW,
    MAC_PLUS,
    MAC_PLUS_SNOW,
    MAC_SE,
    MAC_SE_SNOW,
    MAC_SE_FDHD_SNOW,
    MAC_CLASSIC_SNOW,
    MAC_II,
    MAC_II_SNOW,
    MAC_II_FDHD_SNOW,
    MAC_IIx,
    MAC_IIx_SNOW,
    MAC_IIcx_SNOW,
    MAC_SE30_SNOW,
    QUADRA_650,
    POWER_MACINTOSH_6100,
    POWER_MACINTOSH_7200,
    POWER_MACINTOSH_7300,
    POWER_MACINTOSH_7500,
    POWER_MACINTOSH_G3_BEIGE,
    POWER_MACINTOSH_G3_BW,
    POWER_MACINTOSH_G4_PEARPC,
    IMAC_G3,
    NEXT_COMPUTER,
    NEXT_CUBE,
    NEXT_STATION,
    NEXT_STATION_TURBO_COLOR,
    type MachineDef,
    POWER_MACINTOSH_G3_BW_DPPC,
    POWER_MACINTOSH_9500,
} from "@/defs/machines";
import {type RunDef} from "@/defs/run-def";

export type EmulatorPreviewCase = {
    id: string;
    label?: string;
    runDef: RunDef;
};

function preview(
    machine: MachineDef,
    disk: SystemDiskDef | undefined,
    options: Partial<Pick<RunDef, "ramSize" | "flags" | "bootFromROM">> & {
        label?: string;
    } = {}
): EmulatorPreviewCase {
    const {label, ...overrides} = options;
    const diskName = disk ? systemDiskName(disk) : "none";
    return {
        id: `${machine.name}/${diskName}/${label ?? ""}`,
        label,
        runDef: {
            machine,
            disks: disk ? [disk] : [],
            ramSize: disk?.preferredRAMSize,
            screenSize: "embed",
            screenScale: 1,
            includeSavedHD: false,
            includeInfiniteHD: false,
            includeLibrary: false,
            libraryDownloadURLs: [],
            diskFiles: [],
            cdromURLs: [],
            cdromPrefetchChunks: [],
            flags: {customDate: disk?.customDate},
            ...overrides,
        },
    };
}

export const EMULATOR_PREVIEW_PRESETS = [
    {
        id: "cores",
        label: "Emulator cores",
        cases: [
            preview(MAC_128K_SNOW, SYSTEM_1_0), // Snow
            preview(MAC_PLUS, SYSTEM_6_0_8), // Mini vMac
            preview(QUADRA_650, SYSTEM_7_1), // Basilisk II
            preview(POWER_MACINTOSH_G3_BW, MAC_OS_9_0_4), // SheepShaver
            preview(POWER_MACINTOSH_G3_BEIGE, MAC_OS_8_1), // DingusPPC
            preview(NEXT_STATION, NEXTSTEP_3_3), // Previous
            preview(POWER_MACINTOSH_G4_PEARPC, MAC_OS_X_10_3_9), // PearPC
        ],
    },
    {
        id: "minivmac",
        label: "Mini vMac variants",
        cases: [
            preview(MAC_128K, SYSTEM_1_0),
            preview(MAC_512KE, SYSTEM_3_2),
            preview(MAC_PLUS, SYSTEM_6_0_8),
            preview(MAC_SE, SYSTEM_6_0_8),
            preview(MAC_II, SYSTEM_7_1),
            preview(MAC_IIx, SYSTEM_7_1),
        ],
    },
    {
        id: "snow",
        label: "Snow machines",
        cases: [
            preview(MAC_128K_SNOW, SYSTEM_1_0),
            preview(MAC_512K_SNOW, SYSTEM_1_1),
            preview(MAC_512KE_SNOW, SYSTEM_3_2),
            preview(MAC_PLUS_SNOW, SYSTEM_6_0_8),
            preview(MAC_SE_SNOW, SYSTEM_6_0_8),
            preview(MAC_SE_FDHD_SNOW, SYSTEM_6_0_8),
            preview(MAC_CLASSIC_SNOW, SYSTEM_6_0_8),
            preview(MAC_II_SNOW, SYSTEM_7_1),
            preview(MAC_II_FDHD_SNOW, SYSTEM_7_1),
            preview(MAC_IIx_SNOW, SYSTEM_7_1),
            preview(MAC_IIcx_SNOW, SYSTEM_7_1),
            preview(MAC_SE30_SNOW, SYSTEM_6_0_8),
        ],
    },
    {
        id: "dingusppc",
        label: "DingusPPC machines",
        cases: [
            // NuBus
            preview(POWER_MACINTOSH_6100, SYSTEM_7_1_2),
            // PCI
            preview(POWER_MACINTOSH_7200, MAC_OS_7_6),
            preview(POWER_MACINTOSH_7500, SYSTEM_7_5_2, {
                label: "BlueSCSI",
                flags: {blueSCSI: true},
            }),
            preview(POWER_MACINTOSH_7300, MAC_OS_7_6_1),
            // OldWorld
            preview(POWER_MACINTOSH_G3_BEIGE, MAC_OS_8_1),
            // NeWorld
            preview(POWER_MACINTOSH_G3_BW_DPPC, MAC_OS_9_2_2),
            preview(IMAC_G3, MAC_OS_X_10_1_5),
        ],
    },
    {
        id: "previous",
        label: "NeXT machines",
        cases: [
            preview(NEXT_COMPUTER, NEXTSTEP_1_0),
            preview(NEXT_CUBE, NEXTSTEP_3_3),
            preview(NEXT_STATION, NEXTSTEP_3_3),
            preview(NEXT_STATION_TURBO_COLOR, OPENSTEP_4_2),
        ],
    },
    {
        id: "families",
        label: "OS families",
        cases: [
            preview(MAC_128K_SNOW, SYSTEM_1_0), // Original
            preview(MAC_PLUS_SNOW, SYSTEM_3_0), // HFS + SCSI
            preview(MAC_SE, SYSTEM_6_0_8), // System 6
            preview(MAC_CLASSIC_SNOW, undefined, {
                label: "Boot from ROM",
                bootFromROM: true,
            }), // System 6 in ROM
            preview(MAC_IIcx_SNOW, SYSTEM_7_0_1), // System 7
            preview(POWER_MACINTOSH_9500, MAC_OS_8_5), // PowerPC-only
            preview(MAC_IIcx_SNOW, AUX_3_0_1), // A/UX
            preview(POWER_MACINTOSH_7300, BEOS_R4), // BeOS
            preview(NEXT_STATION, NEXTSTEP_3_3), // NeXTSTEP
            preview(POWER_MACINTOSH_G4_PEARPC, MAC_OS_X_10_2_8), // Mac OS X
        ],
    },
    {
        id: "all-snow",
        label: "All Snow disks",
        cases: Object.values(SYSTEM_DISKS_BY_NAME)
            .filter(disk => disk.preferredMachine.emulatorType === "Snow")
            .map(disk => preview(disk.preferredMachine, disk)),
    },
    {
        id: "all-basiliskii",
        label: "All Basilisk II disks",
        cases: Object.values(SYSTEM_DISKS_BY_NAME)
            .filter(disk => disk.preferredMachine.emulatorType === "BasiliskII")
            .map(disk => preview(disk.preferredMachine, disk)),
    },
    {
        id: "all-sheepshaver",
        label: "All SheepShaver disks",
        cases: Object.values(SYSTEM_DISKS_BY_NAME)
            .filter(
                disk => disk.preferredMachine.emulatorType === "SheepShaver"
            )
            .map(disk => preview(disk.preferredMachine, disk)),
    },
    {
        id: "all-dingusppc",
        label: "All DingusPPC disks",
        cases: Object.values(SYSTEM_DISKS_BY_NAME)
            .filter(disk => disk.preferredMachine.emulatorType === "DingusPPC")
            .map(disk => preview(disk.preferredMachine, disk)),
    },
    {
        id: "all",
        label: "All disks",
        cases: Object.values(SYSTEM_DISKS_BY_NAME).map(disk =>
            preview(disk.preferredMachine, disk)
        ),
    },
];
