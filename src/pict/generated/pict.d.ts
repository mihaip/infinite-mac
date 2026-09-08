export interface PictModule {
    HEAPU8: Uint8Array;
    HEAPU32: Uint32Array;
    _pict_allocate(length: number): number;
    _pict_free(pointer: number, length: number): void;
    _pict_decode(pointer: number, length: number, result: number): number;
}
export default function createPictRenderer(options: {
    locateFile: (path: string) => string;
}): Promise<PictModule>;
