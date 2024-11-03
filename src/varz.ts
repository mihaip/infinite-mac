export async function get(name: string): Promise<number> {
    return (await fetch(`/varz?name=${name}`)).json() as Promise<number>;
}

export async function increment(name: string, delta: number = 1) {
    return incrementMulti({[name]: delta});
}

export async function incrementMulti(changes: {[name: string]: number}) {
    return fetch("/varz", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(changes),
    });
}

export async function incrementError(name: string, message: string) {
    return fetch("/errorz", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({name, message}),
    });
}
