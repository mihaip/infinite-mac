type VarData = {[key: string]: number};
// For now just store everything in one key, since we don't expect to have a lot
// of distinct keys.
const VARZ_KEY = "varz";

export async function handleRequest(request: Request, namespace: KVNamespace) {
    if (request.method === "POST") {
        const body = await request.json();
        const changes = body as VarData;
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
        return new Response("", {status: 204});
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
