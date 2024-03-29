#!/usr/bin/env python3

import os.path
import paths
import struct
import sys

# Python version of generateDeviceImageHeader to convert a bare HFS partition
# into a full device image. See comments in emulator-common-device-image.ts for
# more information.
BLOCK_SIZE = 512
HFS_PARTITION_INDEX = 8
HFS_PARTITION_OFFSET = (HFS_PARTITION_INDEX + 1) * BLOCK_SIZE

DEVICE_IMAGE_HEADER_PATH = os.path.join(paths.DATA_DIR, "Device Image Header.hda")

def main():
    if len(sys.argv) != 3:
        print("Usage: %s <input_image> <output_image>" % sys.argv[0])
        sys.exit(1)

    input_image_path, output_image_path = sys.argv[1:]

    with open(DEVICE_IMAGE_HEADER_PATH, "rb") as header_file:
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
    struct.pack_into(">I", header, HFS_PARTITION_OFFSET + 12, hfs_blocks)  # pmPartBlkCnt, big-endian
    struct.pack_into(">I", header, HFS_PARTITION_OFFSET + 84, hfs_blocks)  # pmDataCnt, big-endian

    with open(output_image_path, "wb") as output_image_file:
        output_image_file.write(header)
        output_image_file.write(input_image)

if __name__ == "__main__":
    main()
