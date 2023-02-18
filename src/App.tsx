import {useMemo} from "react";
import "./App.css";
import {BroadcastChannelEthernetProvider} from "./BroadcastChannelEthernetProvider";
import {CloudflareWorkerEthernetProvider} from "./CloudflareWorkerEthernetProvider";
import {DISKS_BY_DOMAIN, DISKS_BY_NAME} from "./disks";
import type {EmulatorEthernetProvider} from "./emulator/emulator-ui";
import {Footer} from "./Footer";
import {Mac} from "./Mac";
import {MACHINES_BY_NAME} from "./machines";

function App() {
    const [disk, machine, ethernetProvider, useSharedMemory, debugAudio] =
        useMemo(() => {
            const searchParams = new URLSearchParams(location.search);
            let domain = searchParams.get("domain") ?? location.host;
            // Use subdomain as the Ethernet Zone in production.
            let ethernetProvider: EmulatorEthernetProvider | undefined;
            if (domain.endsWith(".app")) {
                const pieces = domain.split(".");
                if (pieces.length === 3) {
                    ethernetProvider = new CloudflareWorkerEthernetProvider(
                        pieces[0]
                    );
                    domain = `${pieces[1]}.app`;
                }
            }
            if (!ethernetProvider && searchParams.get("ethernet")) {
                const zoneName = searchParams.get("ethernet_zone");
                ethernetProvider = zoneName
                    ? new CloudflareWorkerEthernetProvider(zoneName)
                    : new BroadcastChannelEthernetProvider();
            }

            const diskName = searchParams.get("disk");
            let disk;
            if (diskName) {
                disk = DISKS_BY_NAME[diskName];
            }
            if (!disk) {
                disk = DISKS_BY_DOMAIN[domain];
            }
            if (!disk) {
                disk = DISKS_BY_DOMAIN["system7.app"];
            }

            const machineName = searchParams.get("machine");
            let machine;
            if (machineName) {
                machine = MACHINES_BY_NAME[machineName];
                if (machine && !disk.machines.includes(machine)) {
                    console.warn(
                        `Machine ${machine.name} not supported by the disk ${disk.name}, may not work.`
                    );
                }
            }
            if (!machine) {
                machine = disk.machines[0];
            }
            const useSharedMemory =
                typeof SharedArrayBuffer !== "undefined" &&
                searchParams.get("use_shared_memory") !== "false";
            const debugAudio = searchParams.get("debug_audio") === "true";
            return [
                disk,
                machine,
                ethernetProvider,
                useSharedMemory,
                debugAudio,
            ];
        }, []);

    return (
        <div className="App">
            <Mac
                disk={disk}
                machine={machine}
                ethernetProvider={ethernetProvider}
                useSharedMemory={useSharedMemory}
                debugAudio={debugAudio}
            />
            <Footer />
        </div>
    );
}

export default App;
