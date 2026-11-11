import {useSyncExternalStore} from "react";
import {Drawer, DrawerContents, DrawersContainer} from "@/controls/Drawer";
import {type EmulatorLog} from "@/emulator/ui/log";
import noteIcon from "@/Images/Note.png";
import "@/app/EmulatorLogging.css";

export function EmulatorLogging({log}: {log: EmulatorLog}) {
    const messages = useSyncExternalStore(log.subscribe, log.getSnapshot);
    return (
        <DrawersContainer placement="right">
            <Drawer
                title="Debug Log"
                titleIconUrl={noteIcon}
                contents={() => (
                    <DrawerContents>
                        <pre
                            className="EmulatorLogging"
                            tabIndex={0}
                            onKeyDown={e => e.stopPropagation()}
                            onKeyUp={e => e.stopPropagation()}>
                            {messages.length
                                ? messages.join("\n")
                                : "Waiting for log output…"}
                        </pre>
                    </DrawerContents>
                )}
            />
        </DrawersContainer>
    );
}
