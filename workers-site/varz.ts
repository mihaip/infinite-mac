type VarData = {[key: string]: number};

const VARZ_PREFIX = "varz:";

// We used to store everything in one key, but doesn't play well with frequent
// updates to the minimum TTL of 1 minute. We now store each varz separately,
// but we read from the legacy value to migrate on-demand.
const LEGACY_VARZ_KEY = "varz";

export async function handleRequest(request: Request, namespace: KVNamespace) {
    if (request.method === "POST") {
        const body = await request.json();
        await incrementVarz(namespace, body as VarData);
        return new Response(null, {status: 204});
    }
    if (request.method !== "GET") {
        return new Response("Unsupported method", {status: 405});
    }

    const varzSortFn = (a: [string, number], b: [string, number]) =>
        a[0] < b[0] ? -1 : 1;

    const {keys} = await namespace.list({prefix: VARZ_PREFIX});
    const varzs = await Promise.all(
        keys
            .map(key => key.name)
            // Ignore keys from when we were tracking unique CD-ROMs, it was too
            // noisy.
            .filter(name => !name.startsWith(VARZ_PREFIX + "emulator_cdrom:"))
            .map(async key => {
                const value = await namespace.get<number>(key, {type: "json"});
                return [key.slice(VARZ_PREFIX.length), value] as [
                    string,
                    number
                ];
            })
    );
    const varzsSorted = Object.fromEntries(varzs.sort(varzSortFn));

    const legacyVarzs =
        (await namespace.get<VarData>(LEGACY_VARZ_KEY, {
            type: "json",
            cacheTtl: 60,
        })) ?? {};
    const legacyVarzsSorted = Object.fromEntries(
        Object.entries(legacyVarzs).sort(varzSortFn)
    );
    return new Response(
        JSON.stringify(
            {"modern": varzsSorted, legacy: legacyVarzsSorted},
            undefined,
            4
        ),
        {
            status: 200,
            headers: {
                "Content-Type": "text/plain",
                "Cache-Control": "no-store",
            },
        }
    );
}

async function incrementVarz(namespace: KVNamespace, changes: VarData) {
    let legacyVarzs: VarData | undefined;

    for (const [name, delta] of Object.entries(changes)) {
        const key = VARZ_PREFIX + name;
        let value = await namespace.get<number>(key, {type: "json"});
        if (value === null) {
            if (!legacyVarzs) {
                legacyVarzs =
                    (await namespace.get<VarData>(LEGACY_VARZ_KEY, {
                        type: "json",
                        cacheTtl: 60,
                    })) ?? {};
            }
            value = (legacyVarzs[name] ?? 0) + delta;
            legacyVarzs[name] = value;
        } else {
            value += delta;
        }
        await namespace.put(key, JSON.stringify(value));
    }

    if (legacyVarzs) {
        await namespace.put(LEGACY_VARZ_KEY, JSON.stringify(legacyVarzs));
    }
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
