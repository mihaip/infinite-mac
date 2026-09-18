import deviceImageHeaderAllDriversPath from "@/Data/Device Image Header (All Drivers).hda";
import deviceImageHeaderAppleScsi43DriverPath from "@/Data/Device Image Header (Apple SCSI 4.3 Driver).hda";
import deviceImageHeaderAppleScsi15DriverPath from "@/Data/Device Image Header (Apple SCSI 1.5 Driver).hda";
import {DeviceImageType} from "@/emulator/common/device-image";
import {type EmulatorType} from "@/emulator/common/emulators";
import {type MachineDef} from "@/defs/machines";

const BLOCK_SIZE = 512;

type DeviceImageDef = {
    hfsPartitionIndex: number;
    headerPath: string;
};

const DEVICE_IMAGE_DEFS: {[type in DeviceImageType]: DeviceImageDef} = {
    [DeviceImageType.AllDrivers]: {
        // 0: Apple_partition_map
        // 1: Apple_Driver43
        // 2: Apple_Driver43
        // 3: Apple_Driver_ATA
        // 4: Apple_Driver_ATA
        // 5: Apple_FWDriver
        // 6: Apple_Driver_IOKit
        // 7: Apple_Patches
        // 8: Apple_HFS
        hfsPartitionIndex: 8,
        headerPath: deviceImageHeaderAllDriversPath,
    },
    [DeviceImageType.AppleSCSI43Driver]: {
        // 0: Apple_partition_map
        // 1: Apple_Driver43
        // 2: Apple_HFS
        hfsPartitionIndex: 2,
        headerPath: deviceImageHeaderAppleScsi43DriverPath,
    },
    [DeviceImageType.AppleSCSI15Driver]: {
        // Older-style layout where the driver is in the device descriptor block
        // 0.
        // 0: Apple_HFS
        hfsPartitionIndex: 0,
        headerPath: deviceImageHeaderAppleScsi15DriverPath,
    },
};
export function emulatorDeviceImage(
    type: EmulatorType,
    machine: MachineDef
): DeviceImageType | null {
    switch (type) {
        case "DingusPPC":
        case "PearPC":
            return DeviceImageType.AllDrivers;
        case "Snow":
            return machine.requiresCompactSCSIDriver
                ? DeviceImageType.AppleSCSI15Driver
                : DeviceImageType.AppleSCSI43Driver;
        default:
            return null;
    }
}

export function getDeviceImageHeaderPath(type: DeviceImageType | null): string {
    const def =
        type !== null
            ? DEVICE_IMAGE_DEFS[type]
            : DEVICE_IMAGE_DEFS[DeviceImageType.AllDrivers];
    return def.headerPath;
}

export function getDeviceImageHFSPartitionNumber(type: DeviceImageType): number {
    // Apple Partition Map numbers are one-based.
    return DEVICE_IMAGE_DEFS[type].hfsPartitionIndex + 1;
}

export function generateDeviceImageHeader(
    baseHeader: ArrayBuffer,
    hfsPartitionSize: number,
    type: DeviceImageType
): ArrayBuffer {
    const headerSize = baseHeader.byteLength;
    if (headerSize !== 0xe4000) {
        console.warn(
            "Expected base header to be 0xE4000 bytes, got 0x" +
                headerSize.toString(16) +
                " bytes, results may be unpredictable"
        );
    }
    const header = baseHeader.slice(0);
    const headerView = new DataView(header);

    const totalSize = hfsPartitionSize + headerSize;
    const totalBlocks = totalSize / BLOCK_SIZE;
    headerView.setInt32(0x4, totalBlocks); // sbBlkCount

    // +1 to account for for block 0 with the device information
    const hfsPartitionOffset =
        (DEVICE_IMAGE_DEFS[type].hfsPartitionIndex + 1) * BLOCK_SIZE;

    const hfsBlocks = hfsPartitionSize / BLOCK_SIZE;
    headerView.setInt32(hfsPartitionOffset + 12, hfsBlocks); // pmPartBlkCnt
    headerView.setInt32(hfsPartitionOffset + 84, hfsBlocks); // pmDataCnt

    return header;
}
