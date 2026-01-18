#!/usr/bin/env python3

import os.path
import paths
import struct
import sys

# Python version of generateDeviceImageHeader to convert a bare HFS partition
# into a full device image. See comments in emulator-common-device-image.ts for
# more information.
BLOCK_SIZE = 512

ALL_DRIVERS_DEVICE_IMAGE_HEADER_PATH = os.path.join(
    paths.DATA_DIR, "Device Image Header (All Drivers).hda"
)
ALL_DRIVERS_HFS_PARTITION_INDEX = 8

SCSI_4_3_DRIVER_DEVICE_IMAGE_HEADER_PATH = os.path.join(
    paths.DATA_DIR, "Device Image Header (Apple SCSI 4.3 Driver).hda"
)
SCSI_4_3_DRIVER_HFS_PARTITION_INDEX = 2


def main():
    if len(sys.argv) not in (3, 4):
        print("Usage: %s <input_image> <output_image>" % sys.argv[0])
        sys.exit(1)

    input_image_path, output_image_path = sys.argv[1:3]
    uses_scsi_4_3_driver = len(sys.argv) == 4 and sys.argv[3] == "--scsi-4.3-driver"

    if uses_scsi_4_3_driver:
        image_header_path = SCSI_4_3_DRIVER_DEVICE_IMAGE_HEADER_PATH
        hfs_partition_index = SCSI_4_3_DRIVER_HFS_PARTITION_INDEX
    else:
        image_header_path = ALL_DRIVERS_DEVICE_IMAGE_HEADER_PATH
        hfs_partition_index = ALL_DRIVERS_HFS_PARTITION_INDEX

    with open(image_header_path, "rb") as header_file:
        header = header_file.read()
    header_size = len(header)

    with open(input_image_path, "rb") as input_image_file:
        input_image = input_image_file.read()
    hfs_partition_size = len(input_image)

    total_size = hfs_partition_size + header_size
    total_blocks = total_size // BLOCK_SIZE
    header = bytearray(header)
    struct.pack_into(">I", header, 0x4, total_blocks)  # sbBlkCount, big-endian

    hfs_blocks = hfs_partition_size // BLOCK_SIZE
    hfs_partition_offset = (hfs_partition_index + 1) * BLOCK_SIZE
    struct.pack_into(
        ">I", header, hfs_partition_offset + 12, hfs_blocks
    )  # pmPartBlkCnt, big-endian
    struct.pack_into(
        ">I", header, hfs_partition_offset + 84, hfs_blocks
    )  # pmDataCnt, big-endian

    with open(output_image_path, "wb") as output_image_file:
        output_image_file.write(header)
        output_image_file.write(input_image)


if __name__ == "__main__":
    main()
