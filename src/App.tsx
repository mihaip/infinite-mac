import {useEffect, useMemo, useState} from "react";
import "./App.css";
import {AppDomain} from "./AppDomain";
import type {BrowserRunDef} from "./Browser";
import {Browser, runDefFromUrl, runDefToUrl} from "./Browser";
import {Footer} from "./Footer";
import {Mac} from "./Mac";

function App() {
    const [domain, url, initialRunDef, useSharedMemory] = useMemo(() => {
        const searchParams = new URLSearchParams(location.search);
        const domain =
            searchParams.get("domain") ??
            sessionStorage["domain"] ??
            location.host;
        const url = searchParams.get("url") ?? location.href;
        const useSharedMemory =
            typeof SharedArrayBuffer !== "undefined" &&
            searchParams.get("use_shared_memory") !== "false";
        return [domain, url, runDefFromUrl(url), useSharedMemory];
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
    if (domain.endsWith("infinitemac.org")) {
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
                    ethernetProvider={runDef.ethernetProvider}
                    onDone={handleDone}
                    useSharedMemory={useSharedMemory}
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
    } else {
        contents = <AppDomain />;
    }

    return (
        <div className="App">
            {contents}
            {footer}
        </div>
    );
}

export default App;
