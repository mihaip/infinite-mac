import {useEffect, useMemo, useState} from "react";
import "./App.css";
import {BroadcastChannelEthernetProvider} from "./BroadcastChannelEthernetProvider";
import type {BrowserRunDef} from "./Browser";
import {Browser, runDefFromUrl, runDefToUrl} from "./Browser";
import {Footer} from "./Footer";
import {Mac} from "./Mac";

function App() {
    const [url, initialRunDef, useSharedMemory, debugAudio, ethernetProvider] =
        useMemo(() => {
            const searchParams = new URLSearchParams(location.search);
            const url = searchParams.get("url") ?? location.href;
            const useSharedMemory =
                typeof SharedArrayBuffer !== "undefined" &&
                searchParams.get("use_shared_memory") !== "false";
            const debugAudio = searchParams.get("debug_audio") === "true";
            const ethernetProvider =
                searchParams.get("broadcast_channel_ethernet") === "true"
                    ? new BroadcastChannelEthernetProvider()
                    : undefined;
            return [
                url,
                runDefFromUrl(url),
                useSharedMemory,
                debugAudio,
                ethernetProvider,
            ];
        }, []);
    const [runDef, setRunDef] = useState<BrowserRunDef | undefined>(
        initialRunDef
    );
    useEffect(() => {
        const listener = () => {
            setRunDef(runDefFromUrl(location.href));
        };
        window.addEventListener("popstate", listener);
        return () => window.removeEventListener("popstate", listener);
    }, []);

    let contents;
    let footer: React.ReactElement | undefined = <Footer />;
    if (runDef) {
        const handleDone = () => {
            // Going back in the history is preferred over reseting the
            // state because the browser will restore the scroll position.
            if (runDef !== initialRunDef) {
                history.back();
            } else {
                history.pushState({}, "", "/");
                setRunDef(undefined);
            }
        };
        contents = (
            <Mac
                disk={runDef.disk}
                machine={runDef.machine}
                ethernetProvider={ethernetProvider ?? runDef.ethernetProvider}
                onDone={handleDone}
                useSharedMemory={useSharedMemory}
                debugAudio={debugAudio}
            />
        );
        footer = <Footer onLogoClick={handleDone} />;
    } else {
        contents = (
            <Browser
                onRun={(runDef, inNewWindow) => {
                    const runDefUrl = runDefToUrl(runDef, url);
                    if (inNewWindow) {
                        window.open(runDefUrl, "_blank");
                        return;
                    }
                    history.pushState({}, "", runDefUrl);
                    setRunDef(runDef);
                }}
            />
        );
        footer = undefined;
    }

    return (
        <div className="App">
            {contents}
            {footer}
        </div>
    );
}

export default App;
