import {useState} from "react";
import "./App.css";
import {AppDomain} from "./AppDomain";
import type {BrowserRunDef} from "./Browser";
import {Browser} from "./Browser";
import {Footer} from "./Footer";
import {Mac} from "./Mac";

function App() {
    const searchParams = new URLSearchParams(location.search);
    const domain = searchParams.get("domain") ?? location.host;
    const [runDef, setRunDef] = useState<BrowserRunDef | undefined>(undefined);
    let contents;
    if (domain.endsWith("infinitemac.org")) {
        if (runDef) {
            contents = (
                <Mac
                    disk={runDef.disk}
                    machine={runDef.machine}
                    ethernetProvider={runDef.ethernetProvider}
                    onDone={() => setRunDef(undefined)}
                />
            );
        } else {
            contents = <Browser onRun={setRunDef} />;
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
