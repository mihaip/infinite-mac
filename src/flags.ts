import {parse} from "cookie";
import {iso} from "@/lib/iso";

export function isBeOSLaunched() {
    const cookieSource = iso().cookie.get();
    if (cookieSource !== undefined && parse(cookieSource).beos === "true") {
        return true;
    }
    if (iso().location.searchParams.get("filter") === "beos") {
        return true;
    }
    return false;
}
