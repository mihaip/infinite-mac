import {DurableObject} from "cloudflare:workers";
import {type Env} from "index";

export class EthernetZone extends DurableObject {
    #clients = new Map<WebSocket, EthernetZoneClient>();

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);

        this.ctx.getWebSockets().forEach(ws => {
            const attachment = ws.deserializeAttachment();
            if (attachment) {
                this.#clients.set(ws, attachment as EthernetZoneClient);
            }
        });
    }

    override async fetch(request: Request) {
        const url = new URL(request.url);
        if (url.pathname === "/websocket") {
            return this.handleWebSocket(request);
        } else if (url.pathname === "/list") {
            const clients = Array.from(this.#clients.entries()).map(
                ([ws, client]) => {
                    return {
                        websocket: {
                            readyState: ws.readyState,
                            url: ws.url,
                            protocol: ws.protocol,
                            extensions: ws.extensions ?? "<none>",
                        },
                        ...client,
                    };
                }
            );
            return new Response(
                `clients: ${JSON.stringify(clients, undefined, 2)}`,
                {
                    status: 200,
                    statusText: "OK",
                    headers: {
                        "Content-Type": "text/plain",
                    },
                }
            );
        }
        return new Response("Not found (EthernetZone)", {status: 404});
    }

    private async handleWebSocket(request: Request) {
        if (request.headers.get("Upgrade") !== "websocket") {
            return new Response("Expected websocket", {status: 400});
        }

        const [client, server] = Object.values(new WebSocketPair());
        this.ctx.acceptWebSocket(server);
        return new Response(null, {status: 101, webSocket: client});
    }

    override async webSocketMessage(
        ws: WebSocket,
        message: string | ArrayBuffer
    ) {
        const data = JSON.parse(message as string);
        const {type, ...payload} = data;
        switch (type) {
            case "init": {
                const {macAddress} = payload;
                const client = this.#clients.get(ws) ?? {};
                client.macAddress = macAddress;
                this.#clients.set(ws, client);
                ws.serializeAttachment(client);
                break;
            }
            case "close":
                ws.close(1001, "Client requested close");
                break;
            case "send": {
                const {destination, ...sendPayload} = payload;
                for (const [clientWs, client] of this.#clients.entries()) {
                    if (
                        clientWs !== ws &&
                        clientWs.readyState === WebSocket.OPEN
                    ) {
                        if (
                            destination === "*" ||
                            destination === "AT" ||
                            destination === client.macAddress
                        ) {
                            try {
                                clientWs.send(
                                    JSON.stringify({
                                        type: "receive",
                                        ...sendPayload,
                                    })
                                );
                            } catch (err) {
                                this.webSocketClose(
                                    clientWs,
                                    1011,
                                    "Error sending message",
                                    false
                                );
                            }
                        }
                    }
                }
                break;
            }
            default:
                console.warn("Unexpected message", data);
        }
    }

    override async webSocketClose(
        ws: WebSocket,
        code: number,
        reason: string,
        wasClean: boolean
    ) {
        this.#clients.delete(ws);
        ws.close(code, "Durable Object is closing WebSocket");
    }
}

type EthernetZoneClient = {
    macAddress?: string;
};
