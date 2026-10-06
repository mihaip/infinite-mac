import {
    type EmulatorDiskOverlay,
    type EmulatorChunkedFileSpec,
} from "@/emulator/common/common";

export function createBeOSScreenSettingsOverlays(
    screenWidth: number,
    screenHeight: number,
    settings: NonNullable<EmulatorChunkedFileSpec["beosScreenSettings"]>
): EmulatorDiskOverlay[] {
    const mode = BEOS_SCREEN_MODES.find(
        mode => mode.width === screenWidth && mode.height === screenHeight
    );
    if (!mode) {
        return [];
    }
    const legacy = settings.legacyOffsets.map(offset => {
        const data = new Uint8Array(4);
        new DataView(data.buffer).setUint32(0, mode.mask);
        return {offset, data};
    });
    const timing = settings.timingRegions.flatMap(({offset, length}) => {
        // The PPC driver's modes use a 60 Hz timing with 25% blanking, a
        // horizontal sync at 9/8 width, and a vertical sync at 9/8 height.
        // These reproduce the saved 640x480 and 800x600 timings from BeOS.
        const {width, height} = mode;
        const hTotal = (width * 5) / 4;
        const vTotal = (height * 5) / 4;
        const hSync = (width * 9) / 8;
        const vSync = (height * 9) / 8;
        const pixelClock = (hTotal * vTotal * 60) / 1000;
        const text = `timing ${pixelClock} ${width} ${hSync} ${hSync + 8} ${hTotal} ${height} ${vSync} ${vSync + 1} ${vTotal} 0x0\ncolorspace 0x4\nvirtual ${width} ${height}`;
        const encoded = new TextEncoder().encode(text);
        if (encoded.length > length) {
            console.warn("BeOS screen settings region is too small", {
                offset,
                length,
            });
            return [];
        }
        const data = new Uint8Array(length).fill(0x20);
        data.set(encoded);
        return [{offset, data}];
    });
    return [...legacy, ...timing];
}

// Screen_settings mode masks from BeOS's GraphicsDefs.h. These modes work
// with both generations of BeOS display drivers on the Power Macintosh 7300.
const BEOS_SCREEN_MODES = [
    {width: 1600, height: 1200, mask: 0x00000010},
    {width: 1280, height: 1024, mask: 0x00000008},
    {width: 1024, height: 768, mask: 0x00000004},
    {width: 800, height: 600, mask: 0x00000002},
    {width: 640, height: 480, mask: 0x00000001},
];
