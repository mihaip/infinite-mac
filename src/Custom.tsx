import {useCallback, useEffect, useState} from "react";
import {Dialog} from "./controls/Dialog";
import * as varz from "./varz";
import {type RunDef} from "./run-def";
import {SYSTEM_DISKS_BY_NAME, type SystemDiskDef} from "./disks";
import {AppearanceProvider} from "./controls/Appearance";
import {canSaveDisks} from "./canSaveDisks";
import {CustomFields} from "./CustomFields";

export function Custom({
    initialRunDef,
    defaultDisk = SYSTEM_DISKS_BY_NAME["System 7.1"],
    onRun,
    onDone,
}: {
    initialRunDef?: RunDef;
    defaultDisk?: SystemDiskDef;
    onRun: (def: RunDef, inNewWindow?: boolean) => void;
    onDone: () => void;
}) {
    useEffect(() => {
        varz.increment("custom_shown");
    }, []);

    const [runDef, setRunDef] = useState<RunDef>(
        initialRunDef
            ? initialRunDef.isCustom
                ? initialRunDef
                : {...initialRunDef, isCustom: true}
            : {
                  machine: defaultDisk.preferredMachine,
                  ramSize: undefined,
                  screenSize: "auto",
                  disks: [defaultDisk],
                  cdromURLs: [],
                  cdromPrefetchChunks: [],
                  includeInfiniteHD: true,
                  includeSavedHD: canSaveDisks(),
                  includeLibrary: true,
                  libraryDownloadURLs: [],
                  isCustom: true,
                  diskFiles: [],
              }
    );

    const handleRun = useCallback(
        (event: React.MouseEvent) => {
            event.preventDefault();
            onDone();
            varz.increment("custom_run");
            const inNewWindow =
                event.button === 2 || event.metaKey || event.ctrlKey;
            onRun(runDef, inNewWindow);
        },
        [onDone, onRun, runDef]
    );
    const [canRun, setCanRun] = useState(false);

    const {appearance = "Classic", appearanceVariant} = runDef.disks[0] ?? {};
    return (
        <AppearanceProvider appearance={appearance} variant={appearanceVariant}>
            <Dialog
                title="Run A Custom Configuration"
                onDone={handleRun}
                doneLabel="Run"
                doneEnabled={canRun}
                onCancel={onDone}>
                <p>
                    Build your own configuration by selecting a machine and
                    disks.
                </p>
                <CustomFields
                    runDef={runDef}
                    setRunDef={setRunDef}
                    defaultDisk={defaultDisk}
                    setCanRun={setCanRun}
                />
            </Dialog>
        </AppearanceProvider>
    );
}
