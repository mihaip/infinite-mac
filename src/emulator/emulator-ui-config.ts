import {
    POWER_MACINTOSH_G3_BEIGE,
    POWER_MACINTOSH_G3_BW_DPPC,
    POWER_MACINTOSH_6100,
    POWER_MACINTOSH_7200,
    POWER_MACINTOSH_7500,
    type MachineDefRAMSize,
    IMAC_G3,
} from "../machines";
import {arrayBufferToString, replacePlaceholders} from "../strings";
import {type EmulatorChunkedFileSpec} from "./emulator-common";
import {
    emulatorCpuId,
    emulatorModelId,
    emulatorUsesPlaceholderDisks,
    EMULATOR_REMOVABLE_DISK_COUNT,
} from "./emulator-common-emulators";
import {type EmulatorConfig} from "./emulator-ui";

export function configToMacemuPrefs(
    config: EmulatorConfig,
    {
        basePrefs,
        romFileName,
        disks,
    }: {
        basePrefs: ArrayBuffer;
        romFileName: string;
        disks: EmulatorChunkedFileSpec[];
    }
): string {
    const {machine} = config;
    let prefsStr = new TextDecoder().decode(basePrefs);
    prefsStr += `rom ${romFileName}\n`;
    const cpuId = emulatorCpuId(machine.emulatorType, machine.cpu);
    if (cpuId !== undefined) {
        prefsStr += `cpu ${cpuId}\n`;
    }
    const modelId = emulatorModelId(machine.emulatorType, machine.gestaltID);
    if (modelId !== undefined) {
        prefsStr += `modelid ${modelId}\n`;
    }
    const ramSize = ramSizeToByteCount(config.ramSize ?? machine.ramSizes[0]);
    prefsStr += `ramsize ${ramSize}\n`;
    prefsStr += `screen win/${config.screenWidth}/${config.screenHeight}\n`;

    // Mini vMac is more sensitive to disk ordering (it tries to boot from the
    // first one). We thus need to put our built-in disks after the CD-ROMs if
    // one of them is likely to be a custom boot disk and there are no system
    // disks present.
    const shouldReorderBuiltInDisks =
        machine.emulatorType === "Mini vMac" &&
        !disks.some(disks => disks.name.startsWith("System")) &&
        config.cdroms.some(cdrom => cdrom.mountReadWrite);
    const reorderedDisks = [];
    for (const spec of disks) {
        if (shouldReorderBuiltInDisks && isBuiltNonBootableDisk(spec)) {
            reorderedDisks.push(spec);
            continue;
        }
        prefsStr += `disk ${spec.name}\n`;
    }
    for (const cdrom of config.cdroms) {
        prefsStr += `disk ${cdrom.mountReadWrite ? "" : "*"}${cdrom.name}\n`;
    }
    for (const spec of reorderedDisks) {
        prefsStr += `disk ${spec.name}\n`;
    }
    for (const diskFile of config.diskFiles) {
        if (diskFile.isCDROM) {
            prefsStr += `cdrom ${diskFile.name}\n`;
        } else {
            prefsStr += `disk ${diskFile.name}\n`;
        }
    }
    if (emulatorUsesPlaceholderDisks(machine.emulatorType)) {
        for (let i = 0; i < EMULATOR_REMOVABLE_DISK_COUNT; i++) {
            prefsStr += `disk */placeholder/${i}\n`;
        }
    }
    if (config.ethernetProvider) {
        prefsStr += "appletalk true\n";
    }
    // The fallback path does not support high-frequency calls to reading
    // the input (we end up making so many service worker network requests
    // that overall emulation latency suffers).
    prefsStr += `jsfrequentreadinput ${config.useSharedMemory}\n`;
    return prefsStr;
}

function isBuiltNonBootableDisk(spec: EmulatorChunkedFileSpec): boolean {
    return (
        // The various Infinite HD variants
        spec.name.startsWith("Infinite") ||
        // Saved HD
        spec.persistent === true
    );
}

export function configToDingusPPCArgs(
    config: EmulatorConfig,
    {
        romFileName,
        disks,
    }: {
        romFileName: string;
        disks: EmulatorChunkedFileSpec[];
    }
): string[] {
    const args = ["--realtime", "--bootrom", romFileName];
    if (config.debugLog) {
        args.push("--log-to-stderr", "--log-no-uptime");
        const {verboseBootEnvVars} = config.machine;
        if (verboseBootEnvVars) {
            for (const [key, value] of Object.entries(verboseBootEnvVars)) {
                args.push("--setenv", `${key}=${value}`);
            }
        }
    }
    const floppies = [];
    const hardDisks = [];
    const cdroms = [];
    for (const spec of disks) {
        if (spec.isFloppy) {
            floppies.push(spec.name);
        } else {
            hardDisks.push(spec.name);
        }
    }
    for (const spec of config.cdroms) {
        cdroms.push(spec.name);
    }
    for (const diskFile of config.diskFiles) {
        if (diskFile.isCDROM) {
            cdroms.push(diskFile.name);
        } else {
            hardDisks.push(diskFile.name);
        }
    }
    if (floppies.length > 0) {
        // TODO: support more than one floppy
        args.push("--fdd_img", floppies[0]);
        // Disks are not actually writable, and by disabling writing we avoid
        // a system beep that causes the emulator to abort.
        args.push("--fdd_wr_prot=1");
    }
    if (hardDisks.length > 0) {
        args.push("--hdd_img", hardDisks.join(":"));
    }
    if (cdroms.length > 0) {
        // TODO: support more than one CD-ROM
        args.push("--cdr_img", cdroms[0]);
    }
    const ramSize = config.ramSize ?? config.machine.ramSizes[0];
    switch (config.machine.gestaltID) {
        case POWER_MACINTOSH_6100.gestaltID: {
            // The passed in RAM size is the total, convert it to installed SIMMs
            // that are needed on top of the built-in 8 MB.
            const simmSize = Math.floor((parseInt(ramSize) - 8) / 2).toString();
            args.push("--rambank1_size", simmSize);
            args.push("--rambank2_size", simmSize);
            break;
        }
        default:
            args.push("--rambank1_size", ramSize.slice(0, -1));
            break;
    }

    // DingusPPC normally auto-detects the machine based on the ROM, but in some
    // cases the same ROM was used for multiple machines and we need to give it
    // an explicit hint.
    switch (config.machine) {
        case POWER_MACINTOSH_7200:
            args.push("--machine", "pm7200");
            args.push("--gfxmem_size", "4");
            break;
        case POWER_MACINTOSH_7500:
            args.push("--machine", "pm7500");
            break;
        case POWER_MACINTOSH_G3_BEIGE:
            args.push("--gfxmem_size", "6");
            break;
        case POWER_MACINTOSH_G3_BW_DPPC:
            args.push("--machine", "pmg3nw");
            args.push("--pci_J12", "AtiMach64Gx");
            break;
        case IMAC_G3:
            args.push("--machine", "imacg3");
            break;
    }

    // Map screen sizes to the a monitor ID
    if (config.machine.supportedScreenSizes) {
        for (const size of config.machine.supportedScreenSizes) {
            if (
                size.width === config.screenWidth &&
                size.height === config.screenHeight &&
                size.monitorId
            ) {
                args.push("--mon_id", size.monitorId);
                break;
            }
        }
    }

    return args;
}
export function configToPreviousConfig(
    config: EmulatorConfig,
    {
        baseConfig,
        romFileName,
        disks,
    }: {
        baseConfig: ArrayBuffer;
        romFileName: string;
        disks: EmulatorChunkedFileSpec[];
    }
): string {
    const floppyStrs: string[] = [];
    const diskStrs: string[] = [];
    function addDisk(
        strs: string[],
        name: string,
        isCDROM: boolean,
        isInserted: boolean = true
    ) {
        const i = strs.length;
        strs.push(`
szImageName${i} = ${name}
nDeviceType${i} = ${isCDROM ? 2 : 1}
bDiskInserted${i} = ${isInserted ? "TRUE" : "FALSE"}
bWriteProtected${i} = ${isCDROM ? "TRUE" : "FALSE"}
`);
    }

    // Defer built-in non-bootable disks so that we will try to boot from
    // custom disks and CD-ROMs first.
    const reorderedDisks = [];
    for (const disk of disks) {
        if (!disk.isFloppy && isBuiltNonBootableDisk(disk)) {
            reorderedDisks.push(disk);
            continue;
        }
        addDisk(disk.isFloppy ? floppyStrs : diskStrs, disk.name, false);
    }
    for (const diskFile of config.diskFiles) {
        addDisk(diskStrs, diskFile.name, diskFile.isCDROM);
    }
    for (const spec of config.cdroms) {
        // If all we have is a CD-ROM, assume it's actually a hard drive image
        // (since read-only media can't be booted from).
        const isCDROM = diskStrs.length > 0 && !spec.mountReadWrite;
        addDisk(diskStrs, spec.name, isCDROM);
    }

    for (const disk of reorderedDisks) {
        addDisk(disk ? floppyStrs : diskStrs, disk.name, false);
    }

    // Placeholder used to handle CD-ROMs being inserted after boot.
    addDisk(diskStrs, "/", true, false);

    // Possible values come from the BOOT_DEVICE enum in Previous's
    // configuration.h.
    let bootDevice = 1; // BOOT_SCSI
    if (
        config.cdroms.length + config.disks.length + config.diskFiles.length ===
        0
    ) {
        bootDevice = 0; // BOOT_ROM
    } else if (disks.length === 1 && disks[0].isFloppy) {
        bootDevice = 4; // BOOT_FLOPPY
    }

    const {machine} = config;
    const turbo = machine.emulatorSubtype === "NeXTstation Turbo Color";

    // Based on Configuration_SetSystemDefaults for the different machines
    const replacements: {[key: string]: number | string | boolean} = {
        "MACHINE_TYPE": machine.gestaltID,
        "ROM_PATH": romFileName,
        "FLOPPIES": floppyStrs.join("\n"),
        "DISKS": diskStrs.join("\n"),
        "DEBUG_LOG": config.debugLog ?? false,
        "BOOT_DEVICE": bootDevice,
        "TURBO": turbo,
        "COLOR": turbo,
        "CPU_LEVEL": machine.cpu === "68040" ? 4 : 3,
        "CPU_FREQ":
            // Technically the Turbo only had a 33 MHz 68040, but simulate it being
            // upgraded with a Nitro card to get a bit more pep.
            turbo ? 40 : 25,
        "FPU_TYPE": machine.cpu === "68040" ? "68040" : "68882",
        "DSP_TYPE": 2, // DSP_TYPE_EMU
        "DSP_MEMORY_EXPANSION": machine.emulatorSubtype !== "NeXT Computer",
        "SCSI_CHIP": machine.emulatorSubtype !== "NeXT Computer",
        "RTC_CHIP": turbo,
        "NBIC":
            machine.emulatorSubtype === "NeXT Computer" ||
            machine.emulatorSubtype === "NeXTcube",
    };

    const ramSize = config.ramSize ?? config.machine.ramSizes[0];
    // Replicate valid combinations from defmemsize in Previous's dlgAdvanced.c.
    const RAM_BANKS: {[size: MachineDefRAMSize]: number[]} = {
        "128M": [32, 32, 32, 32],
        "64M": turbo ? [32, 32, 0, 0] : [16, 16, 16, 16],
        "32M": turbo ? [8, 8, 8, 8] : [16, 16, 0, 0],
        "16M": turbo ? [8, 8, 0, 0] : [16, 0, 0, 0],
    };
    const ramBankSizes =
        ramSize in RAM_BANKS ? RAM_BANKS[ramSize] : RAM_BANKS["128M"];
    ramBankSizes.forEach(
        (size, i) => (replacements[`RAM_BANK_SIZE${i}`] = size)
    );

    let configStr = arrayBufferToString(baseConfig);
    configStr = replacePlaceholders(configStr, replacements);
    return configStr;
}

export function configToPearPCConfig(
    config: EmulatorConfig,
    {
        baseConfig,
        disks,
    }: {
        baseConfig: ArrayBuffer;
        disks: EmulatorChunkedFileSpec[];
    }
): string {
    const memorySize = ramSizeToByteCount(
        config.ramSize ?? config.machine.ramSizes[0]
    );
    let primaryInstalled = false;
    let primaryPath = "";
    let primaryType = "hd";
    let secondaryInstalled = false;
    let secondaryPath = "";
    const secondaryType = "cdrom";

    const diskPaths: string[] = [];
    const cdromPaths: string[] = [];
    for (const spec of disks) {
        diskPaths.push(spec.name);
    }
    for (const cdrom of config.cdroms) {
        cdromPaths.push(cdrom.name);
    }
    for (const diskFile of config.diskFiles) {
        if (diskFile.isCDROM) {
            cdromPaths.push(diskFile.name);
        } else {
            diskPaths.push(diskFile.name);
        }
    }

    if (diskPaths.length) {
        primaryInstalled = true;
        primaryPath = diskPaths.join(":");
    }

    if (cdromPaths.length && !primaryInstalled) {
        primaryInstalled = true;
        primaryPath = cdromPaths.shift()!;
        primaryType = "cdrom";
    }
    if (cdromPaths.length && !secondaryInstalled) {
        secondaryInstalled = true;
        secondaryPath = cdromPaths.shift()!;
    }
    if (cdromPaths.length) {
        console.warn("Not mounting additional CD-ROMs", cdromPaths.length);
    }

    const replacements: {[key: string]: number | string | boolean} = {
        "SCREEN_WIDTH": config.screenWidth,
        "SCREEN_HEIGHT": config.screenHeight,
        "MEMORY_SIZE": memorySize,
        "MACH_ARGS": config.debugLog ? "-v" : "",
        "PCI_IDE0_MASTER_INSTALLED": primaryInstalled ? 1 : 0,
        "PCI_IDE0_MASTER_IMAGE": primaryPath,
        "PCI_IDE0_MASTER_TYPE": primaryType,
        "PCI_IDE0_SLAVE_INSTALLED": secondaryInstalled ? 1 : 0,
        "PCI_IDE0_SLAVE_IMAGE": secondaryPath,
        "PCI_IDE0_SLAVE_TYPE": secondaryType,
    };
    let configStr = arrayBufferToString(baseConfig);
    configStr = replacePlaceholders(configStr, replacements);
    return configStr;
}

function ramSizeToByteCount(ramSize: MachineDefRAMSize): number {
    let byteCount = parseInt(ramSize);
    if (ramSize.endsWith("M")) {
        byteCount *= 1024 * 1024;
    } else if (ramSize.endsWith("K")) {
        byteCount *= 1024;
    }
    return byteCount;
}
