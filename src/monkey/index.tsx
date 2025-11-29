import {createRoot} from "react-dom/client";
import "@/monkey/index.css";
import Monkey from "@/monkey/Monkey";

const root = createRoot(document.getElementById("root")!);

root.render(<Monkey />);
