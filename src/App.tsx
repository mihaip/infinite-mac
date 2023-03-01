import {useEffect, useMemo, useState} from "react";
import "./App.css";
import {AppDomain} from "./AppDomain";
import type {BrowserRunDef} from "./Browser";
import {Browser, runDefFromUrl, runDefToUrl} from "./Browser";
import {Footer} from "./Footer";
import {Mac} from "./Mac";

function App() {
    const [domain, url] = useMemo(() => {
        const searchParams = new URLSearchParams(location.search);
        const domain = searchParams.get("domain") ?? location.host;
        const url = searchParams.get("url") ?? location.href;
        return [domain, url];
    }, []);
    const [runDef, setRunDef] = useState<BrowserRunDef | undefined>(
        runDefFromUrl(url)
    );
    useEffect(() => {
        const listener = () => {
            setRunDef(runDefFromUrl(location.href));
        };
        window.addEventListener("popstate", listener);
        return () => window.removeEventListener("popstate", listener);
    }, []);

    let contents;
    if (domain.endsWith("infinitemac.org")) {
        if (runDef) {
            contents = (
                <Mac
                    disk={runDef.disk}
                    machine={runDef.machine}
                    ethernetProvider={runDef.ethernetProvider}
                    onDone={() => {
                        history.pushState({}, "", "/");
                        setRunDef(undefined);
                    }}
                />
            );
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
        }
    } else {
        contents = <AppDomain />;
    }

    return (
        <div className="App">
            {contents}
            <Footer />
        </div>
    );
}

export default App;
