import React, {Suspense, useEffect, useMemo, useState} from "react";
import "./App.css";
import {BroadcastChannelEthernetProvider} from "./BroadcastChannelEthernetProvider";
import type {BrowserRunDef} from "./Browser";
import {Browser, runDefFromUrl, runDefToUrl} from "./Browser";
import {Footer} from "./Footer";
import type {MacProps} from "./Mac";
import cdromsManifest from "./Data/CD-ROMs.json";
import type {EmulatorCDROMLibrary} from "./emulator/emulator-common";

function App() {
    const [
        url,
        initialRunDef,
        useSharedMemory,
        debugAudio,
        ethernetProvider,
        showCDROMs,
    ] = useMemo(() => {
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
        const showCDROMs = searchParams.get("cdroms") === "true";
        return [
            url,
            runDefFromUrl(url),
            useSharedMemory,
            debugAudio,
            ethernetProvider,
            showCDROMs,
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
        runDef.disk.generatedSpec(); // Prefetch the disk definition
        contents = (
            <Mac
                disk={runDef.disk}
                machine={runDef.machine}
                ethernetProvider={ethernetProvider ?? runDef.ethernetProvider}
                onDone={handleDone}
                useSharedMemory={useSharedMemory}
                debugAudio={debugAudio}
                cdroms={
                    showCDROMs
                        ? (cdromsManifest as any as EmulatorCDROMLibrary)
                        : undefined
                }
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

const LazyMac = React.lazy(() => import("./Mac"));
const Mac = (props: MacProps) => (
    <Suspense fallback={<div />}>
        <LazyMac {...props} />
    </Suspense>
);

export default App;
