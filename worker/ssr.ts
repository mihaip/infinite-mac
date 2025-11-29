import {createElement} from "react";
import {renderToReadableStream} from "react-dom/server";
import {type Env} from "./index";
import {AsyncLocalStorage} from "node:async_hooks";
import {type Iso, setIsoProvider} from "@/lib/iso";

export function canRenderSSR(url: URL) {
    const {pathname, searchParams} = url;
    if (searchParams.get("ssr") === "0") {
        return false;
    }
    if (pathname === "/") {
        return true;
    }
    // TODO: support rendering of run-def paths too.
    return false;
}

export async function renderSSR(
    request: Request,
    env: Env,
    url: URL
): Promise<Response | undefined> {
    return isoStorage.run(new RequestIso(request), () =>
        renderSSRImpl(request, env, url)
    );
}

async function renderSSRImpl(
    request: Request,
    env: Env,
    url: URL
): Promise<Response | undefined> {
    const templateHtml = await getTemplateHtml(env, request);
    const marker = '<div id="root"></div>';
    const parts = templateHtml.split(marker);
    if (parts.length !== 2) {
        console.warn("HTML template does not contain expected SSR marker");
        return undefined;
    }

    const [prefix, suffix] = parts;
    const ssrStream = await renderAppStream();
    const encoder = new TextEncoder();
    const responseStream = new ReadableStream({
        async start(controller) {
            controller.enqueue(encoder.encode(prefix + '<div id="root">'));
            const reader = ssrStream.getReader();
            try {
                while (true) {
                    const {done, value} = await reader.read();
                    if (done) {
                        break;
                    }
                    controller.enqueue(value);
                }
                controller.enqueue(encoder.encode("</div>" + suffix));
                controller.close();
            } catch (err) {
                console.error("Error during SSR streaming:", err);
                controller.error(err);
            }
        },
    });
    return new Response(responseStream, {
        status: 200,
        statusText: "OK",
        headers: {
            "Content-Type": "text/html; charset=utf-8",
        },
    });
}

let cachedTemplateHtml: string | null = null;
async function getTemplateHtml(env: Env, request: Request) {
    if (cachedTemplateHtml !== null) {
        return cachedTemplateHtml;
    }
    const assetResponse = await env.ASSETS.fetch(request);
    const templateHtml = await assetResponse.clone().text();
    // eslint-disable-next-line require-atomic-updates
    cachedTemplateHtml = templateHtml;
    return templateHtml;
}

async function renderAppStream() {
    try {
        // Dynamically import to avoid failing worker startup if SSR breaks.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: allow importing client entry into worker SSR shim.
        const {default: App} = (await import("@/app/App")) as {default: any};
        const vnode = createElement(App, {});
        return await renderToReadableStream(vnode);
    } catch (err) {
        return renderErrorStream(err);
    }
}
function renderErrorStream(err: unknown) {
    console.error("Error during SSR render:", err);
    const encoder = new TextEncoder();
    const message =
        err instanceof Error
            ? `${err.name}: ${err.message}\n${err.stack ?? ""}`
            : String(err);
    return new ReadableStream({
        start(controller) {
            controller.enqueue(
                encoder.encode(
                    `<pre style="white-space:pre-wrap;background:#fff">${escapeHtml(message)}</pre>`
                )
            );
            controller.close();
        },
    });
}

function escapeHtml(input: string) {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

const isoStorage = new AsyncLocalStorage<RequestIso>();
setIsoProvider(() => {
    const store = isoStorage.getStore();
    if (!store) {
        throw new Error("No ISO context available");
    }
    return store;
});

class RequestIso implements Iso {
    constructor(private request: Request) {}

    get location() {
        const url = new URL(this.request.url);
        return {
            get href() {
                return url.href;
            },
            get pathname() {
                return url.pathname;
            },
            get searchParams() {
                return url.searchParams;
            },
        };
    }

    get cookie() {
        return {
            get: () => {
                return this.request.headers.get("cookie") ?? undefined;
            },
            set: (value: string) => {
                throw new Error("Cannot set cookies in request context.");
            },
        };
    }

    get navigator() {
        const userAgent = this.request.headers.get("user-agent") ?? "";
        return {
            get userAgent() {
                return userAgent;
            },
        };
    }
}
