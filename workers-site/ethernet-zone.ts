export class EthernetZone implements DurableObject {
    #clients: EthernetZoneClient[] = [];

    async fetch(request: Request) {
        const url = new URL(request.url);
        if (url.pathname === "/websocket") {
            return this.handleWebSocket(request);
        } else if (url.pathname === "/list") {
            return new Response(
                `clients: ${JSON.stringify(
                    this.#clients,
                    (key, value) => {
                        if (key === "webSocket") {
                            const webSocket = value as WebSocket;
                            return {
                                readyState: webSocket.readyState,
                                url: webSocket.url,
                                protocol: webSocket.protocol,
                            };
                        }
                        return value;
                    },
                    2
                )}`,
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

    async handleWebSocket(request: Request) {
        if (request.headers.get("Upgrade") !== "websocket") {
            return new Response("Expected websocket", {status: 400});
        }

        const [client, server] = Object.values(new WebSocketPair());

        await this.handleClient(server);

        return new Response(null, {status: 101, webSocket: client});
    }

    async handleClient(webSocket: WebSocket) {
        webSocket.accept();

        const client: EthernetZoneClient = {webSocket};
        this.#clients.push(client);

        webSocket.addEventListener("message", async event => {
            const data = JSON.parse(event.data as string);
            const {type, ...payload} = data;
            switch (type) {
                case "init":
                    client.macAddress = payload.macAddress;
                    break;
                case "close":
                    this.closeClient(client);
                    break;
                case "send": {
                    const {destination, ...sendPayload} = payload;
                    for (const otherClient of this.#clients) {
                        if (otherClient === client || otherClient.closed) {
                            continue;
                        }
                        if (
                            destination === "*" ||
                            destination === "AT" ||
                            destination === otherClient.macAddress
                        ) {
                            try {
                                otherClient.webSocket.send(
                                    JSON.stringify({
                                        type: "receive",
                                        ...sendPayload,
                                    })
                                );
                            } catch (err) {
                                this.closeClient(otherClient);
                            }
                        }
                    }
                    break;
                }
                default:
                    console.warn("Unexpected message", data);
            }
        });
    }

    closeClient(client: EthernetZoneClient) {
        client.closed = true;
        this.#clients.splice(this.#clients.indexOf(client), 1);
    }
}

type EthernetZoneClient = {
    webSocket: WebSocket;
    macAddress?: string;
    closed?: boolean;
};
