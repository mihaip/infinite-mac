export type ResourceLoadEvent = {
    id: number;
    timestamp: number;
    type: string;
    resourceId: number;
    name?: string;
    file?: {
        refNum: number;
        name?: string;
        volumeName?: string;
        parentId?: number;
    };
    data: Uint8Array;
};

export type ResourceEventsMessage = {
    type: "emulator_resource_events";
    events: ResourceLoadEvent[];
    oversizedCount: number;
    unavailableCount: number;
};
