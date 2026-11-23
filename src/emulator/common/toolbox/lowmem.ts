// Classic Mac OS low-memory globals, using the names from Apple's LowMem.h.
export const LowMem = {
    SysVersion: 0x015a,
    Lo3Bytes: 0x031a,
    FCBSPtr: 0x034e,
    FSFCBLen: 0x03f6,
    TopMapHndl: 0x0a50,
    MMU32Bit: 0x0cb2,
} as const;
