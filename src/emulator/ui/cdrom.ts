import {fetchWithProgress} from "@/lib/fetch";
import {type EmulatorCDROM} from "@/emulator/common/common";

export async function fetchCDROM(
    cdrom: EmulatorCDROM,
    onProgress: (fraction: number) => void
): Promise<EmulatorCDROM> {
    const blob = await fetchWithProgress(cdrom.srcUrl, loaded =>
        onProgress(loaded / cdrom.fileSize)
    );
    const blobURL = URL.createObjectURL(blob);
    return {
        ...cdrom,
        srcUrl: blobURL,
    };
}
