import {type EmulatorCDROM} from "./emulator-common";

export async function fetchCDROM(
    cdrom: EmulatorCDROM,
    onProgress: (fraction: number) => void
): Promise<EmulatorCDROM> {
    const response = await fetch(cdrom.srcUrl);
    if (!response.ok) {
        const body = await response.text();
        throw new Error(
            `Could not fetch CD-ROM, status=${response.status}, body=${body}`
        );
    }
    if (!response.body) {
        throw new Error("Could not fetch CD-ROM, no response body");
    }

    onProgress(0);

    const reader = response.body.getReader();
    let loaded = 0;
    const stream = new ReadableStream({
        async start(controller) {
            for (;;) {
                const {done, value} = await reader.read();
                if (done) {
                    break;
                }
                loaded += value.length;
                onProgress(loaded / cdrom.fileSize);
                controller.enqueue(value);
            }
            controller.close();
        },
    });

    const blob = await new Response(stream).blob();
    onProgress(1.0);
    const blobURL = URL.createObjectURL(blob);
    return {
        ...cdrom,
        srcUrl: blobURL,
    };
}
