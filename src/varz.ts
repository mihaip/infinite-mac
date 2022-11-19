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
