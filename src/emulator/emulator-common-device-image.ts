const BLOCK_SIZE = 512;

export function generateDeviceImageHeader(
    baseHeader: ArrayBuffer,
    hfsPartitionSize: number
): ArrayBuffer {
    const headerSize = baseHeader.byteLength;
    if (headerSize !== 0xc000) {
        console.warn(
            "Expected base header to be 0xc000 bytes, got 0x" +
                headerSize.toString(16) +
                " bytes, results may be unpredictable"
        );
    }
    const header = baseHeader.slice(0);
    const headerView = new DataView(header);

    const totalSize = hfsPartitionSize + headerSize;
    const totalBlocks = totalSize / BLOCK_SIZE;
    headerView.setInt32(0x4, totalBlocks); // sbBlkCount

    const hfsBlocks = hfsPartitionSize / BLOCK_SIZE;
    headerView.setInt32(0x060c, hfsBlocks); // pmPartBlkCnt?
    headerView.setInt32(0x0654, hfsBlocks); // pmDataCnt?

    return header;
}
