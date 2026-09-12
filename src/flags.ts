import {parse} from "cookie";
import {iso} from "@/lib/iso";

export function isAUXLaunched() {
    const cookieSource = iso().cookie.get();
    if (cookieSource !== undefined && parse(cookieSource).aux === "true") {
        return true;
    }
    if (iso().location.searchParams.get("filter") === "aux") {
        return true;
    }
    return false;
}
