import {createRoot, hydrateRoot} from "react-dom/client";
import "@/index.css";
import App from "@/app/App";
import {canSaveDisks} from "@/lib/canSaveDisks";
import {setIsoProvider, type Iso} from "@/lib/iso";

// Determining if we can save data is an async operation, kick off the request
// now so that we're more likely to have the answer by the time the we actually
// need to decide if we can mount the saved disk.
try {
    canSaveDisks();
} catch (e) {
    // Ignore.
}

const BROWSER_ISO: Iso = {
    location: {
        get href() {
            return window.location.href;
        },
        get pathname() {
            return window.location.pathname;
        },
        get searchParams() {
            return new URLSearchParams(window.location.search);
        },
    },
    cookie: {
        get() {
            return document.cookie;
        },
        set(value: string) {
            document.cookie = value;
        },
    },
    navigator: {
        get userAgent() {
            return navigator.userAgent;
        },
    },
};

setIsoProvider(() => BROWSER_ISO);

const rootElement = document.getElementById("root")!;
const app = <App />;
if (rootElement.firstChild) {
    hydrateRoot(rootElement, app);
} else {
    createRoot(rootElement).render(app);
}
