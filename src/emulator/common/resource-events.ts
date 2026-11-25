import {type OpenFileInfo} from "@/emulator/common/toolbox/files";

export type ResourceLoadEvent = {
    id: number;
    timestamp: number;
    type: string;
    resourceId: number;
    /** Application executing at capture time; not necessarily the foreground app. */
    processName?: string;
    isRom?: boolean;
    name?: string;
    file?: OpenFileInfo & {path?: string};
    data: Uint8Array;
};

export type ResourceEventsMessage = {
    type: "emulator_resource_events";
    events: ResourceLoadEvent[];
    oversizedCount: number;
    unavailableCount: number;
};
