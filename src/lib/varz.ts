export async function get(name: string): Promise<number> {
    return (await fetch(`/varz?name=${name}`)).json() as Promise<number>;
}

export function increment(name: string, delta: number = 1): void {
    incrementMulti({[name]: delta});
}

export function incrementMulti(changes: {[name: string]: number}): void {
    fetch("/varz", {
        method: "POST",
        headers: telemetryHeaders(),
        body: JSON.stringify(changes),
    }).catch(err => {
        console.error("Could not increment varz", changes, err);
    });
}

export function incrementError(name: string, message: string): void {
    fetch("/errorz", {
        method: "POST",
        headers: telemetryHeaders(),
        body: JSON.stringify({name, message}),
    }).catch(err => {
        console.error("Could not increment error", name, message, err);
    });
}

// Identify a single page load without persisting an identifier across reloads.
// This module is also imported during server rendering.
const pageLoadId =
    typeof window === "undefined"
        ? ""
        : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte =>
              byte.toString(16).padStart(2, "0")
          ).join("");
let requestSequence = 0;

function telemetryHeaders(): {[name: string]: string} {
    return {
        "Content-Type": "application/json",
        "X-Page-Load-Id": pageLoadId,
        "X-Request-Sequence": String(++requestSequence),
    };
}
