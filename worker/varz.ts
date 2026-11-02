type VarData = {[key: string]: number};

const VARZ_PREFIX = "varz:";

export async function handleRequest(
    request: Request,
    namespace: KVNamespace,
    analytics: AnalyticsEngineDataset
) {
    if (request.method === "POST") {
        const changes = (await request.json()) as VarData;
        const context = logTelemetryRequest(request, "/varz", changes);
        await incrementVarz(namespace, changes, analytics, context);
        return new Response(null, {status: 204});
    }
    if (request.method !== "GET") {
        return new Response("Unsupported method", {status: 405});
    }

    const name = new URL(request.url).searchParams.get("name");
    if (name) {
        const key = VARZ_PREFIX + name;
        const value = await namespace.get<number>(key, {type: "json"});
        if (value === null) {
            return new Response("Not found", {status: 404});
        }
        return new Response(JSON.stringify(value), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
            },
        });
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
                    number,
                ];
            })
    );
    const varzsSorted = Object.fromEntries(varzs.sort(varzSortFn));

    return new Response(JSON.stringify(varzsSorted, undefined, 4), {
        status: 200,
        headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "no-store",
        },
    });
}

async function incrementVarz(
    namespace: KVNamespace,
    changes: VarData,
    analytics: AnalyticsEngineDataset,
    context: TelemetryContext
) {
    for (const [name, delta] of Object.entries(changes)) {
        if (!delta) {
            continue;
        }
        const key = VARZ_PREFIX + name;
        let value = await namespace.get<number>(key, {type: "json"});
        if (value === null) {
            value = delta;
        } else {
            value += delta;
        }
        try {
            await namespace.put(key, JSON.stringify(value));
        } catch (error) {
            logKVPutFailure(context, key, name, delta);
            throw error;
        }
        try {
            const encodedName = new TextEncoder().encode(name);
            let index = name;
            // Analytics Engine indexes are limited to 96 bytes. Preserve the
            // full name in blob1, and hash oversized names for sampling.
            if (encodedName.byteLength > 96) {
                const hash = await crypto.subtle.digest("SHA-256", encodedName);
                index = Array.from(new Uint8Array(hash), byte =>
                    byte.toString(16).padStart(2, "0")
                ).join("");
            }
            // Schema: blob1 = full counter name, blob2..20 = colon-separated
            // key components, double1 = increment, index1 = sampling key for
            // the counter. Keep blob1 for existing queries and any components
            // beyond Analytics Engine's 20-blob limit. Queries should sum
            // double1 * _sample_interval to account for sampling.
            // writeDataPoint is synchronous; the runtime exports in the background.
            analytics.writeDataPoint({
                blobs: [name, ...name.split(":").slice(0, 19)],
                doubles: [delta],
                indexes: [index],
            });
        } catch (error) {
            console.error("Error exporting varz counter:", name, error);
        }
    }
}

type ErrorzData = {[key: string]: string[]};
const ERRORZ_KEY = "errorz";

export async function handleErrorzRequest(
    request: Request,
    namespace: KVNamespace,
    analytics: AnalyticsEngineDataset
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
        const changes = {[name]: 1};
        const context = logTelemetryRequest(request, "/errorz", changes);
        const messages = errorz[name] ?? [];
        if (messages.unshift(message) > 20) {
            messages.pop();
        }
        errorz[name] = messages;
        try {
            await namespace.put(ERRORZ_KEY, JSON.stringify(errorz));
        } catch (error) {
            logKVPutFailure(context, ERRORZ_KEY, name, 1);
            throw error;
        }
        await incrementVarz(namespace, changes, analytics, context);
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

type TelemetryContext = {
    endpoint: "/varz" | "/errorz";
    pageLoadId: string | null;
    requestSequence: number | null;
};

function logTelemetryRequest(
    request: Request,
    endpoint: TelemetryContext["endpoint"],
    changes: VarData
): TelemetryContext {
    const sequenceHeader = request.headers.get("X-Request-Sequence");
    const sequence = sequenceHeader === null ? NaN : Number(sequenceHeader);
    const context = {
        endpoint,
        pageLoadId: request.headers.get("X-Page-Load-Id"),
        requestSequence:
            Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null,
    };
    console.log({feature: "varz", type: "increment", ...context, changes});
    return context;
}

function logKVPutFailure(
    context: TelemetryContext,
    key: string,
    name: string,
    delta: number
) {
    // Keep the context at info level and rethrow the original exception at the
    // call site, so that logging does not create a second error issue.
    console.log({
        feature: "varz",
        type: "kvPutFailed",
        ...context,
        key,
        name,
        delta,
    });
}
