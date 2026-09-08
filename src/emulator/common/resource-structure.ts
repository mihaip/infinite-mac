// TMPL-inspired, JSON-serializable field trees. These describe resource bytes,
// not guest-memory records; no pointers are followed and no guest code runs.
// Layout reference: Inside Macintosh / ResEdit Reference, and resource_dasm:
// https://github.com/fuzziqersoftware/resource_dasm/blob/master/src/ResourceFile.cc
export interface ResourceField {
    name: string;
    kind: string;
    offset: number;
    length: number;
    value?: string | number | boolean;
    referenceType?: string;
    children?: ResourceField[];
}
export interface ResourceStructure {
    type: string;
    fields: ResourceField[];
    warning?: string;
}

type Scalar = "i16" | "u16" | "u8" | "u32" | "bool16" | "pstring" | "rect";
type FieldDescription = readonly [
    name: string,
    kind: Scalar,
    referenceType?: string,
];
const windowFields: FieldDescription[] = [
    ["Bounds", "rect"],
    ["Definition ID", "i16"],
    ["Visible", "bool16"],
    ["Close box", "bool16"],
    ["Reference constant", "u32"],
];
const descriptions: Record<string, FieldDescription[]> = {
    ALRT: [
        ["Bounds", "rect"],
        ["Item list", "i16", "DITL"],
        ["Stage flags", "u16"],
    ],
    DLOG: [...windowFields, ["Item list", "i16", "DITL"], ["Title", "pstring"]],
    WIND: [...windowFields, ["Title", "pstring"]],
    CNTL: [
        ["Bounds", "rect"],
        ["Value", "i16"],
        ["Visible", "bool16"],
        ["Maximum", "i16"],
        ["Minimum", "i16"],
        ["Definition ID", "i16"],
        ["Reference constant", "u32"],
        ["Title", "pstring"],
    ],
    MENU: [
        ["Menu ID", "i16"],
        ["Width", "i16"],
        ["Height", "i16"],
        // The Resource Manager replaces the on-disk MDEF ID/reserved pair
        // with a definition handle when the menu is loaded.
        ["Definition slot (ID / handle)", "u32"],
        ["Enable flags", "u32"],
        ["Title", "pstring"],
    ],
};
const macRoman = new TextDecoder("macintosh");
const itemNames: Record<number, string> = {
    0: "User item",
    1: "Help item",
    4: "Button",
    5: "Checkbox",
    6: "Radio button",
    7: "Control",
    8: "Static text",
    16: "Editable text",
    32: "Icon",
    64: "Picture",
};

class Reader {
    offset = 0;
    nodes = 0;
    constructor(readonly data: Uint8Array) {}
    take(length: number) {
        if (this.offset + length > this.data.length)
            throw new Error(
                `Incomplete field at byte ${this.offset}: needs ${length} bytes.`
            );
        const bytes = this.data.subarray(this.offset, this.offset + length);
        this.offset += length;
        return bytes;
    }
    number(length: number, signed = false): number {
        const bytes = this.take(length);
        let value = 0;
        for (const byte of bytes) value = value * 256 + byte;
        return signed && bytes[0] & 128 ? value - 2 ** (length * 8) : value;
    }
    field(
        name: string,
        kind: string,
        read: () => Pick<ResourceField, "value" | "children" | "referenceType">
    ): ResourceField {
        if (++this.nodes > 4096)
            throw new Error("Structured preview limit reached.");
        const offset = this.offset;
        const result = read();
        return {name, kind, offset, length: this.offset - offset, ...result};
    }
    scalar([name, kind, referenceType]: FieldDescription): ResourceField {
        return this.field(name, kind, () => {
            if (kind === "rect")
                return {
                    children: ["Top", "Left", "Bottom", "Right"].map(n =>
                        this.scalar([n, "i16"])
                    ),
                };
            if (kind === "pstring")
                return {value: macRoman.decode(this.take(this.number(1)))};
            const value = this.number(
                kind === "u8" ? 1 : kind === "u32" ? 4 : 2,
                kind === "i16"
            );
            return {
                value: kind === "bool16" ? value !== 0 : value,
                ...(referenceType ? {referenceType} : {}),
            };
        });
    }
    align() {
        if (this.offset % 2) this.take(1);
    }
}

export function resourceStructure(
    type: string,
    data: Uint8Array
): ResourceStructure | undefined {
    if (
        !Object.hasOwn(descriptions, type) &&
        type !== "DITL" &&
        type !== "MBAR"
    )
        return undefined;
    const r = new Reader(data);
    const result: ResourceStructure = {type, fields: []};
    const fields = result.fields;
    try {
        for (const description of descriptions[type] ?? [])
            fields.push(r.scalar(description));
        if (["ALRT", "DLOG", "WIND"].includes(type) && r.offset < data.length) {
            r.align();
            if (r.offset < data.length)
                fields.push(r.scalar(["Positioning", "u16"]));
        }
        if (type === "MENU") {
            const flags = fields.find(f => f.name === "Enable flags")!
                .value as number;
            const items: ResourceField[] = [];
            const list = {
                name: "Items",
                kind: "list",
                offset: r.offset,
                length: 0,
                children: items,
            };
            fields.push(list);
            while (true) {
                if (r.offset >= data.length)
                    throw new Error("Missing menu item terminator.");
                if (data[r.offset] === 0) {
                    r.take(1);
                    break;
                }
                const index = items.length + 1;
                items.push(
                    r.field(`Item ${index}`, "group", () => {
                        const children = [
                            r.scalar(["Title", "pstring"]),
                            r.scalar(["Icon number", "u8"]),
                            r.scalar(["Key equivalent", "u8"]),
                            r.scalar(["Mark character", "u8"]),
                            r.scalar(["Style flags", "u8"]),
                        ];
                        children.push({
                            name: "Enabled",
                            kind: "boolean",
                            offset: 10,
                            length: 4,
                            value: index > 31 || !!(flags & (2 ** index)),
                        });
                        return {children};
                    })
                );
                list.length = r.offset - list.offset;
            }
            list.length = r.offset - list.offset;
        }
        if (type === "DITL" || type === "MBAR") {
            const count = r.scalar([
                type === "DITL" ? "Item count minus one" : "Menu count",
                "u16",
            ]);
            fields.push(count);
            const rawCount = count.value as number;
            const n =
                type === "DITL"
                    ? rawCount === 65535
                        ? 0
                        : rawCount + 1
                    : rawCount;
            for (let i = 0; i < n; i++) {
                if (type === "MBAR") {
                    fields.push(r.scalar([`Menu ${i + 1}`, "i16", "MENU"]));
                    continue;
                }
                fields.push(
                    r.field(`Item ${i + 1}`, "group", () => {
                        const children = [
                            r.scalar(["Reserved handle", "u32"]),
                            r.scalar(["Bounds", "rect"]),
                        ];
                        const itemType = r.scalar(["Item type", "u8"]);
                        const raw = itemType.value as number;
                        const kind = raw & 127;
                        itemType.value = `${itemNames[kind] ?? "Unknown"} (${kind})`;
                        children.push(itemType, {
                            name: "Disabled",
                            kind: "boolean",
                            offset: itemType.offset,
                            length: 1,
                            value: !!(raw & 128),
                        });
                        const size = r.scalar(["Data length", "u8"]);
                        children.push(size);
                        const length = size.value as number;
                        const referenceType = (
                            {7: "CNTL", 32: "ICON", 64: "PICT"} as Record<
                                number,
                                string
                            >
                        )[kind];
                        children.push(
                            r.field(
                                referenceType ? "Resource" : "Data",
                                referenceType ? "reference" : "bytes",
                                () => {
                                    if (referenceType && length === 2)
                                        return {
                                            value: r.number(2, true),
                                            referenceType,
                                        };
                                    const bytes = r.take(length);
                                    return {
                                        value: [4, 5, 6, 8, 16].includes(kind)
                                            ? macRoman.decode(bytes)
                                            : Array.from(bytes, b =>
                                                  b
                                                      .toString(16)
                                                      .padStart(2, "0")
                                              ).join(" "),
                                    };
                                }
                            )
                        );
                        r.align();
                        return {children};
                    })
                );
            }
        }
        if (r.offset < data.length)
            result.warning = `${data.length - r.offset} trailing bytes are not described; see Hex & ASCII.`;
    } catch (error) {
        result.warning =
            error instanceof Error ? error.message : "Invalid resource data.";
    }
    return result;
}
