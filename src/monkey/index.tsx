import {createRoot} from "react-dom/client";
import "./index.css";
import Monkey from "./Monkey";

const root = createRoot(document.getElementById("root")!);

root.render(<Monkey />);
