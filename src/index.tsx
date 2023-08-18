import {createRoot} from "react-dom/client";
import "./index.css";
import App from "./App";
import {canSaveDisks} from "./canSaveDisks";

// Determining if we can save data is an async operation, kick off the request
// now so that we're more likely to have the answer by the time the we actually
// need to decide if we can mount the saved disk.
try {
    canSaveDisks();
} catch (e) {
    // Ignore.
}

const root = createRoot(document.getElementById("root")!);

root.render(<App />);
