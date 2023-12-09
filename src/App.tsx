import React, {Suspense, useEffect, useMemo, useState} from "react";
import "./App.css";
import {Browser} from "./Browser";
import {Footer} from "./Footer";
import {type RunDef, runDefFromUrl, runDefToUrl} from "./run-def";

function App() {
    const initialRunDef = useMemo(() => runDefFromUrl(location.href), []);
    const [runDef, setRunDef] = useState<RunDef | undefined>(initialRunDef);
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
            // Going back in the history is preferred over resetting the
            // state because the browser will restore the scroll position.
            if (runDef !== initialRunDef) {
                history.back();
            } else {
                history.pushState({}, "", "/");
                setRunDef(undefined);
            }
        };
        contents = (
            <Suspense fallback={<div />}>
                <RunDefMac runDef={runDef} onDone={handleDone} />
            </Suspense>
        );
        footer = (
            <Footer
                onLogoClick={handleDone}
                showFullscreenButton={runDef.screenSize === "fullscreen"}
            />
        );
    } else {
        contents = (
            <React.StrictMode>
                <Browser
                    onRun={(runDef, inNewWindow) => {
                        const runDefUrl = runDefToUrl(runDef);
                        if (inNewWindow) {
                            window.open(runDefUrl, "_blank");
                            return;
                        }
                        history.pushState({}, "", runDefUrl);
                        setRunDef(runDef);
                    }}
                />
            </React.StrictMode>
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

const RunDefMac = React.lazy(() => import("./RunDefMac"));

export default App;
