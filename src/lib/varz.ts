export async function get(name: string): Promise<number> {
    return (await fetch(`/varz?name=${name}`)).json() as Promise<number>;
}

export function increment(name: string, delta: number = 1): void {
    incrementMulti({[name]: delta});
}

export function incrementMulti(changes: {[name: string]: number}): void {
    fetch("/varz", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(changes),
    }).catch(err => {
        console.error("Could not increment varz", changes, err);
    });
}

export function incrementError(name: string, message: string): void {
    fetch("/errorz", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({name, message}),
    }).catch(err => {
        console.error("Could not increment error", name, message, err);
    });
}
