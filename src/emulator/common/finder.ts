export enum FinderFlags {
    kIsOnDesk = 0x0001,
    kColor = 0x000e,
    kIsShared = 0x0040,
    kHasBeenInited = 0x0100,
    kHasCustomIcon = 0x0400,
    kIsStationery = 0x0800,
    kNameLocked = 0x1000,
    kHasBundle = 0x2000,
    kIsInvisible = 0x4000,
    kIsAlias = 0x8000,
}

export enum FInfoFields {
    fdType = 0,
    fdCreator = 4,
    fdFlags = 8,
    fdLocation = 10,
    fdFldr = 14,
    SIZEOF_FInfo = 16,
}

export enum DInfoFields {
    frRect = 0,
    frFlags = 8,
    frLocation = 10,
    frView = 14,
    SIZEOF_DInfo = 16,
}

/**
 * Decodes a .finfo file containing an FInfo struct based on the encoding
 * specified in BasiliskII/src/include/extfs_defs.h and
 * https://web.archive.org/web/20040918142656/http://developer.apple.com/documentation/Carbon/Reference/Finder_Interface/finder_interface/data_type_8.html
 */
export function getDebugFinderInfo(buffer: ArrayBuffer): {[key: string]: any} {
    function toChars(long: number): string {
        return (
            String.fromCharCode((long >> 24) & 0xff) +
            String.fromCharCode((long >> 16) & 0xff) +
            String.fromCharCode((long >> 8) & 0xff) +
            String.fromCharCode((long >> 0) & 0xff)
        );
    }
    const fInfoView = new DataView(buffer);
    return {
        typeCode: toChars(fInfoView.getInt32(FInfoFields.fdType)),
        creatorCode: toChars(fInfoView.getInt32(FInfoFields.fdCreator)),
        flags: getDebugFinderFlags(fInfoView.getInt16(FInfoFields.fdFlags)),
        location: {
            x: fInfoView.getInt16(FInfoFields.fdLocation),
            y: fInfoView.getInt16(FInfoFields.fdLocation + 2),
        },
        folder: fInfoView.getInt16(FInfoFields.fdFldr),
    };
}

/**
 * Decodes a DInfo file containing an DInfo struct based on the encoding
 * specified in BasiliskII/src/include/extfs_defs.h and
 * https://web.archive.org/web/20040711004644if_/http://developer.apple.com/documentation/Carbon/Reference/Finder_Interface/finder_interface/data_type_4.html
 */
export function getDebugFolderInfo(buffer: ArrayBuffer): {[key: string]: any} {
    const fInfoView = new DataView(buffer);
    return {
        rect: {
            x: fInfoView.getInt16(DInfoFields.frRect),
            y: fInfoView.getInt16(DInfoFields.frRect + 2),
            width: fInfoView.getInt16(DInfoFields.frRect + 4),
            height: fInfoView.getInt16(DInfoFields.frRect + 6),
        },
        flags: getDebugFinderFlags(fInfoView.getInt16(DInfoFields.frFlags)),
        location: {
            x: fInfoView.getInt16(DInfoFields.frLocation),
            y: fInfoView.getInt16(DInfoFields.frLocation + 2),
        },
        view: fInfoView.getInt16(DInfoFields.frView),
    };
}

function getDebugFinderFlags(flags: number): string[] {
    const result = [];
    for (const [flagName, flag] of Object.entries(FinderFlags)) {
        if (typeof flag === "number" && flags & flag) {
            result.push(flagName);
        }
    }
    return result;
}

/**
 * Given a serialized FInfo struct, checks to see if the location data is
 * present. If it's not, it clears the "has been inited" flag so that the Finder
 * assigns a position to the item when it loads it.
 */
export function fixArchiveFinderInfo(buffer: ArrayBuffer) {
    const fInfoView = new DataView(buffer);
    const x = fInfoView.getInt16(FInfoFields.fdLocation);
    const y = fInfoView.getInt16(FInfoFields.fdLocation + 2);
    if (x === 0 && y === 0) {
        let flags = fInfoView.getInt16(FInfoFields.fdFlags);
        flags &= ~FinderFlags.kHasBeenInited;
        fInfoView.setInt16(FInfoFields.fdFlags, flags);
    }
}
