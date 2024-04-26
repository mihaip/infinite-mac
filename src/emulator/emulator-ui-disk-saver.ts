import JSZip from "jszip";
import {saveAs} from "file-saver";
import {type EmulatorDiskDef} from "../disks";
import {dirtyChunksFileName, dataFileName} from "./emulator-common-disk-saver";
import {generateChunkUrl} from "./emulator-common";
import deviceImageHeaderPath from "../Data/Device Image Header (Apple SCSI 4.3 Driver).hda";
import {generateDeviceImageHeader} from "./emulator-common-device-image";

export async function resetDiskSaver(disk: EmulatorDiskDef) {
    const spec = (await disk.generatedSpec()).default;
    const opfsRoot = await navigator.storage.getDirectory();
    try {
        // Fastest way to reset is to delete the file that keeps track of dirty
        // chunks -- that way when we load the disk again, we'll only read the
        // base chunks.
        opfsRoot.removeEntry(dirtyChunksFileName(spec));
    } catch (err) {
        if (err instanceof DOMException && err.name === "NotFoundError") {
            // Expected if the file doesn't exist
            return;
        }
        console.warn("Could not remove dirty chunks file", err);
    }
}

export async function exportDiskSaver(disk: EmulatorDiskDef) {
    const spec = (await disk.generatedSpec()).default;
    const opfsRoot = await navigator.storage.getDirectory();

    const dirtyChunksName = dirtyChunksFileName(spec);
    const dirtyChunksHandle = await opfsRoot.getFileHandle(dirtyChunksName, {
        create: true,
    });
    const dataName = dataFileName(spec);
    const dataHandle = await opfsRoot.getFileHandle(dataName, {create: true});

    const zip = new JSZip();
    await zip.file(dirtyChunksName, dirtyChunksHandle.getFile());
    await zip.file(dataName, dataHandle.getFile());

    const zipBlob = await zip.generateAsync({
        compression: "DEFLATE",
        compressionOptions: {level: 1},
        type: "blob",
    });
    saveAs(zipBlob, spec.name + ".infinitemacdisk");
}

export async function importDiskSaver(disk: EmulatorDiskDef) {
    const importFile = await pickDiskSaverFile();

    const spec = (await disk.generatedSpec()).default;
    const dirtyChunksName = dirtyChunksFileName(spec);
    const dataName = dataFileName(spec);

    const zip = await JSZip.loadAsync(importFile);
    const dirtyChunksZipFile = zip.file(dirtyChunksName);
    if (!dirtyChunksZipFile) {
        throw new Error("Could not find dirty chunks file in import");
    }
    const dataZipFile = zip.file(dataName);
    if (!dataZipFile) {
        throw new Error("Could not find data file in import");
    }

    const opfsRoot = await navigator.storage.getDirectory();
    const dirtyChunksHandle = await opfsRoot.getFileHandle(dirtyChunksName, {
        create: true,
    });
    const dirtyChunksWritable = await dirtyChunksHandle.createWritable();
    await dirtyChunksWritable.write(await dirtyChunksZipFile.async("blob"));
    await dirtyChunksWritable.close();

    const dataHandle = await opfsRoot.getFileHandle(dataName, {create: true});
    const dataWritable = await dataHandle.createWritable();
    await dataWritable.write(await dataZipFile.async("blob"));
    await dataWritable.close();
}

function pickDiskSaverFile() {
    return new Promise<File>(resolve => {
        // It would be nice to use showOpenFilePicker, but it's not available in Safari.
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".infinitemacdisk";
        input.onchange = () => {
            if (input.files) {
                resolve(input.files[0]);
            }
            input.remove();
        };
        input.click();
    });
}

export async function saveDiskSaverImage(
    disk: EmulatorDiskDef,
    deviceImage?: boolean
) {
    const spec = (await disk.generatedSpec()).default;
    const opfsRoot = await navigator.storage.getDirectory();

    const dirtyChunksName = dirtyChunksFileName(spec);
    const dirtyChunksHandle = await opfsRoot.getFileHandle(dirtyChunksName, {
        create: true,
    });
    const dirtyChunksFile = await dirtyChunksHandle.getFile();
    const dirtyChunksArray = new Uint8Array(
        await dirtyChunksFile.arrayBuffer()
    );

    const dataName = dataFileName(spec);
    const dataHandle = await opfsRoot.getFileHandle(dataName, {create: true});
    const dataFile = await dataHandle.getFile();
    const dataArray = new Uint8Array(await dataFile.arrayBuffer());

    const image = new Uint8Array(spec.totalSize);
    image.set(dataArray);

    const chunkedSpec = {
        ...spec,
        baseUrl: "/Disk",
    };

    for (let chunkIndex = 0; chunkIndex < spec.chunks.length; chunkIndex++) {
        const chunkHash = spec.chunks[chunkIndex];
        if (!chunkHash) {
            // Source image chunk was zero-ed out, we don't need to do anything.
            continue;
        }
        const chunkByte = chunkIndex >> 3;
        const chunkBit = 1 << (chunkIndex & 7);
        if (dirtyChunksArray[chunkByte] & chunkBit) {
            // Chunk was dirty, we had already copied it.
            continue;
        }

        const chunkUrl = generateChunkUrl(chunkedSpec, chunkIndex);
        const chunk = await (await fetch(chunkUrl)).arrayBuffer();
        image.set(new Uint8Array(chunk), chunkIndex * spec.chunkSize);
    }

    if (deviceImage) {
        const baseDeviceImageHeader = await (
            await fetch(deviceImageHeaderPath)
        ).arrayBuffer();
        const deviceImageHeader = generateDeviceImageHeader(
            baseDeviceImageHeader,
            spec.totalSize
        );
        saveAs(new Blob([deviceImageHeader, image]), spec.name + ".hda");
        return;
    }

    saveAs(new Blob([image]), spec.name + ".dsk");
}
