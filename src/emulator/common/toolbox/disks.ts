/**
 * Sector data for filesystem readers, without disk image container headers.
 */
export type ReadableDisk = {
    readonly size: number;
    read(buffer: Uint8Array, offset: number, length: number): number;
};
