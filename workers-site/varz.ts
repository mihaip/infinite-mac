type VarData = {[key: string]: number};
// For now just store everything in one key, since we don't expect to have a lot
// of distinct keys.
const VARZ_KEY = "varz";

export async function handleRequest(request: Request, namespace: KVNamespace) {
    if (request.method === "POST") {
        const body = await request.json();
        await incrementVarz(namespace, body as VarData);
        return new Response(null, {status: 204});
    }
    if (request.method !== "GET") {
        return new Response("Unsupported method", {status: 405});
    }
    const varzs =
        (await namespace.get<VarData>(VARZ_KEY, {
            type: "json",
            cacheTtl: 60,
        })) ?? {};
    const varzsSorted = Object.fromEntries(
        Object.entries(varzs).sort((a, b) => (a[0] < b[0] ? -1 : 1))
    );
    return new Response(JSON.stringify(varzsSorted, undefined, 4), {
        status: 200,
        headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "no-store",
        },
    });
}

async function incrementVarz(namespace: KVNamespace, changes: VarData) {
    // Use a low TTL since we do a read-modify-write. A durable object may
    // be preferable if we need to do a lot of writes.
    const varzs =
        (await namespace.get<VarData>(VARZ_KEY, {
            type: "json",
            cacheTtl: 60,
        })) ?? {};
    for (const [key, delta] of Object.entries(changes)) {
        varzs[key] = (varzs[key] ?? 0) + delta;
    }
    await namespace.put(VARZ_KEY, JSON.stringify(varzs));
}

type ErrorzData = {[key: string]: string[]};
const ERRORZ_KEY = "errorz";

export async function handleErrorzRequest(
    request: Request,
    namespace: KVNamespace
) {
    const errorz =
        (await namespace.get<ErrorzData>(ERRORZ_KEY, {
            type: "json",
            cacheTtl: 60,
        })) ?? {};

    if (request.method === "POST") {
        const {name, message} = (await request.json()) as {
            name: string;
            message: string;
        };
        const messages = errorz[name] ?? [];
        if (messages.unshift(message) > 20) {
            messages.pop();
        }
        errorz[name] = messages;
        await namespace.put(ERRORZ_KEY, JSON.stringify(errorz));
        await incrementVarz(namespace, {[name]: 1});
        return new Response(null, {status: 204});
    }
    if (request.method !== "GET") {
        return new Response("Unsupported method", {status: 405});
    }
    const errorzSorted = Object.fromEntries(
        Object.entries(errorz).sort((a, b) => a[0].localeCompare(b[0]))
    );
    return new Response(JSON.stringify(errorzSorted, undefined, 4), {
        status: 200,
        headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "no-store",
        },
    });
}
