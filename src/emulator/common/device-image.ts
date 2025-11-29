const BLOCK_SIZE = 512;

// Partition blocks defined in the base header
// 0: Apple_partition_map
// 1: Apple_Driver43
// 2: Apple_Driver43
// 3: Apple_Driver_ATA
// 4: Apple_Driver_ATA
// 5: Apple_FWDriver
// 6: Apple_Driver_IOKit
// 7: Apple_Patches
// 8: Apple_HFS
const ALL_DRIVERS_HFS_PARTITION_INDEX = 8;

// Partition blocks defined in the base header
// 0: Apple_partition_map
// 1: Apple_Driver43
// 2: Apple_HFS
const APPLE_SCSI_43_DRIVER_PARTITION_INDEX = 2;

// +1 to account for for block 0 with the device information
const ALL_DRIVERS_HFS_PARTITION_OFFSET =
    (ALL_DRIVERS_HFS_PARTITION_INDEX + 1) * BLOCK_SIZE;
const APPLE_SCSI_43_DRIVER_PARTITION_OFFSET =
    (APPLE_SCSI_43_DRIVER_PARTITION_INDEX + 1) * BLOCK_SIZE;

export function generateDeviceImageHeader(
    baseHeader: ArrayBuffer,
    hfsPartitionSize: number,
    isAllDrivers: boolean
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

    const partitionOffset = isAllDrivers
        ? ALL_DRIVERS_HFS_PARTITION_OFFSET
        : APPLE_SCSI_43_DRIVER_PARTITION_OFFSET;

    const hfsBlocks = hfsPartitionSize / BLOCK_SIZE;
    headerView.setInt32(partitionOffset + 12, hfsBlocks); // pmPartBlkCnt
    headerView.setInt32(partitionOffset + 84, hfsBlocks); // pmDataCnt

    return header;
}
