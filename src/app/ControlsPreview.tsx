import {useState} from "react";
import {
    AppearanceProvider,
    appearanceSystemFont,
    type Appearance,
    type AppearanceVariant,
} from "@/controls/Appearance";
import {Button} from "@/controls/Button";
import {BevelButton} from "@/controls/BevelButton";
import {Checkbox} from "@/controls/Checkbox";
import {Dialog, DialogFrame} from "@/controls/Dialog";
import {
    Drawer,
    DrawerContents,
    DrawerHeader,
    DrawerList,
    DrawerListCategory,
    DrawerLoading,
    DrawersContainer,
} from "@/controls/Drawer";
import {Group} from "@/controls/Group";
import {Input} from "@/controls/Input";
import {Select} from "@/controls/Select";
import {TextArea} from "@/controls/TextArea";
import {ScreenFrame, type ScreenFrameProps} from "@/controls/ScreenFrame";
import cdromIcon from "@/Images/CD-ROM.png";
import "@/app/MacLibraryContents.css";
import "@/app/ControlsPreview.css";

// Each appearance gets its default rendering as well as any named variants.
const VARIANTS: {[key in Appearance]: AppearanceVariant[]} = {
    Classic: ["System7"],
    Platinum: [],
    NeXT: [],
    BeOS: [],
    Aqua: [],
};

export default function ControlsPreview() {
    return (
        <main className="ControlsPreview">
            <header className="ControlsPreview-Header">
                <h1>Controls</h1>
            </header>
            <div className="ControlsPreview-Columns">
                {(Object.keys(VARIANTS) as Appearance[]).flatMap(appearance =>
                    [undefined, ...VARIANTS[appearance]].map(variant => (
                        <AppearanceProvider
                            key={previewName(appearance, variant)}
                            appearance={appearance}
                            variant={variant}>
                            <AppearancePreview
                                appearance={appearance}
                                variant={variant}
                            />
                        </AppearanceProvider>
                    ))
                )}
            </div>
            <section className="ControlsPreview-Screens">
                <h2>Screen frames</h2>
                <div className="ControlsPreview-Columns">
                    {(["Beige", "Platinum", "Pinstripes", "NeXT"] as const).map(
                        bezelStyle => (
                            <ScreenPreview
                                key={bezelStyle}
                                bezelStyle={bezelStyle}
                            />
                        )
                    )}
                </div>
            </section>
        </main>
    );
}

function previewName(appearance: Appearance, variant?: AppearanceVariant) {
    return variant ? `${appearance}-${variant}` : appearance;
}

function AppearancePreview({
    appearance,
    variant,
}: {
    appearance: Appearance;
    variant?: AppearanceVariant;
}) {
    const [dialogVisible, setDialogVisible] = useState(false);
    const [status, setStatus] = useState("Ready");
    const name = previewName(appearance, variant);
    const closeDialog = (result: string) => {
        setStatus(result);
        setDialogVisible(false);
    };
    return (
        <section className="ControlsPreview-Appearance">
            <h2>{variant ? `${appearance} · System 7` : appearance}</h2>
            <DialogFrame className="ControlsPreview-Frame">
                <h1 className={appearanceSystemFont(appearance)}>
                    Sample dialog frame
                </h1>
                <p>Buttons, fields, and groups share this appearance.</p>
                <Group label="Buttons">
                    <div className="ControlsPreview-Row">
                        <Button onClick={() => setStatus("Button clicked")}>
                            Button
                        </Button>
                        <Button className="Control-Active">Pressed</Button>
                        <Button
                            defaultButton
                            onClick={() => setStatus("Default clicked")}>
                            Default
                        </Button>
                        <Button defaultButton className="Control-Active">
                            Pressed default
                        </Button>
                        <Button disabled>Disabled</Button>
                        <Button onClick={() => setDialogVisible(true)}>
                            Open dialog…
                        </Button>
                    </div>
                </Group>
                <Group label="List headers (bevel buttons)">
                    <ListPreview appearance={appearance} />
                </Group>
                <Group label="Checkboxes">
                    <div className="ControlsPreview-Row">
                        <label>
                            <Checkbox />
                            Unchecked
                        </label>
                        <label>
                            <Checkbox defaultChecked />
                            Checked
                        </label>
                        <label>
                            <Checkbox
                                className="Control-Active"
                                checked={false}
                                readOnly
                            />
                            Pressed unchecked
                        </label>
                        <label>
                            <Checkbox
                                className="Control-Active"
                                checked
                                readOnly
                            />
                            Pressed checked
                        </label>
                        <label>
                            <Checkbox disabled />
                            Disabled
                        </label>
                        <label>
                            <Checkbox defaultChecked disabled />
                            Checked, disabled
                        </label>
                    </div>
                </Group>
                <Group label="Text fields">
                    <div className="ControlsPreview-Fields">
                        <label>
                            Text <Input defaultValue="Infinite Mac" />
                        </label>
                        <label>
                            Placeholder <Input placeholder="Type here…" />
                        </label>
                        <label>
                            Number <Input type="number" defaultValue={42} />
                        </label>
                        <label>
                            Invalid number{" "}
                            <Input type="number" min={0} defaultValue={-1} />
                        </label>
                        <label>
                            Read only <Input readOnly value="Read only" />
                        </label>
                        <label>
                            Disabled <Input disabled value="Disabled" />
                        </label>
                    </div>
                    <label className="ControlsPreview-TextArea">
                        Text area
                        <TextArea
                            rows={2}
                            defaultValue={
                                "The quick brown fox jumps over the lazy dog.\n0123456789"
                            }
                        />
                    </label>
                    <label className="ControlsPreview-TextArea">
                        Disabled text area
                        <TextArea rows={2} disabled value="Disabled text" />
                    </label>
                </Group>
                <Group label="Selects">
                    <div className="ControlsPreview-Row">
                        <label>
                            Resolution{" "}
                            <Select defaultValue="800">
                                <option value="640">640 × 480</option>
                                <option value="800">800 × 600</option>
                                <option value="1024">1024 × 768</option>
                            </Select>
                        </label>
                        <label>
                            Disabled{" "}
                            <Select disabled>
                                <option>800 × 600</option>
                            </Select>
                        </label>
                        <label>
                            Pressed{" "}
                            <Select
                                className="Control-Active"
                                defaultValue="800">
                                <option value="640">640 × 480</option>
                                <option value="800">800 × 600</option>
                                <option value="1024">1024 × 768</option>
                            </Select>
                        </label>
                    </div>
                </Group>
                <p className="ControlsPreview-Status" role="status">
                    {status}
                </p>
            </DialogFrame>
            {[false, true].map(active => (
                <div className="ControlsPreview-Drawer" key={String(active)}>
                    <DrawersContainer>
                        <Drawer
                            title={active ? "Pressed CD-ROMs" : "CD-ROMs"}
                            titleClassName={
                                active ? "Control-Active" : undefined
                            }
                            titleIconUrl={cdromIcon}
                            contents={collapse => (
                                <DrawerContents>
                                    <DrawerHeader>
                                        <Input placeholder="Search discs…" />
                                        <Button onClick={collapse}>
                                            Close
                                        </Button>
                                    </DrawerHeader>
                                    <DrawerList>
                                        <DrawerListCategory title="Applications">
                                            <div className="ControlsPreview-Row">
                                                <Button
                                                    onClick={() =>
                                                        setStatus(
                                                            "Disc selected"
                                                        )
                                                    }>
                                                    Sample disc
                                                </Button>
                                                <Button disabled>
                                                    Unavailable
                                                </Button>
                                            </div>
                                        </DrawerListCategory>
                                        <DrawerListCategory title="Games">
                                            <DrawerLoading />
                                        </DrawerListCategory>
                                    </DrawerList>
                                </DrawerContents>
                            )}
                        />
                    </DrawersContainer>
                </div>
            ))}
            {dialogVisible && (
                <Dialog
                    title={`${name}: Save changes?`}
                    doneLabel="Save"
                    otherLabel="Don’t Save"
                    onDone={() => closeDialog("Saved")}
                    onOther={() => closeDialog("Discarded")}
                    onCancel={() => closeDialog("Cancelled")}>
                    <p>Save changes to the document “Untitled 1”?</p>
                    <label>
                        Document name: <Input defaultValue="Untitled 1" />
                    </label>
                    <label>
                        <Checkbox defaultChecked />
                        Keep a backup
                    </label>
                </Dialog>
            )}
        </section>
    );
}

function ListPreview({appearance}: {appearance: Appearance}) {
    const [selectedColumn, setSelectedColumn] = useState("Name");
    return (
        <table
            className={`Mac-Library-Table Mac-Library-Table-${appearance} ControlsPreview-List`}>
            <thead>
                <tr>
                    {["Name", "Year", "Active", "Author"].map(label => (
                        <th
                            key={label}
                            scope="col"
                            className={label === "Name" ? "wide" : undefined}>
                            <BevelButton
                                centered={false}
                                selected={selectedColumn === label}
                                className={
                                    label === "Active"
                                        ? "Control-Active"
                                        : undefined
                                }
                                onClick={() => setSelectedColumn(label)}>
                                {label}
                            </BevelButton>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {[
                    ["MacPaint", "1984", "Graphics", "Apple"],
                    ["HyperCard", "1987", "Multimedia", "Apple"],
                    ["SimpleText", "1994", "Utilities", "Apple"],
                ].map(row => (
                    <tr key={row[0]}>
                        {row.map((value, index) => (
                            <td
                                key={index}
                                className={
                                    ["Name", "Year", "Category", "Author"][
                                        index
                                    ] === selectedColumn
                                        ? "selected"
                                        : undefined
                                }>
                                {value}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function ScreenPreview({bezelStyle}: Pick<ScreenFrameProps, "bezelStyle">) {
    const [led, setLed] = useState<ScreenFrameProps["led"]>("On");
    return (
        <section className="ControlsPreview-Screen">
            <h3>{bezelStyle}</h3>
            <ScreenFrame
                bezelStyle={bezelStyle}
                bezelSize="Medium"
                width={256}
                height={192}
                led={led}
                onLedClick={() => setLed(led === "On" ? "Loading" : "On")}
                controls={[
                    {
                        label: "Power",
                        alwaysVisible: true,
                        handler: () => setLed(led === "None" ? "On" : "None"),
                    },
                    {
                        label: "Pressed",
                        className: "Control-Active",
                        alwaysVisible: true,
                        handler: () => setLed("Loading"),
                    },
                    {
                        label: "Menu",
                        alwaysVisible: true,
                        items: [
                            {label: "Ready", handler: () => setLed("On")},
                            {
                                label: "Loading",
                                handler: () => setLed("Loading"),
                            },
                        ],
                    },
                ]}
                screen={
                    <div className="ControlsPreview-ScreenContent">
                        {bezelStyle}
                    </div>
                }
            />
        </section>
    );
}
