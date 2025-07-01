import "./Embed.css";
import {useCallback, useEffect, useState} from "react";
import {Dialog} from "./controls/Dialog";
import * as varz from "./varz";
import {runDefToUrl, type RunDef} from "./run-def";
import {SYSTEM_DISKS_BY_NAME, type SystemDiskDef} from "./disks";
import {AppearanceProvider} from "./controls/Appearance";
import {CustomFields} from "./CustomFields";
import {DEFAULT_SUPPORTED_SCREEN_SIZES} from "./machines";
import {Checkbox} from "./controls/Checkbox";
import {TextArea} from "./controls/TextArea";
import {
    DEFAULT_EMULATOR_SETTINGS,
    type EmulatorSettings,
} from "./emulator/emulator-ui-settings";
import {EmbedDocs} from "./EmbedDocs";

export function Embed({
    defaultDisk = SYSTEM_DISKS_BY_NAME["System 7.1"],
    onDone,
}: {
    defaultDisk?: SystemDiskDef;
    onDone: () => void;
}) {
    const [docsVisible, setDocsVisible] = useState(false);
    const handleDocsClick = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        setDocsVisible(true);
    }, []);

    useEffect(() => {
        varz.increment("embed_shown");
    }, []);

    const [runDef, setRunDef] = useState<RunDef>({
        machine: defaultDisk.preferredMachine,
        ramSize: undefined,
        screenSize: "auto",
        disks: [defaultDisk],
        cdromURLs: [],
        cdromPrefetchChunks: [],
        includeInfiniteHD: true,
        includeSavedHD: false,
        includeLibrary: false,
        libraryDownloadURLs: [],
        isCustom: true,
        diskFiles: [],
    });
    const [showSettings, setShowSettings] = useState(false);
    const [settingsString, setSettingsString] = useState(
        DEFAULT_SETTINGS_STRING
    );

    let screenSize = {width: 640, height: 480};
    if (runDef.machine.fixedScreenSize) {
        screenSize = runDef.machine.fixedScreenSize;
    } else if (typeof runDef.screenSize === "object") {
        screenSize = runDef.screenSize;
    } else if (runDef.screenSize === "auto") {
        if (runDef.machine.supportedScreenSizes) {
            screenSize = runDef.machine.supportedScreenSizes[0];
        } else {
            screenSize = DEFAULT_SCREEN_SIZES[0];
        }
    }
    const {screenScale = 1} = runDef;

    let settings: EmulatorSettings | undefined;
    try {
        settings =
            settingsString === DEFAULT_SETTINGS_STRING
                ? undefined
                : JSON.parse(settingsString);
    } catch (error) {
        // Ignore, the user may be mid-editing the settings.
    }

    const url = runDefToUrl({...runDef, screenSize: "auto", settings}, true);
    const html = `<iframe src="${url}"
    width="${screenSize.width * screenScale}"
    height="${screenSize.height * screenScale}"
    allow="cross-origin-isolated"
    frameborder="0"></iframe>`;

    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(
        async (event: React.MouseEvent) => {
            event.preventDefault();
            varz.increment("embed_copy");
            await navigator.clipboard.writeText(html);
            setCopied(true);
            setTimeout(() => setCopied(false), 1000);
        },
        [html]
    );
    const [canCopy, setCanCopy] = useState(false);

    const {appearance = "Classic", appearanceVariant} = runDef.disks[0] ?? {};
    if (docsVisible) {
        return (
            <EmbedDocs
                onDone={onDone}
                appearance={appearance}
                appearanceVariant={appearanceVariant}
            />
        );
    }

    return (
        <AppearanceProvider appearance={appearance} variant={appearanceVariant}>
            <Dialog
                title="Embed On Your Website"
                onDone={handleCopy}
                doneLabel={copied ? "Copied!" : "Copy HTML"}
                doneEnabled={canCopy}
                doneClassName="Embed-Copy-Button"
                otherLabel="Close"
                onOther={onDone}>
                <p>
                    Embed a custom instance of Infinite Mac in your own website
                    by copying the HTML code below. See{" "}
                    <a href="/embed-docs" onClick={handleDocsClick}>
                        the developer documentation
                    </a>{" "}
                    for more details on how you can control the embedded
                    instance via JavaScript.
                </p>
                <CustomFields
                    runDef={runDef}
                    setRunDef={setRunDef}
                    defaultDisk={defaultDisk}
                    setCanRun={setCanCopy}
                    defaultSupportedScreenSizes={DEFAULT_SCREEN_SIZES}
                    allowAutoScreenSize={false}
                    allowSavedHD={false}
                    allowAppleTalk={false}
                    allowScreenScale={true}
                />
                <div className="CustomFields-Row">
                    <span className="CustomFields-Label" />
                    <label>
                        <Checkbox
                            checked={runDef.startPaused ?? false}
                            onChange={e =>
                                setRunDef({
                                    ...runDef,
                                    startPaused: e.target.checked
                                        ? true
                                        : undefined,
                                })
                            }
                        />
                        Start paused
                    </label>
                    <br />
                    <span className="CustomFields-Label" />
                    <label>
                        <Checkbox
                            checked={runDef.autoPause ?? false}
                            onChange={e =>
                                setRunDef({
                                    ...runDef,
                                    autoPause: e.target.checked
                                        ? true
                                        : undefined,
                                })
                            }
                        />
                        Auto-pause
                    </label>
                    <div className="CustomFields-Description Dialog-Description">
                        Pause the emulated machine when it is not visible, to
                        reduce resource utilization.
                    </div>
                </div>
                <div className="CustomFields-Row">
                    <span className="CustomFields-Label" />
                    <label>
                        <Checkbox
                            checked={runDef.screenUpdateMessages ?? false}
                            onChange={e =>
                                setRunDef({
                                    ...runDef,
                                    screenUpdateMessages: e.target.checked
                                        ? true
                                        : undefined,
                                })
                            }
                        />
                        Send screen updates
                    </label>
                    <div className="CustomFields-Description Dialog-Description">
                        Send the current screen contents to the parent window
                        whenever they change. May introduce a performance hit
                        for large or frequently-updating screens.
                    </div>
                </div>
                <div className="CustomFields-Row">
                    <span className="CustomFields-Label" />
                    <label>
                        <Checkbox
                            checked={showSettings}
                            onChange={e => {
                                const showSettings = e.target.checked;
                                setShowSettings(showSettings);
                                setSettingsString(
                                    showSettings ? DEFAULT_SETTINGS_STRING : ""
                                );
                            }}
                        />
                        Custom settings
                    </label>
                    {showSettings && (
                        <div>
                            <span className="CustomFields-Label" />
                            <TextArea
                                value={settingsString}
                                onChange={e =>
                                    setSettingsString(e.target.value)
                                }
                                rows={
                                    DEFAULT_SETTINGS_STRING.split("\n").length
                                }
                                cols={40}
                                className="CustomFields-TextArea"
                            />
                            <div className="CustomFields-Description Dialog-Description">
                                See{" "}
                                <a
                                    href="https://github.com/mihaip/infinite-mac/blob/main/src/emulator/emulator-ui-settings.ts"
                                    target="_blank">
                                    this file
                                </a>{" "}
                                for details on the settings values.
                            </div>
                        </div>
                    )}
                </div>

                <div className="CustomFields-Row Embed-HTML-Row">
                    <span className="CustomFields-Label">HTML:</span>
                    <div className="Embed-HTML">{html}</div>
                </div>
            </Dialog>
        </AppearanceProvider>
    );
}

// Prefer the smaller screen sizes, since they're more likely to fit in an iframe.
const DEFAULT_SCREEN_SIZES = [...DEFAULT_SUPPORTED_SCREEN_SIZES].reverse();

const DEFAULT_SETTINGS_STRING = JSON.stringify(
    DEFAULT_EMULATOR_SETTINGS,
    null,
    4
);
