import React, {useCallback, useEffect} from "react";
import {type EmulatorSettings} from "./emulator/emulator-ui";
import {
    type EmulatorSpeed,
    type EmulatorType,
    emulatorSupportsSpeedSetting,
    EMULATOR_SPEEDS,
} from "./emulator/emulator-common-emulators";
import {Dialog} from "./controls/Dialog";
import {type Appearance} from "./controls/Appearance";
import {Select} from "./controls/Select";
import {Checkbox} from "./controls/Checkbox";
import {Button} from "./controls/Button";

export function MacSettings({
    emulatorType,
    emulatorSettings,
    appearance,
    setEmulatorSettings,
    hasSavedHD,
    onDone,
}: {
    emulatorType: EmulatorType;
    emulatorSettings: EmulatorSettings;
    appearance: Appearance;
    setEmulatorSettings: (settings: EmulatorSettings) => void;
    hasSavedHD: boolean;
    onDone: () => void;
}) {
    const [storagePersistenceStatus, setStoragePersistenceStatus] =
        React.useState<"unknown" | "persistent" | "transient" | "error">(
            "unknown"
        );
    const storagePersistenceStatusLabel = {
        "unknown": "Unknown",
        "persistent": "Persistent",
        "transient": "Transient",
        "error": <div style={{color: "#ff9999"}}>error</div>,
    }[storagePersistenceStatus];
    const handlePersistencePromise = useCallback((p: Promise<boolean>) => {
        p.then(persistent =>
            setStoragePersistenceStatus(persistent ? "persistent" : "transient")
        ).catch(e => {
            console.error("Could not use storage persistence API", e);
            setStoragePersistenceStatus("error");
        });
    }, []);
    useEffect(() => {
        handlePersistencePromise(navigator.storage.persisted());
    }, [handlePersistencePromise]);
    const handleRequestPersistence = useCallback(() => {
        handlePersistencePromise(navigator.storage.persist());
    }, [handlePersistencePromise]);

    return (
        <Dialog title="Settings" onDone={onDone} appearance={appearance}>
            <label>
                <Checkbox
                    appearance={appearance}
                    checked={emulatorSettings.swapControlAndCommand}
                    onChange={() =>
                        setEmulatorSettings({
                            ...emulatorSettings,
                            swapControlAndCommand:
                                !emulatorSettings.swapControlAndCommand,
                        })
                    }
                />
                Swap Control and Command Keys
                <div className="Dialog-Description">
                    Makes it easier to use shortcuts like Command-W, Command-Q
                    or Command-Shift-3 (which are otherwise handled by the host
                    browser or OS).
                </div>
            </label>
            {emulatorSupportsSpeedSetting(emulatorType) && (
                <label>
                    Speed:
                    <Select
                        appearance={appearance}
                        value={emulatorSettings.speed}
                        onChange={event =>
                            setEmulatorSettings({
                                ...emulatorSettings,
                                speed: parseInt(
                                    event.target.value
                                ) as EmulatorSpeed,
                            })
                        }>
                        {Array.from(
                            EMULATOR_SPEEDS.entries(),
                            ([speed, label]) => (
                                <option key={`speed-${speed}`} value={speed}>
                                    {label}
                                </option>
                            )
                        )}
                    </Select>
                    <div className="Dialog-Description">
                        Very old software may be timing dependent and thus only
                        work at 1x speeds.
                    </div>
                </label>
            )}
            {hasSavedHD && (
                <>
                    <h2>Saved HD</h2>
                    Storage status: {storagePersistenceStatusLabel}
                    {storagePersistenceStatus !== "persistent" && (
                        <>
                            {" "}
                            <Button
                                appearance={appearance}
                                onClick={handleRequestPersistence}>
                                Request Persistence
                            </Button>
                        </>
                    )}
                    <div className="Dialog-Description" style={{marginLeft: 0}}>
                        Ensures that the browser will try to keep the Saved HD
                        data even when running low on disk space (
                        <a
                            href="https://web.dev/persistent-storage/"
                            target="_blank">
                            more info
                        </a>
                        ).
                    </div>
                </>
            )}
        </Dialog>
    );
}
