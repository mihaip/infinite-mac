import {
    type MachineDef,
    type VideoDevice,
    machineSupportedScreenSizes,
} from "@/defs/machines";
import {type EmulatorDiskOverlay} from "@/emulator/common/common";

// Should match the value of the placeholder value from scripts/placeholders.py.
const PLACEHOLDER_SCRN_RESOURCE = new Uint8Array([
    0x00, 0x01, 0x42, 0x32, 0x00, 0x00, 0x08, 0x10, 0x00, 0x00, 0x00, 0x83,
    0x77, 0xfe, 0xa8, 0x01, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00,
    0x02, 0x58, 0x03, 0x20, 0x00, 0x00,
]);

type SnowVideoDevice = {
    hardwareId: number;
    slot: number;
    baseAddress: number;
    mode: number;
    fixedSize?: {width: number; height: number};
};

const SNOW_VIDEO_DEVICES: Record<VideoDevice, SnowVideoDevice> = {
    MDC12: {
        hardwareId: 0x19,
        slot: 0x09,
        baseAddress: 0xf9000000,
        mode: 0x83,
    },
    Toby: {
        hardwareId: 0x01,
        slot: 0x09,
        baseAddress: 0xf9900000,
        mode: 0x83,
        fixedSize: {width: 640, height: 480},
    },
    // The LC and LC II use the built-in V8 (Elsie) video driver in slot 0.
    V8: {
        hardwareId: 0x1a,
        slot: 0,
        baseAddress: 0x50f40000,
        mode: 0x83,
    },
    // The LC III's Sonora ROM already defaults to color, so it needs no overlay.
};

const BLACK_AND_WHITE_MONITORS = new Set(["PortraitBW", "TwoPageBW"]);

export function createScrnResourceOverlays(
    machine: MachineDef,
    screenWidth: number,
    screenHeight: number,
    offsets: number[]
): EmulatorDiskOverlay[] | undefined {
    if (machine.emulatorType !== "Snow" || machine.videoDevice === undefined) {
        return undefined;
    }
    const videoDevice = SNOW_VIDEO_DEVICES[machine.videoDevice];
    const monitor = machineSupportedScreenSizes(machine)?.find(
        size => size.width === screenWidth && size.height === screenHeight
    );
    if (monitor?.monitorId && BLACK_AND_WHITE_MONITORS.has(monitor.monitorId)) {
        return undefined;
    }
    const resourceWidth = videoDevice.fixedSize?.width ?? screenWidth;
    const resourceHeight = videoDevice.fixedSize?.height ?? screenHeight;

    const data = new Uint8Array(PLACEHOLDER_SCRN_RESOURCE.byteLength);
    const view = new DataView(data.buffer);
    view.setUint16(0, 1); // Number of devices
    view.setUint16(2, videoDevice.hardwareId); // Slot Manager hardware ID
    view.setUint16(4, videoDevice.slot);
    view.setUint32(6, videoDevice.baseAddress); // dCtlDevBase
    view.setUint16(10, videoDevice.mode); // Driver-specific 256-color mode
    view.setUint16(12, 0x77fe); // Device-state flag mask
    view.setUint16(14, 0xa801); // Active, main, color screen
    view.setUint16(16, 0xffff); // Default color table
    view.setUint16(18, 0xfffe); // ID -2 is for linear (uncorrected) gamma
    view.setUint16(20, 0); // Global rectangle: top
    view.setUint16(22, 0); // Global rectangle: left
    view.setUint16(24, resourceHeight); // Global rectangle: bottom
    view.setUint16(26, resourceWidth); // Global rectangle: right
    view.setUint16(28, 0); // No saved control calls

    return offsets.map(offset => ({
        offset,
        data,
        expected: PLACEHOLDER_SCRN_RESOURCE,
    }));
}
