import React from "react";
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

export function MacSettings({
    emulatorType,
    emulatorSettings,
    appearance,
    setEmulatorSettings,
    onDone,
}: {
    emulatorType: EmulatorType;
    emulatorSettings: EmulatorSettings;
    appearance: Appearance;
    setEmulatorSettings: (settings: EmulatorSettings) => void;
    onDone: () => void;
}) {
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
        </Dialog>
    );
}
