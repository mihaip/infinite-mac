import {parse} from "cookie";
import {iso} from "@/lib/iso";

export function isAUXLaunched() {
    const cookieSource = iso().cookie.get();
    return cookieSource !== undefined && parse(cookieSource).aux === "true";
}
