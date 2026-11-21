import {parse} from "cookie";
import {iso} from "@/lib/iso";

export function isResEditModeLaunched() {
    const cookieSource = iso().cookie.get();
    if (cookieSource !== undefined && parse(cookieSource).resEdit === "true") {
        return true;
    }
    return false;
}
