export type PreviewStatus =
    | "Queued"
    | "Starting"
    | "Running"
    | "Paused"
    | "Matched"
    | "Timed out"
    | "Needs target"
    | "Stopped"
    | "Exited"
    | "Error";

export const isPreviewActive = (status: PreviewStatus) =>
    status === "Starting" || status === "Running";

export function previewConcurrency(cores: number = 4): number {
    return Math.max(4, Math.min(8, Math.floor(cores / 2) || 4));
}

/** Admit one preview per governor tick, reserving its slot before it loads. */
export function admitPreview(
    statuses: Record<string, PreviewStatus>,
    ids: string[],
    limit: number
): Record<string, PreviewStatus> {
    if (Object.values(statuses).filter(isPreviewActive).length >= limit)
        return statuses;
    const id = ids.find(id => statuses[id] === "Queued");
    if (!id) return statuses;
    return {...statuses, [id]: "Starting"};
}
